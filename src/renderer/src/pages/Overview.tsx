import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores'
import { Card, CardBody, StatCard, EmptyNote } from '../components/ui'
import { fmtRupiah, fmtRupiahShort, todayISO, isKeluar } from '../lib/utils'

function isoWeekStart(d: Date): string {
  const day = d.getDay() || 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function isoWeekEnd(d: Date): string {
  const day = d.getDay() || 7
  const sunday = new Date(d)
  sunday.setDate(d.getDate() - day + 7)
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
}

function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function monthEnd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
}

function lastMonthRange(): { start: string; end: string } {
  const d = new Date()
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const last = new Date(d.getFullYear(), d.getMonth(), 0)
  return {
    start: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`,
    end: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  }
}

const PERIODS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'lastMonth', label: 'Bulan Lalu' }
]

export default function Overview({ onToast }: { onToast?: (m: string) => void }) {
  const projects = useAppStore((s) => s.projects)
  const [period, setPeriod] = useState('month')
  const [projectId, setProjectId] = useState<string>('')
  const [notas, setNotas] = useState<{ date: string; project_name?: string; total: number; jenis: string }[]>([])
  const [range, setRange] = useState({ start: monthStart(), end: todayISO() })
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx')
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    if (period === 'today') setRange({ start: todayISO(), end: todayISO() })
    else if (period === 'week') setRange({ start: isoWeekStart(now), end: todayISO() })
    else if (period === 'month') setRange({ start: monthStart(), end: todayISO() })
    else setRange(lastMonthRange())
  }, [period])

  useEffect(() => {
    window.electronAPI.nota
      .list({ start: range.start, end: range.end, projectId: projectId || null })
      .then((rows) =>
        setNotas(rows.map((r) => ({ date: r.date, project_name: r.project_name ?? undefined, total: r.total, jenis: r.jenis })))
      )
  }, [range, projectId])

  const { outflow, inflow } = useMemo(() => {
    let o = 0
    let i = 0
    notas.forEach((n) => (isKeluar(n.jenis) ? (o += n.total) : (i += n.total)))
    return { outflow: o, inflow: i }
  }, [notas])

  const byProject = useMemo(() => {
    const map = new Map<string, { outflow: number; inflow: number; count: number }>()
    notas.forEach((n) => {
      const key = n.project_name || 'Tanpa projek (operasional)'
      const cur = map.get(key) || { outflow: 0, inflow: 0, count: 0 }
      if (isKeluar(n.jenis)) cur.outflow += n.total
      else cur.inflow += n.total
      cur.count += 1
      map.set(key, cur)
    })
    return Array.from(map.entries()).sort((a, b) => b[1].outflow - a[1].outflow)
  }, [notas])

  const maxBar = Math.max(...notas.map((n) => n.total), 1)

  const runExport = async (type: 'weekly' | 'monthly') => {
    setExporting(type)
    const now = new Date()
    const start = type === 'weekly' ? isoWeekStart(now) : monthStart()
    const end = type === 'weekly' ? isoWeekEnd(now) : monthEnd()
    try {
      const res = await window.electronAPI.report.export({ type, format, start, end, projectId: projectId || null })
      if (res.canceled) return
      if (res.ok) onToast?.(`${type === 'weekly' ? 'Weekly' : 'Monthly'} Report ${format === 'pdf' ? 'PDF' : 'Excel'} tersimpan`)
      else onToast?.(res.error || 'Gagal export')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="px-2 py-1.5 text-sm border border-zinc-300 rounded-md bg-white"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="px-2 py-1.5 text-sm border border-zinc-300 rounded-md bg-white"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Semua Projek</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <select
          className="px-2 py-1.5 text-sm border border-zinc-300 rounded-md bg-white"
          value={format}
          onChange={(e) => setFormat(e.target.value as 'xlsx' | 'pdf')}
        >
          <option value="xlsx">Excel</option>
          <option value="pdf">PDF</option>
        </select>
        <button
          onClick={() => runExport('weekly')}
          disabled={exporting !== null}
          className="px-3 py-1.5 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-md disabled:opacity-50"
        >
          {exporting === 'weekly' ? '…' : 'Export Weekly'}
        </button>
        <button
          onClick={() => runExport('monthly')}
          disabled={exporting !== null}
          className="px-3 py-1.5 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-md disabled:opacity-50"
        >
          {exporting === 'monthly' ? '…' : 'Export Monthly'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Total Pengeluaran" value={fmtRupiah(outflow)} negative sub={`${range.start} s/d ${range.end}`} />
        <StatCard label="Total Pemasukan" value={fmtRupiah(inflow)} positive sub={`${notas.filter((n) => !isKeluar(n.jenis)).length} nota masuk`} />
        <StatCard label="Net" value={fmtRupiah(inflow - outflow)} positive={inflow >= outflow} negative={inflow < outflow} sub={`${notas.length} nota`} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-3">TREN HARIAN</div>
            {notas.length === 0 ? (
              <EmptyNote>Belum ada nota di periode ini</EmptyNote>
            ) : (
              <div className="flex items-end gap-1.5 h-32">
                {[...notas].reverse().slice(-14).map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className={`w-full rounded-t ${isKeluar(n.jenis) ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ height: `${Math.max(6, (n.total / maxBar) * 110)}px` }}
                      title={`${n.date} ${fmtRupiah(n.total)}`}
                    />
                    <span className="text-[9px] text-zinc-400">{n.date.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-3">PENGELUARAN PER PROYEK</div>
            {byProject.length === 0 ? (
              <EmptyNote>Belum ada data</EmptyNote>
            ) : (
              <div className="space-y-2">
                {byProject.map(([name, d]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 truncate">{name}</span>
                    <span className="font-semibold">{fmtRupiahShort(d.outflow)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="section-title flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-700">RINCIAN PER PROYEK</span>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
              <th className="px-4 py-2.5">Projek</th>
              <th className="px-4 py-2.5 text-right">Pengeluaran</th>
              <th className="px-4 py-2.5 text-right">Pemasukan</th>
              <th className="px-4 py-2.5 text-right">Net</th>
              <th className="px-4 py-2.5 text-right">Jml Nota</th>
            </tr>
          </thead>
          <tbody>
            {byProject.map(([name, d]) => (
              <tr key={name} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5 font-medium">{name}</td>
                <td className="px-4 py-2.5 text-right text-red-600">-{fmtRupiah(d.outflow)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600">+{fmtRupiah(d.inflow)}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${d.inflow - d.outflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmtRupiah(d.inflow - d.outflow)}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-500">{d.count}</td>
              </tr>
            ))}
            {byProject.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  Tidak ada data di periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
