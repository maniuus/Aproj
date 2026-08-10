import { contextBridge, ipcRenderer } from 'electron'

type Row = Record<string, unknown>

const api = {
  workspace: {
    getCurrent: (): Promise<{ path: string; name: string } | null> => ipcRenderer.invoke('workspace:getCurrent'),
    recent: (): Promise<{ path: string; name: string; lastOpened: string }[]> => ipcRenderer.invoke('workspace:recent'),
    create: (info: { name: string }) => ipcRenderer.invoke('workspace:create', info),
    open: () => ipcRenderer.invoke('workspace:open'),
    openPath: (path: string) => ipcRenderer.invoke('workspace:openPath', path),
    removeRecent: (path: string) => ipcRenderer.invoke('workspace:removeRecent', path),
    rename: (name: string) => ipcRenderer.invoke('workspace:rename', name),
    export: () => ipcRenderer.invoke('workspace:export'),
    import: () => ipcRenderer.invoke('workspace:import')
  },
  db: {
    query: (sql: string, params?: unknown[]): Promise<Row[]> => ipcRenderer.invoke('db:query', sql, params),
    get: (sql: string, params?: unknown[]): Promise<Row | undefined> => ipcRenderer.invoke('db:get', sql, params),
    exec: (sql: string, params?: unknown[]): Promise<boolean> => ipcRenderer.invoke('db:exec', sql, params)
  },
  master: {
    list: (table: string) => ipcRenderer.invoke(`master:list-${table}`),
    insert: (table: string, row: Row) => ipcRenderer.invoke(`master:insert-${table}`, row),
    update: (table: string, id: string, row: Row) => ipcRenderer.invoke(`master:update-${table}`, id, row),
    remove: (table: string, id: string) => ipcRenderer.invoke(`master:delete-${table}`, id)
  },
  prices: {
    list: (table: 'material_prices' | 'subkon_prices') => ipcRenderer.invoke('prices:list', table),
    upsert: (table: 'material_prices' | 'subkon_prices', row: Row) => ipcRenderer.invoke('prices:upsert', table, row),
    remove: (table: 'material_prices' | 'subkon_prices', id: string) => ipcRenderer.invoke('prices:delete', table, id)
  },
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    add: (row: Row) => ipcRenderer.invoke('project:add', row),
    update: (id: string, row: Row) => ipcRenderer.invoke('project:update', id, row),
    remove: (id: string) => ipcRenderer.invoke('project:delete', id)
  },
  kebutuhan: {
    list: (projectId: string) => ipcRenderer.invoke('kebutuhan:list', projectId),
    add: (row: Row) => ipcRenderer.invoke('kebutuhan:add', row),
    update: (id: string, row: Row) => ipcRenderer.invoke('kebutuhan:update', id, row),
    remove: (id: string) => ipcRenderer.invoke('kebutuhan:delete', id)
  },
  nota: {
    add: (data: Row) => ipcRenderer.invoke('nota:add', data),
    update: (id: string, data: Row) => ipcRenderer.invoke('nota:update', id, data),
    list: (opts: Row) => ipcRenderer.invoke('nota:list', opts),
    count: (opts: Row) => ipcRenderer.invoke('nota:count', opts),
    items: (notaId: string) => ipcRenderer.invoke('nota:items', notaId),
    remove: (notaId: string) => ipcRenderer.invoke('nota:delete', notaId),
    setPayment: (notaId: string, status: string) => ipcRenderer.invoke('nota:setPayment', notaId, status)
  },
  photo: {
    stage: (): Promise<{ fileName: string; dataUrl: string }[]> => ipcRenderer.invoke('photo:stage'),
    attach: (notaId: string, fileNames: string[]) => ipcRenderer.invoke('photo:attach', notaId, fileNames),
    list: (notaId: string) => ipcRenderer.invoke('photo:list', notaId),
    read: (fileName: string) => ipcRenderer.invoke('photo:read', fileName),
    remove: (photoId: string) => ipcRenderer.invoke('photo:remove', photoId),
    discard: (fileNames: string[]) => ipcRenderer.invoke('photo:discard', fileNames)
  },
  transfer: {
    add: (data: Row) => ipcRenderer.invoke('transfer:add', data),
    list: () => ipcRenderer.invoke('transfer:list'),
    remove: (id: string) => ipcRenderer.invoke('transfer:delete', id)
  },
  finance: {
    summary: (opts: Row) => ipcRenderer.invoke('finance:summary', opts),
    project: (projectId: string) => ipcRenderer.invoke('finance:project', projectId),
    globalSaldo: () => ipcRenderer.invoke('finance:globalSaldo'),
    hutang: (projectId?: string | null) => ipcRenderer.invoke('finance:hutang', projectId)
  },
  stock: {
    material: () => ipcRenderer.invoke('stock:material')
  },
  report: {
    export: (opts: { type: 'weekly' | 'monthly' | 'project'; format: 'xlsx' | 'pdf'; start?: string; end?: string; projectId?: string | null }) =>
      ipcRenderer.invoke('report:export', opts)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
