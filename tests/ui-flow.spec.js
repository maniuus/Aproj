const path = require('path')
const fs = require('fs')
const os = require('os')
const { test, expect } = require('@playwright/test')
const { _electron: electron } = require('playwright')
const { execSync } = require('child_process')

const WS = process.env.APROJ_TEST_WS || path.join(os.tmpdir(), 'aproj-ux-test.apro')
const APP_ROOT = path.resolve(__dirname, '..')
const TOTAL_NOTAS = 120
const SEED_SUPLIER = 'PT Sumber Jaya'

let electronApp, win

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

function sidebar(label) {
  return win.getByText(label, { exact: true }).first().click()
}

async function openWorkspace() {
  await win.getByText('Workspace Terakhir').waitFor({ timeout: 8000 })
  await win.getByText('Buka →').first().click()
  await win.getByText('TREN HARIAN').waitFor({ timeout: 10000 })
}

async function openCashflow() {
  await openWorkspace()
  await sidebar('Daily Cashflow')
  await win.getByText('DAILY CASHFLOW', { exact: true }).first().waitFor()
  await win.getByText(/Hal 1 dari 3/).waitFor()
}

async function notaCount() {
  return win.evaluate(() => window.electronAPI.nota.count({}))
}

async function openAddNota() {
  await openCashflow()
  await win.getByText('+ Tambah Nota', { exact: true }).first().click()
  await win.getByText('Input Nota', { exact: true }).waitFor()
}

