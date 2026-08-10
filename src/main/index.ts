import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, extname, basename } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from 'fs'
import initSqlJs from 'sql.js'
import type { SqlJsStatic } from 'sql.js'
import AdmZip from 'adm-zip'
import { exportReport } from './report'

let db: initSqlJs.Database | null = null
let SQL: SqlJsStatic | null = null
let currentPath: string | null = null
const REGISTRY_PATH = join(app.getPath('userData'), 'aproj-recents.json')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, phone TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subkontraktors (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, phone TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS supliers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS desks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT 'sendiri', notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, desk_id TEXT, owner_id TEXT, subkon_id TEXT, name TEXT NOT NULL,
  contract_value INTEGER DEFAULT 0, start_date TEXT, durasi_mou TEXT, status TEXT DEFAULT 'aktif',
  resume TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS project_subkons (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, subkon_id TEXT NOT NULL,
  UNIQUE(project_id, subkon_id)
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, spesifikasi TEXT, unit TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS material_prices (
  id TEXT PRIMARY KEY, material_id TEXT NOT NULL, suplier_id TEXT NOT NULL, price INTEGER DEFAULT 0,
  UNIQUE(material_id, suplier_id)
);
CREATE TABLE IF NOT EXISTS tenaga_kerja (
  id TEXT PRIMARY KEY, jenis TEXT NOT NULL, unit TEXT DEFAULT 'OH', harga_satuan INTEGER DEFAULT 0, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pekerjas (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, tenaga_kerja_id TEXT, upah_harian INTEGER DEFAULT 0, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS alats (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT, harga_satuan INTEGER DEFAULT 0, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pekerjaans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT, harga_satuan INTEGER DEFAULT 0, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subkon_prices (
  id TEXT PRIMARY KEY, pekerjaan_id TEXT NOT NULL, subkon_id TEXT NOT NULL, price INTEGER DEFAULT 0,
  UNIQUE(pekerjaan_id, subkon_id)
);
CREATE TABLE IF NOT EXISTS gudangs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, lokasi TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kebutuhans (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, jenis TEXT NOT NULL, item_type TEXT, item_id TEXT,
  satuan TEXT, qty_rencana REAL DEFAULT 0, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notas (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, project_id TEXT, suplier_id TEXT,
  jenis TEXT NOT NULL, rekening TEXT DEFAULT 'proyek', keterangan TEXT, total INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'terbayar',
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS nota_items (
  id TEXT PRIMARY KEY, nota_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT,
  name TEXT NOT NULL, unit TEXT, price INTEGER DEFAULT 0, qty REAL DEFAULT 0, subtotal INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS nota_photos (
  id TEXT PRIMARY KEY, nota_id TEXT NOT NULL, file_name TEXT NOT NULL, caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, dari TEXT NOT NULL, ke TEXT NOT NULL,
  jumlah INTEGER DEFAULT 0, jenis TEXT DEFAULT 'pendanaan', keterangan TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nota_items_nota ON nota_items(nota_id);
CREATE INDEX IF NOT EXISTS idx_nota_photos_nota ON nota_photos(nota_id);
CREATE INDEX IF NOT EXISTS idx_notas_date ON notas(date);
CREATE INDEX IF NOT EXISTS idx_notas_project ON notas(project_id);
CREATE INDEX IF NOT EXISTS idx_kebutuhan_project ON kebutuhans(project_id);
`

function saveDB() {
  if (!db || !currentPath) return
  const data = db.export()
  writeFileSync(join(currentPath, 'project.db'), Buffer.from(data))
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

type SqlValue = number | string | Uint8Array | null

function exec(sql: string, params: SqlValue[] = []) {
  if (!db) throw new Error('Tidak ada workspace terbuka')
  db.exec(sql, params)
  saveDB()
}

function one(sql: string, params: SqlValue[] = []): Record<string, unknown> | undefined {
  if (!db) throw new Error('Tidak ada workspace terbuka')
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = stmt.step() ? stmt.getAsObject() : undefined
  stmt.free()
  return out
}

function all(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
  if (!db) throw new Error('Tidak ada workspace terbuka')
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function uuid() {
  return crypto.randomUUID()
}

function readRegistry(): { path: string; name: string; lastOpened: string }[] {
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function writeRegistry(reg: { path: string; name: string; lastOpened: string }[]) {
  try {
    writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2))
  } catch {
    /* ignore */
  }
}

function metaGet(key: string): string | null {
  const r = one('SELECT value FROM meta WHERE key = ?', [key])
  return r ? String(r.value) : null
}

function metaSet(key: string, value: string) {
  if (!db) return
  db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
  saveDB()
}

function workspaceName(): string {
  if (!currentPath) return 'Workspace'
  return metaGet('name') || currentPath.split(/[\\/]/).pop()?.replace(/\.apro$/, '') || 'Workspace'
}

function migrateColumns(table: string, cols: [string, string][]) {
  if (!db) return
  const info = db.exec(`PRAGMA table_info(${table})`)
  const existing = new Set(info[0]?.values.map((r) => r[1]) ?? [])
  cols.forEach(([name, def]) => {
    if (!existing.has(name)) {
      db!.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`)
    }
  })
}

function runMigrations() {
  if (!db) return
  // projects dari skema lama (sebelum refactor 2026-08) belum punya kolom relasi
  migrateColumns('projects', [
    ['desk_id', 'TEXT'],
    ['owner_id', 'TEXT'],
    ['subkon_id', 'TEXT'],
    ['durasi_mou', 'TEXT'],
    ['resume', 'TEXT']
  ])
  // projek dengan subkon_id tunggal (skema lama) → isi project_subkons
  const orphanSubkons = all(
    `SELECT id, subkon_id FROM projects WHERE subkon_id IS NOT NULL
     AND id NOT IN (SELECT project_id FROM project_subkons)`
  )
  orphanSubkons.forEach((p) => {
    if (p.subkon_id) {
      db!.run(
        `INSERT INTO project_subkons (id, project_id, subkon_id) VALUES (?, ?, ?)
         ON CONFLICT(project_id, subkon_id) DO NOTHING`,
        [uuid(), p.id, p.subkon_id] as SqlValue[]
      )
    }
  })
  migrateColumns('notas', [['payment_status', "TEXT DEFAULT 'terbayar'"]])
  saveDB()
}

async function openWorkspace(path: string) {
  ensureDir(path)
  ensureDir(join(path, 'photos'))
  const dbPath = join(path, 'project.db')
  let raw: Uint8Array
  if (existsSync(dbPath)) {
    raw = new Uint8Array(readFileSync(dbPath))
  } else {
    raw = new Uint8Array(0)
  }
  if (!SQL) SQL = await initSqlJs()
  db = new SQL.Database(raw)
  currentPath = path
  db.exec(SCHEMA)
  runMigrations()
  saveDB()
  const name = path.split(/[\\/]/).pop()?.replace(/\.apro$/, '')
  if (name && !metaGet('name')) metaSet('name', name)
  const reg = readRegistry().filter((r) => r.path !== path)
  reg.unshift({ path, name: workspaceName(), lastOpened: new Date().toISOString() })
  writeRegistry(reg.slice(0, 10))
}

// ---------------------------------------------------------------- PROJECTS

function projectName(id: string | null): string {
  if (!id) return 'Tanpa projek'
  const r = one('SELECT name FROM projects WHERE id = ?', [id])
  return r ? String(r.name) : 'Tanpa projek'
}

function setProjectSubkons(projectId: string, subkon_ids: unknown) {
  db!.run('DELETE FROM project_subkons WHERE project_id = ?', [projectId])
  const ids = Array.isArray(subkon_ids) ? subkon_ids.filter(Boolean) : []
  ids.forEach((sid) => {
    db!.run(
      `INSERT INTO project_subkons (id, project_id, subkon_id) VALUES (?, ?, ?)
       ON CONFLICT(project_id, subkon_id) DO NOTHING`,
      [uuid(), projectId, sid] as SqlValue[]
    )
  })
}

// ---------------------------------------------------------------- IPC: workspace

ipcMain.handle('workspace:getCurrent', () => {
  if (!db || !currentPath) return null
  return { path: currentPath, name: workspaceName() }
})

ipcMain.handle('workspace:recent', () => {
  return readRegistry()
})

ipcMain.handle('workspace:create', async (_e, info: { name: string }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Pilih lokasi untuk workspace baru',
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || filePaths.length === 0) return null
  const base = filePaths[0]
  const folder = join(base, `${info.name}.apro`)
  openWorkspace(folder)
  return { path: currentPath, name: workspaceName() }
})

ipcMain.handle('workspace:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Buka folder workspace (.apro)',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) return null
  openWorkspace(filePaths[0])
  return { path: currentPath, name: workspaceName() }
})

ipcMain.handle('workspace:openPath', async (_e, path: string) => {
  openWorkspace(path)
  return { path: currentPath, name: workspaceName() }
})

ipcMain.handle('workspace:removeRecent', (_e, path: string) => {
  writeRegistry(readRegistry().filter((r) => r.path !== path))
  return true
})

ipcMain.handle('workspace:rename', (_e, name: string) => {
  metaSet('name', name)
  return { path: currentPath, name: workspaceName() }
})

// ---------------------------------------------------------------- IPC: backup

ipcMain.handle('workspace:export', async () => {
  if (!currentPath || !db) throw new Error('Tidak ada workspace terbuka')
  saveDB()
  const win = BrowserWindow.getFocusedWindow() ?? undefined
  const name = workspaceName()
  const safe = name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'workspace'
  const res = await dialog.showSaveDialog(win!, {
    title: 'Backup Workspace',
    defaultPath: join(app.getPath('downloads'), `${safe}.aproj.zip`),
    filters: [{ name: 'AProj Backup', extensions: ['zip'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, canceled: true }
  const zip = new AdmZip()
  zip.addLocalFolder(currentPath)
  zip.writeZip(res.filePath)
  return { ok: true, path: res.filePath }
})

ipcMain.handle('workspace:import', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? undefined
  const open = await dialog.showOpenDialog(win!, {
    title: 'Pilih file backup AProj (.zip)',
    properties: ['openFile'],
    filters: [{ name: 'AProj Backup', extensions: ['zip'] }]
  })
  if (open.canceled || open.filePaths.length === 0) return { ok: false, canceled: true }
  const zipPath = open.filePaths[0]
  const zip = new AdmZip(zipPath)
  const hasDb = zip.getEntries().some((e) => e.entryName === 'project.db')
  if (!hasDb) throw new Error('File bukan backup AProj (tidak ada project.db)')
  const dest = await dialog.showOpenDialog(win!, {
    title: 'Pilih folder tujuan untuk restore',
    properties: ['openDirectory', 'createDirectory']
  })
  if (dest.canceled || dest.filePaths.length === 0) return { ok: false, canceled: true }
  const base = basename(zipPath).replace(/\.zip$/i, '').replace(/\.aproj$/i, '').replace(/[\\/:*?"<>|]+/g, '_') || 'workspace'
  const target = join(dest.filePaths[0], `${base}.apro`)
  if (existsSync(target)) throw new Error(`Folder "${base}.apro" sudah ada di lokasi itu`)
  ensureDir(target)
  ensureDir(join(target, 'photos'))
  zip.extractAllTo(target, true)
  openWorkspace(target)
  return { ok: true, path: currentPath, name: workspaceName() }
})

// ---------------------------------------------------------------- IPC: generic db

ipcMain.handle('db:query', (_e, sql: string, params?: SqlValue[]) => all(sql, params ?? []))
ipcMain.handle('db:get', (_e, sql: string, params?: SqlValue[]) => one(sql, params ?? []))
ipcMain.handle('db:exec', (_e, sql: string, params?: SqlValue[]) => {
  exec(sql, params ?? [])
  return true
})

// ---------------------------------------------------------------- IPC: master CRUD (generic pattern)

function crudHandlers(table: string) {
  const orderCol = table === 'tenaga_kerja' ? 'jenis' : 'name'
  ipcMain.handle(`master:list-${table}`, () => all(`SELECT * FROM ${table} ORDER BY ${orderCol}`))
  ipcMain.handle(`master:insert-${table}`, (_e, row: Record<string, unknown>) => {
    const id = uuid()
    const keys = Object.keys(row)
    const cols = ['id', ...keys, 'created_at', 'updated_at'].join(', ')
    const placeholders = ['?', ...keys.map(() => '?'), "datetime('now')", "datetime('now')"].join(', ')
    const vals = [id, ...Object.values(row)] as SqlValue[]
    db!.run(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, vals)
    saveDB()
    return one(`SELECT * FROM ${table} WHERE id = ?`, [id])
  })
  ipcMain.handle(`master:update-${table}`, (_e, id: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row)
    const set = [...keys.map((k) => `${k} = ?`), `updated_at = datetime('now')`].join(', ')
    db!.run(`UPDATE ${table} SET ${set} WHERE id = ?`, [...Object.values(row), id] as SqlValue[])
    saveDB()
    return one(`SELECT * FROM ${table} WHERE id = ?`, [id])
  })
  ipcMain.handle(`master:delete-${table}`, (_e, id: string) => {
    db!.run(`DELETE FROM ${table} WHERE id = ?`, [id])
    saveDB()
    return true
  })
}

const MASTER_TABLES = ['owners', 'subkontraktors', 'supliers', 'desks', 'materials', 'tenaga_kerja', 'pekerjas', 'alats', 'pekerjaans', 'gudangs']
MASTER_TABLES.forEach(crudHandlers)

// harga: material_prices & subkon_prices
ipcMain.handle('prices:list', (_e, table: 'material_prices' | 'subkon_prices') => {
  if (table === 'material_prices') {
    return all(
      `SELECT mp.id, mp.material_id, mp.suplier_id, mp.price, m.name AS material, m.unit, s.name AS suplier
       FROM material_prices mp JOIN materials m ON mp.material_id = m.id JOIN supliers s ON mp.suplier_id = s.id
       ORDER BY m.name, s.name`
    )
  }
  return all(
    `SELECT sp.id, sp.pekerjaan_id, sp.subkon_id, sp.price, p.name AS pekerjaan, p.unit, s.name AS subkon
     FROM subkon_prices sp JOIN pekerjaans p ON sp.pekerjaan_id = p.id JOIN subkontraktors s ON sp.subkon_id = s.id
     ORDER BY p.name, s.name`
  )
})
ipcMain.handle('prices:upsert', (_e, table: 'material_prices' | 'subkon_prices', row: Record<string, unknown>) => {
  const refKey = table === 'material_prices' ? 'material_id' : 'pekerjaan_id'
  const partyKey = table === 'material_prices' ? 'suplier_id' : 'subkon_id'
  const existing = one(
    `SELECT id FROM ${table} WHERE ${refKey} = ? AND ${partyKey} = ?`,
    [row[refKey] as SqlValue, row[partyKey] as SqlValue]
  )
  if (existing) {
    db!.run(`UPDATE ${table} SET price = ?, updated_at = datetime('now') WHERE id = ?`, [row.price as SqlValue, existing.id as SqlValue])
  } else {
    db!.run(
      `INSERT INTO ${table} (id, ${refKey}, ${partyKey}, price) VALUES (?, ?, ?, ?)`,
      [uuid(), row[refKey] as SqlValue, row[partyKey] as SqlValue, row.price as SqlValue]
    )
  }
  saveDB()
  return true
})
ipcMain.handle('prices:delete', (_e, table: 'material_prices' | 'subkon_prices', id: string) => {
  db!.run(`DELETE FROM ${table} WHERE id = ?`, [id])
  saveDB()
  return true
})

// ---------------------------------------------------------------- IPC: projects

ipcMain.handle('project:list', () => {
  return all(
    `SELECT p.*, d.name AS desk_name, o.name AS owner_name,
            (SELECT GROUP_CONCAT(sk.name, ', ')
             FROM project_subkons ps JOIN subkontraktors sk ON ps.subkon_id = sk.id
             WHERE ps.project_id = p.id) AS subkon_names,
            (SELECT GROUP_CONCAT(ps.subkon_id, ',')
             FROM project_subkons ps
             WHERE ps.project_id = p.id) AS subkon_ids
     FROM projects p
     LEFT JOIN desks d ON p.desk_id = d.id
     LEFT JOIN owners o ON p.owner_id = o.id
     ORDER BY p.name`
  )
})
ipcMain.handle('project:add', (_e, row: Record<string, unknown>) => {
  const id = uuid()
  const { subkon_ids, ...rest } = row
  const keys = Object.keys(rest)
  const cols = ['id', ...keys, 'created_at', 'updated_at'].join(', ')
  const placeholders = ['?', ...keys.map(() => '?'), "datetime('now')", "datetime('now')"].join(', ')
  db!.run(`INSERT INTO projects (${cols}) VALUES (${placeholders})`, [id, ...Object.values(rest)] as SqlValue[])
  setProjectSubkons(id, subkon_ids)
  saveDB()
  return one(`SELECT * FROM projects WHERE id = ?`, [id])
})
ipcMain.handle('project:update', (_e, id: string, row: Record<string, unknown>) => {
  const { subkon_ids, ...rest } = row
  const keys = Object.keys(rest)
  const set = [...keys.map((k) => `${k} = ?`), `updated_at = datetime('now')`].join(', ')
  db!.run(`UPDATE projects SET ${set} WHERE id = ?`, [...Object.values(rest), id] as SqlValue[])
  setProjectSubkons(id, subkon_ids)
  saveDB()
  return one(`SELECT * FROM projects WHERE id = ?`, [id])
})
ipcMain.handle('project:delete', (_e, id: string) => {
  db!.run('DELETE FROM project_subkons WHERE project_id = ?', [id])
  const notaIds = all('SELECT id FROM notas WHERE project_id = ?', [id]).map((r) => r.id)
  notaIds.forEach((nid) => {
    all('SELECT file_name FROM nota_photos WHERE nota_id = ?', [nid as SqlValue]).forEach((r) => deletePhotoFile(String(r.file_name)))
    db!.run('DELETE FROM nota_photos WHERE nota_id = ?', [nid as SqlValue])
    db!.run('DELETE FROM nota_items WHERE nota_id = ?', [nid as SqlValue])
  })
  db!.run('DELETE FROM notas WHERE project_id = ?', [id])
  db!.run('DELETE FROM kebutuhans WHERE project_id = ?', [id])
  db!.run('DELETE FROM projects WHERE id = ?', [id])
  saveDB()
  return true
})

// ---------------------------------------------------------------- IPC: kebutuhan

ipcMain.handle('kebutuhan:list', (_e, projectId: string) => {
  return all('SELECT * FROM kebutuhans WHERE project_id = ? ORDER BY jenis, item_type', [projectId])
})
ipcMain.handle('kebutuhan:add', (_e, row: Record<string, unknown>) => {
  const id = uuid()
  const keys = Object.keys(row)
  const cols = ['id', ...keys, 'created_at', 'updated_at'].join(', ')
  const placeholders = ['?', ...keys.map(() => '?'), "datetime('now')", "datetime('now')"].join(', ')
  db!.run(`INSERT INTO kebutuhans (${cols}) VALUES (${placeholders})`, [id, ...Object.values(row)] as SqlValue[])
  saveDB()
  return one(`SELECT * FROM kebutuhans WHERE id = ?`, [id])
})
ipcMain.handle('kebutuhan:update', (_e, id: string, row: Record<string, unknown>) => {
  const keys = Object.keys(row)
  const set = [...keys.map((k) => `${k} = ?`), `updated_at = datetime('now')`].join(', ')
  db!.run(`UPDATE kebutuhans SET ${set} WHERE id = ?`, [...Object.values(row), id] as SqlValue[])
  saveDB()
  return one(`SELECT * FROM kebutuhans WHERE id = ?`, [id])
})
ipcMain.handle('kebutuhan:delete', (_e, id: string) => {
  db!.run('DELETE FROM kebutuhans WHERE id = ?', [id])
  saveDB()
  return true
})

// ---------------------------------------------------------------- IPC: nota

ipcMain.handle('nota:add', async (_e, data: {
  date: string
  project_id: string | null
  suplier_id: string | null
  jenis: string
  rekening: string
  keterangan: string
  payment_status?: string
  items: { item_type: string; item_id: string | null; name: string; unit: string; price: number; qty: number; subtotal: number }[]
}) => {
  const id = uuid()
  const total = data.items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
  db!.run(
    `INSERT INTO notas (id, date, project_id, suplier_id, jenis, rekening, keterangan, total, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.date, data.project_id, data.suplier_id, data.jenis, data.rekening, data.keterangan, total, data.payment_status || 'terbayar']
  )
  data.items.forEach((item, i) => {
    db!.run(
      `INSERT INTO nota_items (id, nota_id, item_type, item_id, name, unit, price, qty, subtotal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), id, item.item_type, item.item_id, item.name, item.unit, item.price, item.qty, item.subtotal, i]
    )
  })
  saveDB()
  return one(`SELECT * FROM notas WHERE id = ?`, [id])
})

function notaWhere(opts: { start?: string; end?: string; projectId?: string | null; jenis?: string }): [string, SqlValue[]] {
  const where: string[] = []
  const params: SqlValue[] = []
  if (opts.start) { where.push('date >= ?'); params.push(opts.start) }
  if (opts.end) { where.push('date <= ?'); params.push(opts.end) }
  if (opts.projectId) { where.push('project_id = ?'); params.push(opts.projectId) }
  if (opts.jenis) { where.push('jenis = ?'); params.push(opts.jenis) }
  return [where.length ? 'WHERE ' + where.join(' AND ') : '', params]
}

ipcMain.handle('nota:list', (_e, opts: { start?: string; end?: string; projectId?: string | null; jenis?: string; limit?: number; offset?: number }) => {
  const [whereSql, params] = notaWhere(opts)
  let sql = `SELECT n.*, p.name AS project_name, s.name AS suplier_name
     FROM notas n
     LEFT JOIN projects p ON n.project_id = p.id
     LEFT JOIN supliers s ON n.suplier_id = s.id
     ${whereSql} ORDER BY n.date DESC, n.created_at DESC`
  const limit = Number(opts.limit) || 0
  const offset = Number(opts.offset) || 0
  if (limit > 0) sql += ` LIMIT ${limit}${offset > 0 ? ` OFFSET ${offset}` : ''}`
  return all(sql, params)
})

ipcMain.handle('nota:count', (_e, opts: { start?: string; end?: string; projectId?: string | null; jenis?: string }) => {
  const [whereSql, params] = notaWhere(opts)
  const row = one(`SELECT COUNT(*) AS c FROM notas ${whereSql}`, params)
  return Number(row?.c ?? 0)
})

ipcMain.handle('nota:items', (_e, notaId: string) => {
  return all('SELECT * FROM nota_items WHERE nota_id = ? ORDER BY sort_order', [notaId])
})

ipcMain.handle('nota:delete', (_e, notaId: string) => {
  all('SELECT file_name FROM nota_photos WHERE nota_id = ?', [notaId]).forEach((r) => deletePhotoFile(String(r.file_name)))
  db!.run('DELETE FROM nota_photos WHERE nota_id = ?', [notaId])
  db!.run('DELETE FROM nota_items WHERE nota_id = ?', [notaId])
  db!.run('DELETE FROM notas WHERE id = ?', [notaId])
  saveDB()
  return true
})

ipcMain.handle('nota:setPayment', (_e, notaId: string, status: string) => {
  db!.run(`UPDATE notas SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`, [status, notaId])
  saveDB()
  return true
})

// ---------------------------------------------------------------- IPC: foto nota

function photosDir() {
  return join(currentPath ?? '', 'photos')
}

function deletePhotoFile(fileName: string) {
  if (!currentPath) return
  const p = join(photosDir(), fileName)
  if (existsSync(p)) unlinkSync(p)
}

ipcMain.handle('photo:stage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Pilih foto untuk nota',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Gambar', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
      { name: 'Semua file', extensions: ['*'] }
    ]
  })
  if (canceled || filePaths.length === 0) return []
  ensureDir(photosDir())
  return filePaths.map((src) => {
    const ext = extname(src).toLowerCase() || '.jpg'
    const fileName = `${uuid()}${ext}`
    copyFileSync(src, join(photosDir(), fileName))
    const data = readFileSync(join(photosDir(), fileName))
    const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    return { fileName, dataUrl: `data:${mime};base64,${data.toString('base64')}` }
  })
})

