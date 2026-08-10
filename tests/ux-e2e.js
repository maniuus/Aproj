const path = require('path')
const fs = require('fs')
const os = require('os')
const { _electron: electron } = require('playwright')

const WS = process.env.APROJ_TEST_WS || path.join(os.tmpdir(), 'aproj-ux-test.apro')
const OUT_DIR = path.join(os.tmpdir(), 'aproj-ux-e2e-out')
const APP_ROOT = path.resolve(__dirname, '..')

function hr(ms) {
  return `${ms.toFixed(0)}ms`
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f))

  const electronApp = await electron.launch({ args: ['.'], cwd: APP_ROOT })
  const win = await electronApp.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const results = []
  let task = async (name, fn) => {
    const t0 = Date.now()
    try {
      await fn()
      results.push({ task: name, status: 'PASS', ms: Date.now() - t0 })
    } catch (e) {
      results.push({ task: name, status: 'FAIL', ms: Date.now() - t0, error: String(e) })
    }
  }

  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const regPath = path.join(userData, 'aproj-recents.json')
  fs.writeFileSync(regPath, JSON.stringify([{ path: WS, name: 'AProj UX Test', lastOpened: new Date().toISOString() }], null, 2))
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await win.getByText('Workspace Terakhir').waitFor({ timeout: 8000 })

  // ---- TASK 1: Buka workspace dari Home
  await task('Buka workspace dari Home', async () => {
    await win.getByText('Buka →').first().click()
    await win.getByText('TREN HARIAN').waitFor({ timeout: 10000 })
    await win.getByText('Export Weekly').waitFor({ timeout: 5000 })
  })

  // ---- TASK 2: Navigasi ke Daily Cashflow + pagination
  await task('Cashflow: buka halaman & verifikasi pagination', async () => {
    await win.getByText('Daily Cashflow').first().click()
    await win.getByText('DAILY CASHFLOW').first().waitFor({ timeout: 8000 })
    await win.getByText(/Hal 1 dari 3/).waitFor({ timeout: 5000 })
    const rows1 = await win.locator('table tbody tr').count()
    if (rows1 !== 50) throw new Error(`expected 50 rows on page 1, got ${rows1}`)
    await win.getByText('Berikutnya ›').click()
    await win.getByText(/Hal 2 dari 3/).waitFor({ timeout: 5000 })
    await win.getByText('‹ Sebelumnya').click()
    await win.getByText(/Hal 1 dari 3/).waitFor({ timeout: 5000 })
  })

  // ---- TASK 3: Tambah nota baru
  await task('Tambah nota baru', async () => {
    await win.getByText('+ Tambah Nota').click()
    await win.getByText('Items — material').waitFor({ timeout: 5000 })
    await win.locator('select').filter({ hasText: 'Keluar (material)' }).selectOption('keluar-lain')
    await win.getByPlaceholder('Contoh: biaya tol, makan tim, fotokopi').fill('Biaya uji otomasi')
    await win.getByPlaceholder('Ketik uraian pengeluaran…').fill('Biaya uji otomasi')
    await win.getByText('Input Nota').click()
    await win.getByText('Biaya uji otomasi').first().waitFor({ timeout: 8000 })
    await win.getByText(/Hal 1 dari 3/).waitFor({ timeout: 5000 })
  })

  // ---- TASK 4: Export Monthly (stub dialog)
  await task('Export Monthly report', async () => {
    const monthlyPath = path.join(OUT_DIR, 'Monthly.xlsx')
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
      dialog.showOpenDialog = async () => ({ canceled: true })
    }, monthlyPath)
    await win.getByText('Overview').first().click()
    await win.getByText('Export Monthly').click()
    await win.getByText(/tersimpan|Gagal/).waitFor({ timeout: 15000 })
    if (!fs.existsSync(monthlyPath)) {
      await win.screenshot({ path: path.join(OUT_DIR, 'export-fail.png') })
      throw new Error('Monthly.xlsx tidak terbuat')
    }
  })

  // ---- TASK 5: Backup workspace (stub dialog) — dipicu via API karena tombol
  // "Backup Workspace…" hanya dirender saat workspace aktif padahal Home full-page
  // hanya dirender saat workspace null (lihat App.tsx) → tombol tidak reachable via UI.
  await task('Backup workspace (IPC + zip)', async () => {
    const backupPath = path.join(OUT_DIR, 'backup.aproj.zip')
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, backupPath)
    const res = await win.evaluate(() => window.electronAPI.workspace.export())
    if (!res || !res.ok) throw new Error('workspace.export tidak ok: ' + JSON.stringify(res))
    if (!fs.existsSync(backupPath)) {
      await win.screenshot({ path: path.join(OUT_DIR, 'backup-fail.png') })
      throw new Error('backup.aproj.zip tidak terbuat')
    }
    const size = fs.statSync(backupPath).size
    if (size < 10000) throw new Error(`zip terlalu kecil: ${size} bytes`)
  })

  console.log('')
  console.log('=== UX E2E RESULTS ===')
  for (const r of results) {
    console.log(`${r.status.padEnd(4)}  ${r.task.padEnd(45)}  ${hr(r.ms)}${r.error ? '  → ' + r.error : ''}`)
  }
  const fails = results.filter((r) => r.status === 'FAIL')
  console.log(`\n${results.length - fails.length}/${results.length} tasks PASS`)

  await electronApp.close()
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
