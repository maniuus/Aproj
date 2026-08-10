const path = require('path')
const os = require('os')
const fs = require('fs')
const { _electron: electron } = require('playwright')

const APP_ROOT = path.resolve(__dirname, '..')
const EXE = path.join(APP_ROOT, 'dist', 'win-unpacked', 'aproj.exe')
const WS = process.env.APROJ_TEST_WS || path.join(os.tmpdir(), 'aproj-ux-test.apro')

async function main() {
  const electronApp = await electron.launch({ executablePath: EXE, args: [] })
  const win = await electronApp.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const recentsPath = path.join(userData, 'aproj-recents.json')
  fs.mkdirSync(path.dirname(recentsPath), { recursive: true })
  fs.writeFileSync(
    recentsPath,
    JSON.stringify([{ path: WS, name: 'AProj UX Test', lastOpened: new Date().toISOString() }], null, 2)
  )
  await win.reload()
  await win.waitForLoadState('domcontentloaded')

  await win.getByText('Workspace Terakhir').waitFor({ timeout: 8000 })
  await win.getByText('Buka →').first().click()
  await win.getByText('TREN HARIAN').waitFor({ timeout: 10000 })

  const count = await win.evaluate(() => window.electronAPI.nota.count({}))

  console.log(`PACKAGED APP OK: nota count = ${count}`)
  await win.screenshot({ path: path.join(os.tmpdir(), 'aproj-pkg-home.png') })
  console.log('screenshot: %TEMP%/aproj-pkg-home.png')
  await electronApp.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('PKG SMOKE FAIL:', e.message)
  process.exit(1)
})