function tomorrowDmy() {
  const d = new Date(Date.now() + 86400000)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

function rowOf(name) {
  return win.getByPlaceholder(name).locator('..').locator('..')
}

test.beforeEach(async () => {
  execSync('node tests/ux-seed.js', { cwd: APP_ROOT, stdio: 'pipe' })
  await launchFresh()
})

test.afterEach(async () => {
  await electronApp?.close()
})

test.describe('user flow: input nota keluar-material (auto-fill harga dari master)', () => {
  test('input lengkap material: suplier + item auto-fill harga 65000, qty, subtotal, total, simpan', async () => {
    await openAddNota()
    const before = await notaCount()

    const jen = win.locator('select').filter({ hasText: /Keluar|Masuk/ })
    await expect(jen).toHaveValue('keluar-material')

    const projSelect = win.locator('label').filter({ hasText: 'Projek' }).locator('select')
    await projSelect.selectOption('prj-1')

    await win.getByPlaceholder('Ketik nama suplier…').fill(SEED_SUPLIER)

    const matInput = win.getByPlaceholder('Ketik nama material…')
    await matInput.fill('Semen 50kg')
    const row = rowOf('Ketik nama material…')

    const priceInput = row.locator('input[type="number"]').nth(1)
    await expect(priceInput).toHaveValue('65000')
    await expect(row.locator('input[placeholder="—"]')).toHaveValue('sak')

    await row.locator('input[type="number"]').first().fill('3')
    await expect(row.locator('div.text-right.text-sm.font-semibold')).toHaveText('Rp 195.000')
    await expect(win.getByText('Total:').locator('..').locator('b')).toHaveText('Rp 195.000')

    await win.getByPlaceholder('dd/mm/yy').fill(tomorrowDmy())
    await win.getByText('Input Nota', { exact: true }).click()

    await win.getByText('Nota tersimpan').waitFor({ timeout: 10000 })
    expect(await notaCount()).toBe(before + 1)

    const firstRow = win.locator('tbody tr').first()
    await expect(firstRow).toContainText('Rumah Tinggal Jl. Melati')
    await expect(firstRow).toContainText('PT Sumber Jaya')
    await expect(firstRow).toContainText('-Rp 195.000')
  })

  test('pilih suplier dulu lalu item: harga tetap auto-fill dari material_prices', async () => {
    await openAddNota()
    await win.getByPlaceholder('Ketik nama suplier…').fill(SEED_SUPLIER)
    const matInput = win.getByPlaceholder('Ketik nama material…')
    await matInput.fill('Besi Beton 10mm')
    const row = rowOf('Ketik nama material…')
    await expect(row.locator('input[type="number"]').nth(1)).toHaveValue('52000')
  })

  test('hutang: pilih pembayaran hutang tersimpan', async () => {
    await openAddNota()
    await win.getByPlaceholder('Ketik nama suplier…').fill(SEED_SUPLIER)
    await win.getByPlaceholder('Ketik nama material…').fill('Pasir')
    await win.getByPlaceholder('dd/mm/yy').fill(tomorrowDmy())
    await win.locator('label').filter({ hasText: 'Pembayaran' }).locator('select').selectOption('hutang')
    await win.getByText('Input Nota', { exact: true }).click()
    await win.getByText('Nota tersimpan').waitFor({ timeout: 10000 })
    const rows = await win.evaluate(() => window.electronAPI.nota.list({ limit: 1 }))
    expect(rows[0].payment_status).toBe('hutang')
  })
})

test.describe('user flow: input nota masuk (termin)', () => {
  test('input termin: nama item, jumlah, total, tampil di tabel', async () => {
    await openAddNota()
    const before = await notaCount()

    await win.locator('select').filter({ hasText: /Keluar|Masuk/ }).selectOption('masuk')

    const srcInput = win.getByPlaceholder('Ketik sumber pemasukan (Termin, Pinjaman)…')
    await srcInput.fill('Termin 1')
    const row = rowOf('Ketik sumber pemasukan (Termin, Pinjaman)…')
    await row.locator('input[type="number"]').first().fill('1')
    await row.locator('input[type="number"]').nth(1).fill('5000000')
    await expect(win.getByText('Total:').locator('..').locator('b')).toHaveText('Rp 5.000.000')

    await win.getByPlaceholder('dd/mm/yy').fill(tomorrowDmy())
    await win.getByText('Input Nota', { exact: true }).click()
    await win.getByText('Nota tersimpan').waitFor({ timeout: 10000 })
    expect(await notaCount()).toBe(before + 1)

    const firstRow = win.locator('tbody tr').first()
    await expect(firstRow).toContainText('+Rp 5.000.000')
    await expect(firstRow).toContainText('Masuk')
  })
})

test.describe('user flow: input nota keluar-lain (uraian bebas)', () => {
  test('isi deskripsi + uraian item, simpan, tampil di tabel', async () => {
    await openAddNota()
    await win.locator('select').filter({ hasText: /Keluar|Masuk/ }).selectOption('keluar-lain')

    await win.getByPlaceholder('Contoh: biaya tol, makan tim, fotokopi').fill('Biaya makan tim otomasi')
    const uraian = win.getByPlaceholder('Ketik uraian pengeluaran…')
    await uraian.fill('Konsumsi rapat')
    const row = rowOf('Ketik uraian pengeluaran…')
    await row.locator('input[type="number"]').first().fill('2')
    await row.locator('input[type="number"]').nth(1).fill('75000')
    await expect(win.getByText('Total:').locator('..').locator('b')).toHaveText('Rp 150.000')

    await win.getByPlaceholder('dd/mm/yy').fill(tomorrowDmy())
    await win.getByText('Input Nota', { exact: true }).click()
    await win.getByText('Nota tersimpan').waitFor({ timeout: 10000 })

    const firstRow = win.locator('tbody tr').first()
    await expect(firstRow).toContainText('Biaya makan tim otomasi')
    await expect(firstRow).toContainText('-Rp 150.000')
  })
})

test.describe('user flow: edit nota', () => {
  test('buka edit dari tabel, ubah qty, simpan, total berubah', async () => {
    await openCashflow()
    const firstRow = win.locator('tbody tr').first()
    await firstRow.getByTitle('Edit nota').click()
    await win.getByText('Simpan Perubahan', { exact: true }).waitFor()

    const row = rowOf('Ketik nama material…')
    await row.locator('input[type="number"]').first().fill('10')
    await win.getByText('Simpan Perubahan', { exact: true }).click()

    await win.getByText('Nota diperbarui').waitFor({ timeout: 10000 })
    const rows = await win.evaluate(() => window.electronAPI.nota.list({ limit: 1 }))
    expect(Number(rows[0].total)).toBe(650000)
  })
})

test.describe('user flow: guard & jumlah item', () => {
  test('tombol Input Nota disabled saat semua item kosong', async () => {
    await openAddNota()
    await expect(win.getByText('Input Nota', { exact: true })).toBeDisabled()
    await win.getByPlaceholder('Ketik nama material…').fill('Semen 50kg')
    await expect(win.getByText('Input Nota', { exact: true })).toBeEnabled()
  })

  test('multi-item: total = jumlah subtotal', async () => {
    await openAddNota()
    await win.getByPlaceholder('Ketik nama suplier…').fill(SEED_SUPLIER)
    await win.getByPlaceholder('Ketik nama material…').fill('Semen 50kg')
    const row1 = rowOf('Ketik nama material…')
    await row1.locator('input[type="number"]').first().fill('2')

    await win.getByText('+ Tambah item').click()
    const rows = win.getByPlaceholder('Ketik nama material…')
    await expect(rows).toHaveCount(2)
    await rows.nth(1).fill('Semen 50kg')
    const row2 = rows.nth(1).locator('..').locator('..')
    await row2.locator('input[type="number"]').first().fill('4')
    await expect(win.getByText('Total:').locator('..').locator('b')).toHaveText('Rp 390.000')
  })
})

test.describe('user flow: input nota keluar-subkon (bayar subkon)', () => {
  test('pilih subkon + item pekerjaan, auto-fill harga dari subkon_prices, simpan, tampil di tabel', async () => {
    await openAddNota()
    const before = await notaCount()

    await win.locator('select').filter({ hasText: /Keluar|Masuk/ }).selectOption('keluar-subkon')

    await win.getByPlaceholder('Ketik nama subkon…').fill('CV Bangun Jaya')

    const pejInput = win.getByPlaceholder('Ketik nama pekerjaan…')
    await pejInput.fill('Pekerjaan Pondasi')
    const row = rowOf('Ketik nama pekerjaan…')
    await expect(row.locator('input[type="number"]').nth(1)).toHaveValue('75000')
    await expect(row.locator('input[placeholder="—"]')).toHaveValue('m3')

    await row.locator('input[type="number"]').first().fill('2')
    await expect(win.getByText('Total:').locator('..').locator('b')).toHaveText('Rp 150.000')

    await win.getByPlaceholder('dd/mm/yy').fill(tomorrowDmy())
    await win.getByText('Input Nota', { exact: true }).click()
    await win.getByText('Nota tersimpan').waitFor({ timeout: 10000 })
    expect(await notaCount()).toBe(before + 1)

    const rows = await win.evaluate(() => window.electronAPI.nota.list({ limit: 1 }))
    expect(rows[0].jenis).toBe('keluar-subkon')
    expect(rows[0].subkon_name).toBe('CV Bangun Jaya')
    expect(Number(rows[0].total)).toBe(150000)

    const firstRow = win.locator('tbody tr').first()
    await expect(firstRow).toContainText('CV Bangun Jaya')
    await expect(firstRow).toContainText('-Rp 150.000')
  })
})