ipcMain.handle('photo:attach', (_e, notaId: string, fileNames: string[]) => {
  const names = Array.isArray(fileNames) ? fileNames.filter(Boolean) : []
  names.forEach((fn, i) => {
    db!.run(
      `INSERT INTO nota_photos (id, nota_id, file_name, sort_order) VALUES (?, ?, ?, ?)`,
      [uuid(), notaId, fn, i]
    )
  })
  saveDB()
  return names.length
})

ipcMain.handle('photo:list', (_e, notaId: string) => {
  return all('SELECT * FROM nota_photos WHERE nota_id = ? ORDER BY sort_order, created_at', [notaId])
})

ipcMain.handle('photo:read', (_e, fileName: string) => {
  if (!currentPath) return null
  const p = join(photosDir(), fileName)
  if (!existsSync(p)) return null
  const ext = extname(fileName).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`
})

ipcMain.handle('photo:remove', (_e, photoId: string) => {
  const row = one('SELECT * FROM nota_photos WHERE id = ?', [photoId])
  if (row) {
    deletePhotoFile(String(row.file_name))
    db!.run('DELETE FROM nota_photos WHERE id = ?', [photoId])
  }
  saveDB()
  return true
})

ipcMain.handle('photo:discard', (_e, fileNames: string[]) => {
  const names = Array.isArray(fileNames) ? fileNames.filter(Boolean) : []
  names.forEach(deletePhotoFile)
  return true
})

ipcMain.handle('nota:update', async (_e, notaId: string, data: {
  date: string
  project_id: string | null
  suplier_id: string | null
  jenis: string
  rekening: string
  keterangan: string
  payment_status?: string
  items: { item_type: string; item_id: string | null; name: string; unit: string; price: number; qty: number; subtotal: number }[]
}) => {
  const total = data.items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
  db!.run(
    `UPDATE notas SET date = ?, project_id = ?, suplier_id = ?, jenis = ?, rekening = ?, keterangan = ?, total = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`,
    [data.date, data.project_id, data.suplier_id, data.jenis, data.rekening, data.keterangan, total, data.payment_status || 'terbayar', notaId]
  )
  db!.run('DELETE FROM nota_items WHERE nota_id = ?', [notaId])
  data.items.forEach((item, i) => {
    db!.run(
      `INSERT INTO nota_items (id, nota_id, item_type, item_id, name, unit, price, qty, subtotal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), notaId, item.item_type, item.item_id, item.name, item.unit, item.price, item.qty, item.subtotal, i]
    )
  })
  saveDB()
  return one(`SELECT * FROM notas WHERE id = ?`, [notaId])
})

