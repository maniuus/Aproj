import { useEffect, useState } from 'react'
import { useAppStore } from '../stores'
import { Card, CardBody, StatCard, EmptyNote, GhostButton, Badge, Confirm, Modal, PrimaryButton, DateInput } from '../components/ui'
import { fmtRupiah, fmtDate, isKeluar, jenisLabel, todayISO, errMsg } from '../lib/utils'
import NotaModal, { type NotaPayload } from '../components/NotaModal'
import type { Nota } from '../env.d'

export default function Cashflow({ onToast }: { onToast: (m: string) => void }) {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const projects = useAppStore((s) => s.projects)
  const [notas, setNotas] = useState<Nota[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Nota | null>(null)
  const [payNota, setPayNota] = useState<Nota | null>(null)
  const [payDate, setPayDate] = useState(todayISO())
  const [summary, setSummary] = useState({ outflow: 0, inflow: 0, count: 0 })
  const [saldoGlobal, setSaldoGlobal] = useState(0)
  const [showNota, setShowNota] = useState(false)
  const [from, setFrom] = useState<'workspace' | 'project'>('workspace')
  const [editNota, setEditNota] = useState<{ id: string; date: string; project_id: string | null; suplier_id: string | null; subkon_id?: string | null; jenis: string; keterangan: string | null; payment_status?: string } | null>(null)
  const [editItems, setEditItems] = useState<{ item_type: string; item_id: string | null; name: string; unit: string; price: number; qty: number; subtotal: number }[]>([])

  const PER_PAGE = 50

  const reload = () => {
    setLoading(true)
    window.electronAPI.nota
      .count({})
      .then(setTotal)
      .catch((e) => onToast(`Gagal memuat data: ${errMsg(e)}`))
    window.electronAPI.nota
      .list({ limit: PER_PAGE, offset: page * PER_PAGE })
      .then((rows) => {
        if (rows.length === 0 && page > 0) {
          setPage(page - 1)
          return
        }
        setNotas(rows)
      })
      .catch((e) => onToast(`Gagal memuat nota: ${errMsg(e)}`))
      .finally(() => setLoading(false))
    window.electronAPI.finance
      .summary({})
      .then((s) => setSummary({ outflow: s.outflow, inflow: s.inflow, count: s.count }))
      .catch((e) => onToast(`Gagal memuat ringkasan: ${errMsg(e)}`))
    window.electronAPI.finance
      .globalSaldo()
      .then(setSaldoGlobal)
      .catch((e) => onToast(`Gagal memuat saldo global: ${errMsg(e)}`))
  }

  useEffect(reload, [page])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setEditNota(null)
        setEditItems([])
        setFrom('workspace')
        setShowNota(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const saveNota = async (data: NotaPayload) => {
    try {
      let notaId = editNota?.id ?? null
      if (editNota) {
        await window.electronAPI.nota.update(editNota.id, data as never)
        onToast('Nota diperbarui')
      } else {
        const row = await window.electronAPI.nota.add(data as never)
        notaId = String((row as { id: string }).id)
        onToast('Nota tersimpan')
      }
      if (notaId && data.photos?.length) {
        await window.electronAPI.photo.attach(notaId, data.photos)
      }
      setShowNota(false)
      setEditNota(null)
      setEditItems([])
      setPage(0)
      reload()
    } catch (e) {
      onToast(`Gagal menyimpan nota: ${errMsg(e)}`)
    }
  }

  const doDelete = async () => {
    if (!confirmDel) return
    try {
      await window.electronAPI.nota.remove(confirmDel.id)
      setConfirmDel(null)
      onToast('Nota dihapus')
      reload()
    } catch (e) {
      onToast(`Gagal menghapus nota: ${errMsg(e)}`)
    }
  }

  const confirmPay = async () => {
    if (!payNota) return
    try {
      await window.electronAPI.nota.setPayment(payNota.id, 'terbayar', payDate || todayISO())
      setPayNota(null)
      onToast('Nota ditandai terbayar')
      reload()
    } catch (e) {
      onToast(`Gagal menandai terbayar: ${errMsg(e)}`)
    }
  }

  const openEdit = async (n: Nota) => {
    const items = await window.electronAPI.nota.items(n.id)
    setEditItems(
      items.map((i) => ({
        item_type: i.item_type,
        item_id: i.item_id,
        name: i.name,
        unit: i.unit ?? '',
        price: i.price,
        qty: i.qty,
        subtotal: i.subtotal
      }))
    )
    setEditNota({
      id: n.id,
      date: n.date,
      project_id: n.project_id,
      suplier_id: n.suplier_id,
      subkon_id: n.subkon_id ?? null,
      jenis: n.jenis,
      keterangan: n.keterangan,
      payment_status: n.payment_status ?? 'terbayar'
    })
    setFrom('workspace')
    setShowNota(true)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Saldo Global" value={fmtRupiah(saldoGlobal)} sub="dari rekening global" />
        <StatCard label="Outflow Periode" value={fmtRupiah(summary.outflow)} negative sub={`${summary.count} nota terpantau`} />
        <StatCard label="Inflow Periode" value={fmtRupiah(summary.inflow)} positive sub="semua projek" />
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-700">DAILY CASHFLOW</span>
          {loading && <span className="text-xs text-zinc-400">Memuat…</span>}
          <div className="flex gap-2 ml-auto">
            <GhostButton
              onClick={() => {
                setEditNota(null)
                setEditItems([])
                setFrom('workspace')
                setShowNota(true)
              }}
            >
              + Tambah Nota
            </GhostButton>
          </div>
        </div>
        {notas.length === 0 ? (
          <CardBody>
            <EmptyNote>Belum ada nota. Mulai dengan '+ Tambah Nota'.</EmptyNote>
          </CardBody>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Jenis</th>
                <th className="px-4 py-2.5">Uraian</th>
                <th className="px-4 py-2.5">Projek</th>
                <th className="px-4 py-2.5">Rekening</th>
                <th className="px-4 py-2.5 text-right">Jumlah</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-2.5">{fmtDate(n.date)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={isKeluar(n.jenis) ? 'red' : 'green'}>{jenisLabel(n.jenis)}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    {n.items_desc || n.keterangan || n.suplier_name || n.subkon_name || '—'}
                    {n.jenis === 'keluar-material' && n.suplier_name && <span className="text-zinc-400"> — {n.suplier_name}</span>}
                    {n.jenis === 'keluar-subkon' && n.subkon_name && <span className="text-zinc-400"> — {n.subkon_name}</span>}
                    {isKeluar(n.jenis) && (
                      <Badge tone={n.payment_status === 'hutang' ? 'amber' : 'green'}>{n.payment_status === 'hutang' ? 'Hutang' : 'Terbayar'}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{n.project_name || <span className="text-zinc-400">Tanpa projek</span>}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{n.rekening === 'global' ? 'Rek. Global' : 'Rek. Proyek'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${isKeluar(n.jenis) ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isKeluar(n.jenis) ? '-' : '+'}
                    {fmtRupiah(n.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {isKeluar(n.jenis) && (
                      <button
                        onClick={() => {
                          if (n.payment_status === 'hutang') {
                            setPayNota(n)
                            setPayDate(todayISO())
                          } else {
                            window.electronAPI.nota.setPayment(n.id, 'hutang').then(reload)
                          }
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 mr-2"
                        title={n.payment_status === 'hutang' ? 'Tandai terbayar' : 'Tandai hutang'}
                      >
                        {n.payment_status === 'hutang' ? '✓ Bayar' : '⧖ Hutang'}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(n)}
                      className="text-zinc-300 hover:text-amber-600 mr-1 px-1.5 py-1 rounded-md hover:bg-amber-50"
                      title="Edit nota"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDel(n)}
                      className="text-zinc-300 hover:text-red-500 px-1.5 py-1 rounded-md hover:bg-red-50"
                      title="Hapus nota"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Hal {page + 1} dari {totalPages} · {total} nota
            </span>
            <div className="flex gap-2">
              <GhostButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                ‹ Sebelumnya
              </GhostButton>
              <GhostButton onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Berikutnya ›
              </GhostButton>
            </div>
          </div>
        )}
      </Card>

      {showNota && (
        <NotaModal
          from={from}
          onClose={() => {
            setShowNota(false)
            setEditNota(null)
            setEditItems([])
          }}
          onSave={saveNota}
          onToast={onToast}
          defaultProjectId={activeProjectId}
          projects={projects}
          editNota={editNota}
          editItems={editItems}
        />
      )}

      <Confirm
        open={!!confirmDel}
        title="Hapus nota"
        message={`Yakin hapus nota "${confirmDel ? confirmDel.keterangan || confirmDel.suplier_name || confirmDel.id : ''}"?`}
        onCancel={() => setConfirmDel(null)}
        onConfirm={doDelete}
      />

      <Modal
        open={!!payNota}
        onClose={() => setPayNota(null)}
        title="Tandai Terbayar"
        sub={`${payNota ? fmtRupiah(payNota.total) : ''} · ${payNota ? payNota.keterangan || payNota.suplier_name || '' : ''}`}
        footer={
          <>
            <span className="flex-1" />
            <GhostButton onClick={() => setPayNota(null)}>Batal</GhostButton>
            <PrimaryButton onClick={confirmPay}>Simpan</PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs text-zinc-500 mb-1">Tanggal pembayaran</span>
            <DateInput value={payDate} onChange={setPayDate} placeholder="dd/mm/yy" />
          </label>
          <p className="text-xs text-zinc-500">Saldo rekening proyek baru berkurang pada tanggal ini.</p>
        </div>
      </Modal>
    </div>
  )
}
