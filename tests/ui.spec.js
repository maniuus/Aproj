const path = require('path')
const fs = require('fs')
const os = require('os')
const { test, expect } = require('@playwright/test')
const { _electron: electron } = require('playwright')

const { execSync } = require('child_process')

const WS = process.env.APROJ_TEST_WS || path.join(os.tmpdir(), 'aproj-ux-test.apro')
const OUT_DIR = path.join(os.tmpdir(), 'aproj-ux-e2e-out')
const APP_ROOT = path.resolve(__dirname, '..')
const TOTAL_NOTAS = 120
const PER_PAGE = 50

let electronApp
let win

async function launchFresh() {
  electronApp = await electron.launch({ args: ['.'], cwd: APP_ROOT })
  win = await electronApp.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  fs.writeFileSync(
    path.join(userData, 'aproj-recents.json'),
    JSON.stringify([{ path: WS, name: 'AProj UX Test', lastOpened: new Date().toISOString() }], null, 2)
  )
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
}

async function sidebar(label) {
  await win.getByText(label, { exact: true }).first().click()
}

// Setiap test mulai dari app fresh di Home → buka workspace (default ke Overview).
async function openWorkspace() {
  await win.getByText('Workspace Terakhir').waitFor({ timeout: 8000 })
  await win.getByText('Buka →').first().click()
  await win.getByText('TREN HARIAN').waitFor({ timeout: 10000 })
}

async function openCashflow() {
  await openWorkspace()
  await sidebar('Daily Cashflow')
  await win.getByText('DAILY CASHFLOW', { exact: true }).first().waitFor()
  // tunggu data selesai dimuat (pagination footer muncul → EmptyNote tidak tampil)
  await win.getByText(/Hal 1 dari 3/).waitFor()
}

// Sidebar MASTER_LINKS hanya membuka halaman Master; tab internal harus diklik di konten.
async function openMasterTab(tab) {
  await openWorkspace()
  await sidebar(tab)
  await win.locator('main').getByText(tab, { exact: true }).click()
}

async function notaCount() {
  return win.evaluate(() => window.electronAPI.nota.count({}))
}

test.beforeEach(async () => {
  // Workspace DB di-share antar test → reseed agar setiap test mulai dari 120 nota.
  execSync('node tests/ux-seed.js', { cwd: APP_ROOT, stdio: 'pipe' })
  await launchFresh()
})
test.afterEach(async () => {
  await electronApp?.close()
})

test.describe('Workspace', () => {
  test('Buka workspace dari Home', async () => {
    await openWorkspace()
    await win.getByText('Export Weekly').waitFor({ timeout: 5000 })
  })
})

test.describe('Cashflow pagination (data-driven)', () => {
  for (const pageNo of [1, 2, 3]) {
    const expected = pageNo < 3 ? PER_PAGE : TOTAL_NOTAS - (3 - 1) * PER_PAGE
    test(`Halaman ${pageNo} menampilkan ${expected} baris & judul hal benar`, async () => {
      await openCashflow()
      for (let i = 1; i < pageNo; i++) {
        await win.getByText('Berikutnya ›').click()
        await win.getByText(new RegExp(`Hal ${i + 1} dari 3`)).waitFor()
      }
      const rows = await win.locator('table tbody tr').count()
      expect(rows).toBe(expected)
      await win.getByText(new RegExp(`Hal ${pageNo} dari 3`)).waitFor()
    })
  }

  test('Navigasi Berikutnya/Sebelumnya bolak-balik', async () => {
    await openCashflow()
    await win.getByText('Hal 1 dari 3').waitFor()
    await win.getByText('Berikutnya ›').click()
    await win.getByText('Hal 2 dari 3').waitFor()
    await win.getByText('Berikutnya ›').click()
    await win.getByText('Hal 3 dari 3').waitFor()
    await win.getByText('‹ Sebelumnya').click()
    await win.getByText('Hal 2 dari 3').waitFor()
    await win.getByText('‹ Sebelumnya').click()
    await win.getByText('Hal 1 dari 3').waitFor()
  })
})

