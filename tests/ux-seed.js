const path = require('path')
const fs = require('fs')
const os = require('os')
const initSqlJs = require('sql.js')

const WORKSPACE = process.env.APROJ_TEST_WS || path.join(os.tmpdir(), 'aproj-ux-test.apro')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, phone TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS subkontraktors (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, phone TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS supliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS desks (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT 'sendiri', notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, desk_id TEXT, owner_id TEXT, subkon_id TEXT, name TEXT NOT NULL, contract_value INTEGER DEFAULT 0, start_date TEXT, durasi_mou TEXT, status TEXT DEFAULT 'aktif', resume TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS project_subkons (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, subkon_id TEXT NOT NULL, UNIQUE(project_id, subkon_id));
CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, name TEXT NOT NULL, spesifikasi TEXT, unit TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS material_prices (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, suplier_id TEXT NOT NULL, price INTEGER DEFAULT 0, UNIQUE(material_id, suplier_id));
CREATE TABLE IF NOT EXISTS tenaga_kerja (id TEXT PRIMARY KEY, jenis TEXT NOT NULL, unit TEXT DEFAULT 'OH', harga_satuan INTEGER DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS pekerjas (id TEXT PRIMARY KEY, name TEXT NOT NULL, tenaga_kerja_id TEXT, upah_harian INTEGER DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS alats (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT, harga_satuan INTEGER DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS pekerjaans (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT, harga_satuan INTEGER DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS subkon_prices (id TEXT PRIMARY KEY, pekerjaan_id TEXT NOT NULL, subkon_id TEXT NOT NULL, price INTEGER DEFAULT 0, UNIQUE(pekerjaan_id, subkon_id));
CREATE TABLE IF NOT EXISTS gudangs (id TEXT PRIMARY KEY, name TEXT NOT NULL, lokasi TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS kebutuhans (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, jenis TEXT NOT NULL, item_type TEXT, item_id TEXT, satuan TEXT, qty_rencana REAL DEFAULT 0, notes TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS notas (id TEXT PRIMARY KEY, date TEXT NOT NULL, project_id TEXT, suplier_id TEXT, jenis TEXT NOT NULL, rekening TEXT DEFAULT 'proyek', keterangan TEXT, total INTEGER DEFAULT 0, payment_status TEXT DEFAULT 'terbayar', created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS nota_items (id TEXT PRIMARY KEY, nota_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT, name TEXT NOT NULL, unit TEXT, price INTEGER DEFAULT 0, qty REAL DEFAULT 0, subtotal INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS nota_photos (id TEXT PRIMARY KEY, nota_id TEXT NOT NULL, file_name TEXT NOT NULL, caption TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, date TEXT NOT NULL, dari TEXT NOT NULL, ke TEXT NOT NULL, jumlah INTEGER DEFAULT 0, jenis TEXT DEFAULT 'pendanaan', keterangan TEXT, created_at TEXT, updated_at TEXT);
CREATE INDEX IF NOT EXISTS idx_nota_items_nota ON nota_items(nota_id);
CREATE INDEX IF NOT EXISTS idx_nota_photos_nota ON nota_photos(nota_id);
CREATE INDEX IF NOT EXISTS idx_notas_date ON notas(date);
CREATE INDEX IF NOT EXISTS idx_notas_project ON notas(project_id);
CREATE INDEX IF NOT EXISTS idx_kebutuhan_project ON kebutuhans(project_id);
`

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function pad(n) {
  return String(n).padStart(2, '0')
}

async function main() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(SCHEMA)

  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  db.run(`INSERT INTO meta (key, value) VALUES ('name', 'AProj UX Test')`)

  const suplierId = 'sup-1'
  db.run(`INSERT INTO supliers (id, name, phone, address) VALUES (?, 'PT Sumber Jaya', '021-555', 'Jl. Raya No.1')`, [suplierId])
  const matIds = ['mat-1', 'mat-2', 'mat-3']
  const mats = [
    ['mat-1', 'Semen 50kg', 'sak'],
    ['mat-2', 'Besi Beton 10mm', 'batang'],
    ['mat-3', 'Pasir', 'm3']
  ]
  mats.forEach(([id, name, unit]) => db.run(`INSERT INTO materials (id, name, unit) VALUES (?, ?, ?)`, [id, name, unit]))
  db.run(`INSERT INTO material_prices (id, material_id, suplier_id, price) VALUES (?, ?, ?, ?)`, ['mp-1', 'mat-1', suplierId, 65000])
  db.run(`INSERT INTO material_prices (id, material_id, suplier_id, price) VALUES (?, ?, ?, ?)`, ['mp-2', 'mat-2', suplierId, 52000])

  const projects = [
    ['prj-1', 'Rumah Tinggal Jl. Melati', 250000000],
    ['prj-2', 'Ruko 2 Lantai Pasar Baru', 650000000],
    ['prj-3', 'Kantor PT Maju', 400000000]
  ]
  projects.forEach(([id, name, cv]) => {
    db.run(`INSERT INTO projects (id, name, contract_value, start_date, status) VALUES (?, ?, ?, ?, 'aktif')`, [id, name, cv, today])
  })

  const JENIS = ['keluar-material', 'keluar-lain', 'masuk', 'keluar-pekerjaan']
  const stmtNota = db.prepare(`INSERT INTO notas (id, date, project_id, suplier_id, jenis, rekening, keterangan, total, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const stmtItem = db.prepare(`INSERT INTO nota_items (id, nota_id, item_type, item_id, name, unit, price, qty, subtotal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)

  let nId = 0
  for (let i = 0; i < 120; i++) {
    const id = `nota-${i}`
    const prj = projects[i % 3][0]
    const jenis = JENIS[i % 4]
    const day = Math.max(1, (now.getDate() - i) % 28)
    const date = `${today.slice(0, 8)}${pad(day)}`
    const suplier = jenis === 'keluar-material' ? suplierId : null
    const rekening = jenis === 'masuk' ? 'global' : 'proyek'
    const total = jenis === 'keluar-material' ? 65000 * (1 + (i % 5)) : jenis === 'masuk' ? 5000000 : 150000
    stmtNota.run([id, date, prj, suplier, jenis, rekening, `Nota uji #${i + 1}`, total, i % 3 === 0 ? 'hutang' : 'terbayar'])
    nId++
    if (jenis === 'keluar-material') {
      const mat = mats[i % 3]
      stmtItem.run([`ni-${nId}`, id, 'material', mat[0], mat[1], mat[2], 65000, 1 + (i % 5), 65000 * (1 + (i % 5))])
    } else {
      stmtItem.run([`ni-${nId}`, id, 'lain', null, jenis === 'masuk' ? 'Termin pembayaran' : 'Biaya lain-lain', 'ls', total, 1, total])
    }
    nId++
  }
  stmtNota.free()
  stmtItem.free()

  fs.mkdirSync(WORKSPACE, { recursive: true })
  fs.mkdirSync(path.join(WORKSPACE, 'photos'), { recursive: true })
  fs.writeFileSync(path.join(WORKSPACE, 'project.db'), Buffer.from(db.export()))
  db.close()

  console.log(`SEED_OK ${WORKSPACE} (120 nota, 3 projek)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