// ---------------------------------------------------------------- IPC: transfer

ipcMain.handle('transfer:add', async (_e, data: { date: string; dari: string; ke: string; jumlah: number; jenis: string; keterangan: string }) => {
  const id = uuid()
  db!.run(
    `INSERT INTO transfers (id, date, dari, ke, jumlah, jenis, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.date, data.dari, data.ke, data.jumlah, data.jenis, data.keterangan]
  )
  saveDB()
  return one(`SELECT * FROM transfers WHERE id = ?`, [id])
})
ipcMain.handle('transfer:list', () => {
  return all('SELECT * FROM transfers ORDER BY date DESC, created_at DESC')
})
ipcMain.handle('transfer:delete', (_e, id: string) => {
  db!.run('DELETE FROM transfers WHERE id = ?', [id])
  saveDB()
  return true
})

// ---------------------------------------------------------------- IPC: finance summaries

ipcMain.handle('finance:summary', async (_e, opts: { start?: string; end?: string; projectId?: string | null }) => {
  const where: string[] = []
  const params: SqlValue[] = []
  if (opts.start) { where.push('n.date >= ?'); params.push(opts.start) }
  if (opts.end) { where.push('n.date <= ?'); params.push(opts.end) }
  if (opts.projectId) { where.push('n.project_id = ?'); params.push(opts.projectId) }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const totalQ = one(
    `SELECT COALESCE(SUM(CASE WHEN n.jenis LIKE 'keluar%' THEN n.total ELSE 0 END), 0) AS outflow,
            COALESCE(SUM(CASE WHEN n.jenis = 'masuk' THEN n.total ELSE 0 END), 0) AS inflow,
            COUNT(*) AS count
     FROM notas n ${whereSql}`,
    params
  )
  const totalT = one(
    `SELECT COALESCE(SUM(CASE WHEN t.dari = 'global' THEN t.jumlah ELSE 0 END), 0) AS global_out,
            COALESCE(SUM(CASE WHEN t.ke = 'global' THEN t.jumlah ELSE 0 END), 0) AS global_in
     FROM transfers t`,
    []
  )
  return {
    outflow: Number(totalQ?.outflow ?? 0),
    inflow: Number(totalQ?.inflow ?? 0),
    count: Number(totalQ?.count ?? 0),
    transferGlobalOut: Number(totalT?.global_out ?? 0),
    transferGlobalIn: Number(totalT?.global_in ?? 0)
  }
})

ipcMain.handle('finance:project', (_e, projectId: string) => {
  const outflow = one(
    `SELECT COALESCE(SUM(total), 0) AS v FROM notas WHERE project_id = ? AND jenis LIKE 'keluar%' AND rekening = 'proyek'`,
    [projectId]
  )
  const inflow = one(
    `SELECT COALESCE(SUM(total), 0) AS v FROM notas WHERE project_id = ? AND jenis = 'masuk'`,
    [projectId]
  )
  const transferIn = one(
    `SELECT COALESCE(SUM(jumlah), 0) AS v FROM transfers WHERE ke = ?`,
    [projectId]
  )
  const transferOut = one(
    `SELECT COALESCE(SUM(jumlah), 0) AS v FROM transfers WHERE dari = ?`,
    [projectId]
  )
  // piutang termin belum cair = nilai kontrak − termin yang sudah terbayar (nota masuk projek ini)
  const kontrak = one(`SELECT COALESCE(contract_value, 0) AS v FROM projects WHERE id = ?`, [projectId])
  // pinjam antar proyek: jenis transfer 'pinjam' (dari/ke bukan 'global')
  const piutangPinjam = one(
    `SELECT COALESCE(SUM(jumlah), 0) AS v FROM transfers WHERE dari = ? AND jenis = 'pinjam'`,
    [projectId]
  )
  const hutangPinjam = one(
    `SELECT COALESCE(SUM(jumlah), 0) AS v FROM transfers WHERE ke = ? AND jenis = 'pinjam'`,
    [projectId]
  )
  const o = Number(outflow?.v ?? 0)
  const i = Number(inflow?.v ?? 0)
  const tIn = Number(transferIn?.v ?? 0)
  const tOut = Number(transferOut?.v ?? 0)
  return {
    outflow: o,
    inflow: i,
    transferIn: tIn,
    transferOut: tOut,
    rekening: i + tIn - o - tOut,
    piutangTermin: Math.max(Number(kontrak?.v ?? 0) - i, 0),
    piutangPinjam: Number(piutangPinjam?.v ?? 0),
    hutangPinjam: Number(hutangPinjam?.v ?? 0)
  }
})

ipcMain.handle('finance:globalSaldo', () => {
  // saldo global = masuk ke rekening global (nota masuk TANPA projek + transfer masuk) − keluar dari rekening global
  // (nota keluar dengan rekening 'global' + transfer keluar)
  // Catatan: nota masuk yang terikat projek dihitung sebagai inflow rekening projek (finance:project), bukan global —
  // supaya tidak double-count di Total Aset (BalanceSheet).
  const inNotas = one(`SELECT COALESCE(SUM(total), 0) AS v FROM notas WHERE jenis = 'masuk' AND project_id IS NULL`, [])
  const outNotas = one(`SELECT COALESCE(SUM(total), 0) AS v FROM notas WHERE rekening = 'global' AND jenis LIKE 'keluar%'`, [])
  const tIn = one(`SELECT COALESCE(SUM(jumlah), 0) AS v FROM transfers WHERE ke = 'global'`, [])
  const tOut = one(`SELECT COALESCE(SUM(jumlah), 0) AS v FROM transfers WHERE dari = 'global'`, [])
  return Number(inNotas?.v ?? 0) + Number(tIn?.v ?? 0) - Number(outNotas?.v ?? 0) - Number(tOut?.v ?? 0)
})

ipcMain.handle('finance:hutang', (_e, projectId?: string | null) => {
  // hutang = total nota keluar (material) yang belum dibayar (payment_status = 'hutang')
  const where: string[] = [`n.jenis LIKE 'keluar%'`, `n.payment_status = 'hutang'`]
  const params: SqlValue[] = []
  if (projectId) { where.push('n.project_id = ?'); params.push(projectId) }
  else if (projectId === null) { where.push('n.project_id IS NULL'); params.push() }
  const q = one(
    `SELECT COALESCE(SUM(n.total), 0) AS v FROM notas n WHERE ${where.join(' AND ')}`,
    params
  )
  return Number(q?.v ?? 0)
})

// ---------------------------------------------------------------- IPC: stock gudang

ipcMain.handle('stock:material', () => {
  // stok material = akumulasi qty pembelian (nota keluar material) − terpakai (belum dicatat terpisah → = kebutuhan realisasi minimal)
  return all(
    `SELECT ni.item_id AS material_id, m.name, m.unit,
            COALESCE(SUM(ni.qty), 0) AS purchased
     FROM nota_items ni
     JOIN materials m ON ni.item_id = m.id
     JOIN notas n ON ni.nota_id = n.id
     WHERE ni.item_type = 'material' AND n.jenis = 'keluar-material'
     GROUP BY ni.item_id, m.name, m.unit
     ORDER BY m.name`
  )
})

// ---------------------------------------------------------------- IPC: report export

ipcMain.handle('report:export', async (_e, opts: { type: 'weekly' | 'monthly' | 'project'; format: 'xlsx' | 'pdf'; start?: string; end?: string; projectId?: string | null }) => {
  try {
    const res = await exportReport(opts, {
      all: (sql, params) => all(sql, params as SqlValue[]),
      one: (sql, params) => one(sql, params as SqlValue[])
    })
    return res
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

// ---------------------------------------------------------------- window

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.log('[renderer]', message)
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
