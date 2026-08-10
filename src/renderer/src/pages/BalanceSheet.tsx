import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores'
import { Card, CardBody, StatCard, EmptyNote } from '../components/ui'
import { fmtRupiah } from '../lib/utils'
import type { Project } from '../env.d'

interface ProjFin {
  outflow: number
  inflow: number
  transferIn: number
  transferOut: number
  rekening: number
  piutangTermin: number
  piutangPinjam: number
  hutangPinjam: number
}

const EMPTY_FIN: ProjFin = { outflow: 0, inflow: 0, transferIn: 0, transferOut: 0, rekening: 0, piutangTermin: 0, piutangPinjam: 0, hutangPinjam: 0 }

export default function BalanceSheet() {
  const projects = useAppStore((s) => s.projects)
  const [finMap, setFinMap] = useState<Record<string, ProjFin>>({})
  const [globalSaldo, setGlobalSaldo] = useState(0)
  const [hutangMap, setHutangMap] = useState<Record<string, number>>({})
  const [hutangGlobal, setHutangGlobal] = useState(0)
  const [tab, setTab] = useState('global')

  useEffect(() => {
    window.electronAPI.finance.globalSaldo().then(setGlobalSaldo)
    window.electronAPI.finance.hutang().then(setHutangGlobal)
    Promise.all(projects.map((p) => window.electronAPI.finance.project(p.id))).then((res) => {
      const map: Record<string, ProjFin> = {}
      projects.forEach((p, i) => (map[p.id] = res[i]))
      setFinMap(map)
    })
    Promise.all(projects.map((p) => window.electronAPI.finance.hutang(p.id))).then((res) => {
      const map: Record<string, number> = {}
      projects.forEach((p, i) => (map[p.id] = res[i]))
      setHutangMap(map)
    })
  }, [projects])

  const rows = useMemo(
    () =>
      projects.map((p) => {
        const fin = finMap[p.id] ?? EMPTY_FIN
        const piutang = fin.piutangTermin + fin.piutangPinjam
        const hutang = (hutangMap[p.id] ?? 0) + fin.hutangPinjam
        return { project: p, fin, piutang, hutang }
      }),
    [projects, finMap, hutangMap]
  )

  const totalRekening = rows.reduce((s, r) => s + r.fin.rekening, 0)
  const totalPiutangTermin = rows.reduce((s, r) => s + r.fin.piutangTermin, 0)
  const totalHutangSupplier = rows.reduce((s, r) => s + (hutangMap[r.project.id] ?? 0), 0)

  // konsolidasi: pinjam antar proyek saling menghilang (piutang A = hutang B)
  const totalAset = totalRekening + globalSaldo + totalPiutangTermin
  const totalKewajiban = totalHutangSupplier + hutangGlobal
  const totalEkuitas = totalAset - totalKewajiban

  return (
    <div>
      <div className="flex gap-1.5 mb-5 flex-wrap">
        <button
          onClick={() => setTab('global')}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            tab === 'global' ? 'bg-amber-500 border-amber-500 text-white font-semibold' : 'bg-white border-zinc-300 text-zinc-600'
          }`}
        >
          Konsolidasi Global
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setTab(p.id)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              tab === p.id ? 'bg-amber-500 border-amber-500 text-white font-semibold' : 'bg-white border-zinc-300 text-zinc-600'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {tab === 'global' ? (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Total Aset" value={fmtRupiah(totalAset)} sub="saldo rekening proyek + rekening global + piutang termin" />
            <StatCard label="Total Kewajiban" value={fmtRupiah(totalKewajiban)} negative sub="hutang supplier / nota belum dibayar" />
            <StatCard label="Ekuitas" value={fmtRupiah(totalEkuitas)} positive={totalEkuitas >= 0} negative={totalEkuitas < 0} sub="Aset − Kewajiban" />
          </div>
          <Card>
            <div className="px-4 py-3 border-b border-zinc-200 text-sm font-semibold text-zinc-700">RINGKASAN PER PROJEK</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
                  <th className="px-4 py-2.5">Projek</th>
                  <th className="px-4 py-2.5 text-right">Saldo Rekening</th>
                  <th className="px-4 py-2.5 text-right">Piutang</th>
                  <th className="px-4 py-2.5 text-right">Hutang</th>
                  <th className="px-4 py-2.5 text-right">Ekuitas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.project.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium">{r.project.name}</td>
                    <td className="px-4 py-2.5 text-right">{fmtRupiah(r.fin.rekening)}</td>
                    <td className="px-4 py-2.5 text-right">{r.piutang > 0 ? fmtRupiah(r.piutang) : '0'}</td>
                    <td className="px-4 py-2.5 text-right">{r.hutang > 0 ? fmtRupiah(r.hutang) : '0'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtRupiah(r.fin.rekening + r.piutang - r.hutang)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                      Belum ada projek
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-amber-50">
                    <td className="px-4 py-2.5 font-bold">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmtRupiah(totalRekening)}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmtRupiah(rows.reduce((s, r) => s + r.piutang, 0))}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmtRupiah(rows.reduce((s, r) => s + r.hutang, 0))}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmtRupiah(rows.reduce((s, r) => s + (r.fin.rekening + r.piutang - r.hutang), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
        </div>
      ) : (
        <ProjPanel
          project={projects.find((p) => p.id === tab)}
          fin={finMap[tab]}
          hutang={hutangMap[tab] ?? 0}
        />
      )}
    </div>
  )
}

function ProjPanel({ project, fin, hutang }: { project?: Project; fin?: ProjFin; hutang: number }) {
  if (!project || !fin) return <EmptyNote>Projek tidak ditemukan</EmptyNote>
  const finf = { ...EMPTY_FIN, ...fin }
  const aset = finf.rekening + finf.piutangTermin + finf.piutangPinjam
  const kewajiban = hutang + finf.hutangPinjam
  const ekuitas = aset - kewajiban
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatCard label="Saldo Rekening" value={fmtRupiah(finf.rekening)} />
        <StatCard label="Ekuitas (Aset − Kewajiban)" value={fmtRupiah(ekuitas)} positive={ekuitas >= 0} negative={ekuitas < 0} sub="dana global diinvestasikan" />
      </div>
      <div className="grid grid-cols-2 gap-4 items-start">
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-2">ASET</div>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1.5 text-zinc-600">Saldo rekening</td><td className="py-1.5 text-right font-semibold">{fmtRupiah(finf.rekening)}</td></tr>
                <tr><td className="py-1.5 text-zinc-600">Piutang termin belum cair (kontrak − termin terbayar)</td><td className="py-1.5 text-right">{finf.piutangTermin > 0 ? fmtRupiah(finf.piutangTermin) : <span className="text-zinc-400">0</span>}</td></tr>
                <tr><td className="py-1.5 text-zinc-600">Piutang pinjam ke proyek lain</td><td className="py-1.5 text-right">{finf.piutangPinjam > 0 ? fmtRupiah(finf.piutangPinjam) : <span className="text-zinc-400">0</span>}</td></tr>
                <tr className="border-t border-zinc-200"><td className="py-1.5 font-bold">Total Aset</td><td className="py-1.5 text-right font-bold">{fmtRupiah(aset)}</td></tr>
              </tbody>
            </table>
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-2">KEWAJIBAN</div>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1.5 text-zinc-600">Hutang ke supplier</td><td className="py-1.5 text-right">{hutang > 0 ? fmtRupiah(hutang) : <span className="text-zinc-400">0</span>}</td></tr>
                  <tr><td className="py-1.5 text-zinc-600">Pinjaman dari proyek lain</td><td className="py-1.5 text-right">{finf.hutangPinjam > 0 ? fmtRupiah(finf.hutangPinjam) : <span className="text-zinc-400">0</span>}</td></tr>
                  <tr className="border-t border-zinc-200"><td className="py-1.5 font-bold">Total Kewajiban</td><td className="py-1.5 text-right font-bold">{fmtRupiah(kewajiban)}</td></tr>
                </tbody>
              </table>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-2">EKUITAS</div>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1.5 text-zinc-600">Ekuitas</td><td className="py-1.5 text-right font-bold text-amber-600">{fmtRupiah(ekuitas)}</td></tr>
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
