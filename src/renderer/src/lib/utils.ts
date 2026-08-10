export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function fmtRupiah(n: number | string | null | undefined): string {
  const v = Number(n) || 0
  const sign = v < 0 ? '-' : ''
  return `${sign}Rp ${Math.abs(v).toLocaleString('id-ID')}`
}

export function fmtRupiahShort(n: number | string | null | undefined): string {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000000000) return `${sign}Rp ${(abs / 1000000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`
  if (abs >= 1000000) return `${sign}Rp ${(abs / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`
  if (abs >= 1000) return `${sign}Rp ${(abs / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })}rb`
  return fmtRupiah(v)
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '-'
  const parts = d.split('-')
  if (parts.length !== 3) return d
  const [y, m, day] = parts
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${day}-${months[Number(m) - 1]}-${y}`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function esc(s: string): string {
  return s.replace(/'/g, "''")
}

export function uid(): string {
  return crypto.randomUUID()
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export const JENIS_OPTIONS = [
  { value: 'keluar-material', label: 'Keluar (material)' },
  { value: 'keluar-tenaga', label: 'Keluar (tenaga)' },
  { value: 'keluar-alat', label: 'Keluar (alat)' },
  { value: 'keluar-lain', label: 'Keluar (lain-lain)' },
  { value: 'masuk', label: 'Masuk (termin)' }
]

export function jenisLabel(j: string): string {
  return JENIS_OPTIONS.find((o) => o.value === j)?.label ?? j
}

export function isKeluar(j: string): boolean {
  return j.startsWith('keluar')
}
