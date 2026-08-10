import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores'
import { Card, CardBody, StatCard, EmptyNote, selectCls, Field, Modal, PrimaryButton, GhostButton, inputCls } from '../components/ui'
import { fmtRupiah, fmtRupiahShort, todayISO, isKeluar } from '../lib/utils'
import type { MasterRow, Nota } from '../env.d'

function isoWeekStart(d: Date): string {
  const day = d.getDay() || 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

export default function Desk({ onToast }: { onToast: (m: string) => void }) {
  const projects = useAppStore((s) => s.projects)
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const [desks, setDesks] = useState<MasterRow[]>([])
  const [deskId, setDeskId] = useState('')
  const [notas, setNotas] = useState<Nota[]>([])
  const [saldoGlobal, setSaldoGlobal] = useState(0)
  const [rek, setRek] = useState<Record<string, number>>({})
  const [showDesk, setShowDesk] = useState(false)
  const [deskName, setDeskName] = useState('')
  const [deskNotes, setDeskNotes] = useState('')

  const week = useMemo(() => ({ start: isoWeekStart(new Date()), end: todayISO() }), [])

  const deskProjects = useMemo(() => projects.filter((p) => p.desk_id === deskId), [projects, deskId])
  const deskIds = useMemo(() => new Set(deskProjects.map((p) => p.id)), [deskProjects])

  const loadDesks = () => {
    window.electronAPI.master.list('desks').then((rows) => {
      setDesks(rows)
      if (rows.length) setDeskId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : String(rows[0].id)))
    })
  }

  useEffect(() => {
    loadDesks()
  }, [])

  const createDesk = async () => {
    if (!deskName.trim()) return
    const row = { name: deskName.trim(), notes: deskNotes.trim() }
    const d = await window.electronAPI.master.insert('desks', row)
    setDeskId(String(d.id))
    setShowDesk(false)
    setDeskName('')
    setDeskNotes('')
    onToast('Desk dibuat')
    loadDesks()
  }

  useEffect(() => {
    window.electronAPI.finance.globalSaldo().then(setSaldoGlobal)
  }, [])

  useEffect(() => {
    if (!deskId) return
    window.electronAPI.nota.list({ start: week.start, end: week.end }).then((rows) => {
      setNotas(rows.filter((n) => n.project_id && deskIds.has(n.project_id)))
    })
    Promise.all(
      deskProjects.map((p) => window.electronAPI.finance.project(p.id).then((f) => ({ id: p.id, rekening: f.rekening })))
    ).then((rows) => {
      const map: Record<string, number> = {}
      rows.forEach((r) => (map[r.id] = r.rekening))
      setRek(map)
    })
  }, [deskId, week.start, week.end, deskIds, deskProjects])

  const outflowWeek = notas.filter((n) => isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0)
  const inflowWeek = notas.filter((n) => !isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0)

  const byProject = useMemo(() => {
    const map = new Map<string, number>()
    notas.forEach((n) => {
      if (!isKeluar(n.jenis)) return
      const name = n.project_name || 'Tanpa projek'
      map.set(name, (map.get(name) ?? 0) + n.total)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [notas])

  const maxBar = Math.max(...byProject.map(([, v]) => v), 1)

  const weekly = useMemo(() => {
    const days: string[] = []
    const cur = new Date(week.start)
    while (cur.toISOString().slice(0, 10) <= week.end) {
      days.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return days.map((d) => {
      const dayNotas = notas.filter((n) => n.date === d)
      const out = dayNotas.filter((n) => isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0)
      const inn = dayNotas.filter((n) => !isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0)
      return { date: d, net: inn - out }
    })
  }, [notas, week])

  const maxWeekly = Math.max(...weekly.map((w) => Math.abs(w.net)), 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm font-semibold text-zinc-700">Desk</span>
        <select
          className={selectCls}
          value={deskId}
          onChange={(e) => setDeskId(e.target.value)}
        >
          {desks.length === 0 && <option value="">— Belum ada desk —</option>}
          {desks.map((d) => (
            <option key={d.id} value={d.id}>
              {String(d.name)}
            </option>
          ))}
        </select>
        {desks.length === 0 && (
          <span className="text-xs text-zinc-400">Buat desk di Master Data → Desk untuk mengelompokkan projek.</span>
        )}
        <span className="ml-auto" />
        <GhostButton onClick={() => setShowDesk(true)} className="text-xs px-3 py-1.5">
          + Desk Baru
        </GhostButton>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Rekening Global" value={fmtRupiah(saldoGlobal)} sub="di level desk juga tampil" />
        <StatCard label="Outflow Minggu Ini" value={fmtRupiah(outflowWeek)} negative sub={`${deskProjects.length} projek`} />
        <StatCard label="Inflow Minggu Ini" value={fmtRupiah(inflowWeek)} positive sub="termin masuk" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-3">
              AGREGAT OUTFLOW · MINGGU INI
            </div>
            {byProject.length === 0 ? (
              <EmptyNote>Belum ada pengeluaran minggu ini</EmptyNote>
            ) : (
              <div className="flex items-end gap-4 h-32">
                {byProject.map(([name, v]) => (
                  <div key={name} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full bg-red-400 rounded-t" style={{ height: `${Math.max(6, (v / maxBar) * 100)}px` }} title={fmtRupiah(v)} />
                    <span className="text-[10px] text-zinc-500 truncate w-full text-center">{fmtRupiahShort(v)}</span>
                    <span className="text-[10px] text-zinc-400 truncate w-full text-center">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-3">WEEKLY CASHFLOW DESK</div>
            {weekly.length === 0 || notas.length === 0 ? (
              <EmptyNote>Belum ada nota minggu ini</EmptyNote>
            ) : (
              <div className="flex items-end gap-4 h-32">
                {weekly.map((w) => (
                  <div key={w.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className={`w-full rounded-t ${w.net >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ height: `${Math.max(4, (Math.abs(w.net) / maxWeekly) * 100)}px` }}
                      title={`${w.date} ${fmtRupiah(w.net)}`}
                    />
                    <span className="text-[10px] text-zinc-400">{w.date.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-700">PROYEK DALAM DESK</span>
      </div>
      <Card>
        {deskProjects.length === 0 ? (
          <CardBody>
            <EmptyNote>Belum ada projek di desk ini</EmptyNote>
          </CardBody>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
                <th className="px-4 py-2.5">Projek Aktif</th>
                <th className="px-4 py-2.5 text-right">Rek. Proyek</th>
                <th className="px-4 py-2.5 text-right">Outflow Minggu Ini</th>
              </tr>
            </thead>
            <tbody>
              {deskProjects.map((p) => {
                const out = notas.filter((n) => n.project_id === p.id && isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0)
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 hover:bg-amber-50 cursor-pointer"
                    onClick={() => {
                      setActiveProjectId(p.id)
                      setActiveTab('projek')
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {p.name}
                      {p.subkon_names && <span className="text-zinc-400 font-normal"> · {p.subkon_names}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtRupiah(rek[p.id] ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">-{fmtRupiah(out)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={showDesk}
        onClose={() => setShowDesk(false)}
        title="+ Desk Baru"
        sub="· kelompok projek untuk agregasi & cashflow"
        footer={
          <>
            <span className="flex-1" />
            <GhostButton onClick={() => setShowDesk(false)}>Batal</GhostButton>
            <PrimaryButton disabled={!deskName.trim()} onClick={createDesk}>
              Simpan
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nama Desk" req>
            <input
              className={inputCls}
              value={deskName}
              onChange={(e) => setDeskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createDesk()}
              placeholder="Contoh: PT Mitra Bangun"
              autoFocus
            />
          </Field>
          <Field label="Catatan">
            <input className={inputCls} value={deskNotes} onChange={(e) => setDeskNotes(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
