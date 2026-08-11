/// <reference types="vite/client" />

type Row = Record<string, unknown>

export interface Project {
  id: string
  desk_id: string | null
  owner_id: string | null
  subkon_id: string | null
  name: string
  contract_value: number
  start_date: string | null
  durasi_mou: string | null
  status: string
  resume: string | null
  notes: string | null
  desk_name?: string | null
  owner_name?: string | null
  subkon_name?: string | null
  subkon_names?: string | null
  subkon_ids?: string | null
}

export interface Nota {
  id: string
  date: string
  project_id: string | null
  suplier_id: string | null
  subkon_id?: string | null
  jenis: string
  rekening: string
  keterangan: string | null
  total: number
  payment_status?: string
  project_name?: string | null
  suplier_name?: string | null
  subkon_name?: string | null
  items_desc?: string | null
}

export interface NotaItem {
  id: string
  nota_id: string
  item_type: string
  item_id: string | null
  name: string
  unit: string | null
  price: number
  qty: number
  subtotal: number
  sort_order: number
}

export interface NotaPhoto {
  id: string
  nota_id: string
  file_name: string
  caption: string | null
  sort_order: number
}

export interface MasterRow {
  id: string
  name?: string
  [k: string]: unknown
}

export interface ElectronAPI {
  workspace: {
    getCurrent: () => Promise<{ path: string; name: string } | null>
    recent: () => Promise<{ path: string; name: string; lastOpened: string }[]>
    create: (info: { name: string }) => Promise<{ path: string; name: string } | null>
    open: () => Promise<{ path: string; name: string } | null>
    openPath: (path: string) => Promise<{ path: string; name: string } | null>
    removeRecent: (path: string) => Promise<boolean>
    rename: (name: string) => Promise<{ path: string; name: string } | null>
    export: () => Promise<{ ok: boolean; path?: string; canceled?: boolean }>
    import: () => Promise<{ ok: boolean; path?: string | null; name?: string; canceled?: boolean }>
  }
  db: {
    query: (sql: string, params?: unknown[]) => Promise<Row[]>
    get: (sql: string, params?: unknown[]) => Promise<Row | undefined>
    exec: (sql: string, params?: unknown[]) => Promise<boolean>
  }
  master: {
    list: (table: string) => Promise<MasterRow[]>
    insert: (table: string, row: Row) => Promise<MasterRow>
    update: (table: string, id: string, row: Row) => Promise<MasterRow>
    remove: (table: string, id: string) => Promise<boolean>
  }
  prices: {
    list: (table: 'material_prices' | 'subkon_prices') => Promise<MasterRow[]>
    upsert: (table: 'material_prices' | 'subkon_prices', row: Row) => Promise<boolean>
    remove: (table: 'material_prices' | 'subkon_prices', id: string) => Promise<boolean>
  }
  project: {
    list: () => Promise<Project[]>
    add: (row: Row) => Promise<Project>
    update: (id: string, row: Row) => Promise<Project>
    remove: (id: string) => Promise<boolean>
  }
  kebutuhan: {
    list: (projectId: string) => Promise<MasterRow[]>
    add: (row: Row) => Promise<MasterRow>
    update: (id: string, row: Row) => Promise<MasterRow>
    remove: (id: string) => Promise<boolean>
  }
  nota: {
    add: (data: Row) => Promise<Row>
    update: (id: string, data: Row) => Promise<Row>
    list: (opts: Row) => Promise<Nota[]>
    count: (opts: Row) => Promise<number>
    items: (notaId: string) => Promise<NotaItem[]>
    remove: (notaId: string) => Promise<boolean>
    setPayment: (notaId: string, status: string, paidAt?: string | null) => Promise<boolean>
  }
  photo: {
    stage: () => Promise<{ fileName: string; dataUrl: string }[]>
    attach: (notaId: string, fileNames: string[]) => Promise<number>
    list: (notaId: string) => Promise<NotaPhoto[]>
    read: (fileName: string) => Promise<string | null>
    remove: (photoId: string) => Promise<boolean>
    discard: (fileNames: string[]) => Promise<boolean>
  }
  transfer: {
    add: (data: Row) => Promise<Row>
    list: () => Promise<Row[]>
    remove: (id: string) => Promise<boolean>
  }
  finance: {
    summary: (opts: Row) => Promise<{ outflow: number; inflow: number; count: number; transferGlobalOut: number; transferGlobalIn: number }>
    project: (projectId: string) => Promise<{
      outflow: number
      inflow: number
      transferIn: number
      transferOut: number
      rekening: number
      piutangTermin: number
      piutangPinjam: number
      hutangPinjam: number
    }>
    globalSaldo: () => Promise<number>
    hutang: (projectId?: string | null) => Promise<number>
  }
  stock: {
    material: () => Promise<Row[]>
  }
  report: {
    export: (opts: {
      type: 'weekly' | 'monthly' | 'project'
      format: 'xlsx' | 'pdf'
      start?: string
      end?: string
      projectId?: string | null
    }) => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