test.describe('Tambah nota (data-driven per jenis)', () => {
  const CASES = [
    {
      jenis: 'keluar-lain',
      uraian: 'Biaya otomasi lain-lain',
      deskripsi: 'Biaya otomasi lain-lain'
    },
    {
      jenis: 'masuk',
      sumber: 'Termin otomasi'
    }
  ]

  for (const c of CASES) {
    test(`Tambah nota ${c.jenis}`, async () => {
      await openCashflow()
      await win.getByText('+ Tambah Nota').click()
      await win.getByText(/Items —/).waitFor()
      await win.locator('select').filter({ hasText: /Keluar|Masuk/ }).selectOption(c.jenis)
      if (c.deskripsi) {
        await win.getByPlaceholder('Contoh: biaya tol, makan tim, fotokopi').fill(c.deskripsi)
      }
      if (c.uraian) {
        await win.getByPlaceholder('Ketik uraian pengeluaran…').fill(c.uraian)
      }
      if (c.sumber) {
        await win.getByPlaceholder('Ketik sumber pemasukan (Termin, Pinjaman)…').fill(c.sumber)
      }
      await win.getByText('Input Nota').click()
      await win.getByText('Nota tersimpan').waitFor()
      expect(await notaCount()).toBe(TOTAL_NOTAS + 1)
      if (c.uraian) {
        // uraian keluar-lain tampil di kolom Uraian tabel Cashflow
        await win.getByText(c.uraian).first().waitFor()
      }
    })
  }
})

test.describe('Hapus dengan konfirmasi (data-driven per tab Master)', () => {
  const CASES = [
    { tab: 'Suplier', addButton: '+ Tambah', nameField: 'Nama Toko', record: 'Toko Otomasi Uji' },
    { tab: 'Material', addButton: '+ Material', nameField: 'Nama Material', record: 'Material Otomasi Uji' }
  ]

  for (const c of CASES) {
    test(`Konfirmasi hapus di tab ${c.tab}`, async () => {
      await openMasterTab(c.tab)
      await win.locator('main').getByText(c.addButton, { exact: true }).click()
      await win.locator('label', { hasText: c.nameField }).locator('input').fill(c.record)
      await win.getByText('Simpan', { exact: true }).click()
      await win.getByText(c.record).waitFor()

      // Klik Hapus → modal konfirmasi muncul
      await win.locator('tr', { hasText: c.record }).getByText('Hapus').click()
      const confirmModal = win.locator('div.fixed.inset-0')
      await confirmModal.getByText('Yakin hapus').waitFor()

      // Batal → data tetap ada
      await confirmModal.getByText('Batal', { exact: true }).click()
      await expect(win.getByText(c.record)).toHaveCount(1)

      // Hapus lagi → konfirmasi → baris hilang
      await win.locator('tr', { hasText: c.record }).getByText('Hapus').click()
      await win.locator('div.fixed.inset-0').getByText('Hapus', { exact: true }).click()
      await expect(win.getByText(c.record)).toHaveCount(0)
    })
  }
})

test.describe('Hapus nota dengan konfirmasi (Cashflow)', () => {
  test('Konfirmasi hapus nota lalu data hilang', async () => {
    await openCashflow()
    await win.locator('table tbody tr').first().getByText('✕').click()
    const confirmModal = win.locator('div.fixed.inset-0')
    await confirmModal.getByText('Yakin hapus nota').waitFor()
    await confirmModal.getByText('Hapus', { exact: true }).click()
    await win.getByText('Nota dihapus').waitFor()
    expect(await notaCount()).toBe(TOTAL_NOTAS - 1)
  })
})

test.describe('Backup via UI (tombol sidebar)', () => {
  test('Backup Workspace… ter-render di sidebar & hasil zip ada', async () => {
    const backupPath = path.join(OUT_DIR, 'backup-ui.aproj.zip')
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, backupPath)
    await openWorkspace()
    await win.getByText('Backup Workspace…').click()
    await win.getByText(/Backup tersimpan/).waitFor({ timeout: 15000 })
    expect(fs.existsSync(backupPath)).toBe(true)
    expect(fs.statSync(backupPath).size).toBeGreaterThan(10000)
  })
})
