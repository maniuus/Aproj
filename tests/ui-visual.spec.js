const path = require('path')
const fs = require('fs')
const os = require('os')
const { test, expect } = require('@playwright/test')
const { _electron: electron } = require('playwright')
const { execSync } = require('child_process')

const WS = process.env.APROJ_TEST_WS || path.join(os.tmpdir(), 'aproj-ux-test.apro')
const APP_ROOT = path.resolve(__dirname, '..')

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
  try {
    await win.setViewportSize({ width: 1280, height: 800 })
  } catch {
    // window berukuran tetap — pakai ukuran asli (tetap deterministik antar run)
  }
}

async function sidebar(label) {
  await win.getByText(label, { exact: true }).first().click()
}

async function openWorkspace() {
  await win.getByText('Workspace Terakhir').waitFor({ timeout: 8000 })
  await win.getByText('Buka →').first().click()
  await win.getByText('TREN HARIAN').waitFor({ timeout: 10000 })
}

// Buka halaman lewat sidebar lalu tunggu anchor kontennya (render selesai).
async function openPage(label, anchor) {
  await openWorkspace()
  await sidebar(label)
  await win.getByText(anchor, { exact: true }).first().waitFor()
}

// Sidebar MASTER_LINKS hanya membuka halaman Master; tab internal diklik di konten.
async function openMasterTab(tab, addButton) {
  await openWorkspace()
  await sidebar('Suplier')
  await win.locator('main').getByText(tab, { exact: true }).click()
  await win.locator('main').getByText(addButton, { exact: true }).waitFor()
}

test.beforeEach(async () => {
  execSync('node tests/ux-seed.js', { cwd: APP_ROOT, stdio: 'pipe' })
  await launchFresh()
})
test.afterEach(async () => {
  await electronApp?.close()
})

// Settle singkat: chart Overview bereaksi setelah data load (bukan animasi CSS,
// tapi biarkan layout stabil sebelum snapshot).
const settle = async () => win.waitForTimeout(250)

test('Home — daftar workspace', async () => {
  await win.getByText('Workspace Terakhir').waitFor({ timeout: 8000 })
  await settle()
  await expect(win).toHaveScreenshot('home.png')
})

test('Overview — tren & pengeluaran', async () => {
  await openWorkspace()
  await settle()
  await expect(win).toHaveScreenshot('overview.png')
})

test('Daily Cashflow — tabel paginated', async () => {
  await openPage('Daily Cashflow', 'DAILY CASHFLOW')
  await win.getByText(/Hal 1 dari 3/).waitFor()
  await settle()
  await expect(win).toHaveScreenshot('cashflow.png')
})

test('Balance Sheet — ringkasan per projek', async () => {
  await openPage('Balance Sheet', 'RINGKASAN PER PROJEK')
  await settle()
  await expect(win).toHaveScreenshot('balancesheet.png')
})

test('Desk — agregasi mingguan', async () => {
  await openPage('Desk', 'PROYEK DALAM DESK')
  await settle()
  await expect(win).toHaveScreenshot('desk.png')
})

test('Projek — projek aktif terpilih', async () => {
  await openPage('Projek', 'CASHFLOW PROYEK')
  await settle()
  await expect(win).toHaveScreenshot('projek.png')
})

const MASTER_TABS = [
  { tab: 'Suplier', addButton: '+ Tambah' },
  { tab: 'Material', addButton: '+ Material' },
  { tab: 'Gudang', addButton: '+ Tambah' },
  { tab: 'Pekerja', addButton: '+ Tambah Pekerja' },
  { tab: 'Tenaga Kerja', addButton: '+ Tambah' },
  { tab: 'Alat', addButton: '+ Tambah' },
  { tab: 'Subkon', addButton: '+ Tambah' },
  { tab: 'Pekerjaan', addButton: '+ Tambah' }
]

for (const m of MASTER_TABS) {
  test(`Master — tab ${m.tab}`, async () => {
    await openMasterTab(m.tab, m.addButton)
    await settle()
    await expect(win).toHaveScreenshot(`master-${m.tab.toLowerCase().replace(/\s+/g, '-')}.png`)
  })
}
