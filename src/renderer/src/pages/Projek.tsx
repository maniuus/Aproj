import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores'
import { Card, CardBody, Field, GhostButton, Modal, PrimaryButton, DangerButton, MutedButton, Confirm, inputCls, selectCls, StatCard, EmptyNote, Badge, DateInput } from '../components/ui'
import { fmtRupiah, fmtDate, fmtRupiahShort, todayISO, isKeluar, jenisLabel, uid, errMsg } from '../lib/utils'
import NotaModal, { type NotaPayload } from '../components/NotaModal'
import type { Project, Nota, MasterRow } from '../env.d'

export default function Projek({ onToast }: { onToast: (m: string) => void }) {
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId)
  const setProjects = useAppStore((s) => s.setProjects)
  const [notas, setNotas] = useState<Nota[]>([])
  const [fin, setFin] = useState({ outflow: 0, inflow: 0, transferIn: 0, transferOut: 0, rekening: 0 })
  const [owners, setOwners] = useState<MasterRow[]>([])
  const [subkons, setSubkons] = useState<MasterRow[]>([])
  const [desks, setDesks] = useState<MasterRow[]>([])
  const [showProj, setShowProj] = useState(false)
  const [editProj, setEditProj] = useState<Project | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [ownerName, setOwnerName] = useState('')
  const [subkonName, setSubkonName] = useState('')
  const [subkonIds, setSubkonIds] = useState<string[]>([])
  const [showNota, setShowNota] = useState(false)
  const [editNota, setEditNota] = useState<{ id: string; date: string; project_id: string | null; suplier_id: string | null; jenis: string; keterangan: string | null; payment_status?: string } | null>(null)
  const [editItems, setEditItems] = useState<{ item_type: string; item_id: string | null; name: string; unit: string; price: number; qty: number; subtotal: number }[]>([])
  const [showTransfer, setShowTransfer] = useState(false)
  const [needTab, setNeedTab] = useState<'material' | 'tenaga' | 'alat'>('material')
  const [needRows, setNeedRows] = useState<MasterRow[]>([])
  const [showNeed, setShowNeed] = useState(false)
  const [needForm, setNeedForm] = useState({ jenis: 'material', item_id: '', satuan: '', qty_rencana: '', notes: '' })
  const [editNeed, setEditNeed] = useState<MasterRow | null>(null)
  const [materials, setMaterials] = useState<MasterRow[]>([])
  const [tenaga, setTenaga] = useState<MasterRow[]>([])
  const [alats, setAlats] = useState<MasterRow[]>([])
  const [pekerjas, setPekerjas] = useState<MasterRow[]>([])
  const [personelModal, setPersonelModal] = useState<MasterRow | null>(null)
  const [confirmDelNota, setConfirmDelNota] = useState<Nota | null>(null)
  const [confirmDelNeed, setConfirmDelNeed] = useState<MasterRow | null>(null)
  const [confirmDelProj, setConfirmDelProj] = useState(false)

  const project = projects.find((p) => p.id === activeProjectId)

  const reload = useCallback(() => {
    if (!activeProjectId) return
    window.electronAPI.nota.list({ projectId: activeProjectId }).then(setNotas)
    window.electronAPI.finance.project(activeProjectId).then(setFin)
    window.electronAPI.kebutuhan.list(activeProjectId).then(setNeedRows)
  }, [activeProjectId])

  useEffect(() => {
    reload()
    window.electronAPI.master.list('owners').then(setOwners)
    window.electronAPI.master.list('subkontraktors').then(setSubkons)
    window.electronAPI.master.list('desks').then(setDesks)
    window.electronAPI.master.list('materials').then(setMaterials)
    window.electronAPI.master.list('tenaga_kerja').then(setTenaga)
    window.electronAPI.master.list('alats').then(setAlats)
    window.electronAPI.master.list('pekerjas').then(setPekerjas)
  }, [reload])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setEditNota(null)
        setEditItems([])
        setShowNota(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const outflow = useMemo(() => notas.filter((n) => isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0), [notas])
  const inflow = useMemo(() => notas.filter((n) => !isKeluar(n.jenis)).reduce((s, n) => s + n.total, 0), [notas])

  // kebutuhan stats: realisasi dari nota
  const needRealisasi = useMemo(() => {
    const res: Record<string, number> = {}
    notas.forEach((n) => {
      const key = n.jenis
      res[key] = (res[key] ?? 0) + 1
    })
    return res
  }, [notas])

  const openProjModal = (p: Project | null) => {
    setEditProj(p)
    setForm(
      p
        ? {
            name: p.name,
            desk_id: p.desk_id ?? '',
            owner_id: p.owner_id ?? '',
            contract_value: String(p.contract_value ?? ''),
            start_date: p.start_date ?? '',
            durasi_mou: p.durasi_mou ?? '',
            status: p.status ?? 'aktif',
            resume: p.resume ?? ''
          }
        : { status: 'aktif' }
    )
    setOwnerName(p ? (owners.find((o) => o.id === p.owner_id) ? String(owners.find((o) => o.id === p.owner_id)!.name) : '') : '')
    setSubkonName('')
    setSubkonIds(p ? (p.subkon_ids ? p.subkon_ids.split(',').filter(Boolean) : []) : [])
    setShowProj(true)
  }

  const emptyProject = !project

  const pickOwner = (name: string) => {
    setOwnerName(name)
    const m = owners.find((o) => String(o.name).toLowerCase() === name.trim().toLowerCase())
    setForm((p) => ({ ...p, owner_id: m ? m.id : '' }))
  }
  const pickSubkon = (name: string) => {
    setSubkonName(name)
    const m = subkons.find((s) => String(s.name).toLowerCase() === name.trim().toLowerCase())
    if (m) addSubkon(m.id)
  }
  const addSubkon = (id: string) => {
    setSubkonIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setSubkonName('')
  }
  const removeSubkon = (id: string) => {
    setSubkonIds((prev) => prev.filter((x) => x !== id))
  }
  const saveNewOwner = async () => {
    const name = ownerName.trim()
    if (!name) return
    const row = await window.electronAPI.master.insert('owners', { name })
    setOwners((p) => [...p, row])
    setForm((p) => ({ ...p, owner_id: row.id }))
    onToast(`Owner "${name}" tersimpan`)
  }
  const saveNewSubkon = async () => {
    const name = subkonName.trim()
    if (!name) return
    const row = await window.electronAPI.master.insert('subkontraktors', { name })
    setSubkons((p) => [...p, row])
    addSubkon(row.id)
    onToast(`Subkon "${name}" tersimpan`)
  }

  const submitProj = async () => {
    const row = {
      name: form.name?.trim() ?? '',
      desk_id: form.desk_id || null,
      owner_id: form.owner_id || null,
      contract_value: Number(form.contract_value) || 0,
      start_date: form.start_date || null,
      durasi_mou: form.durasi_mou || null,
      status: form.status || 'aktif',
      resume: form.resume?.trim() || null,
      subkon_ids: subkonIds
    }
    if (editProj) await window.electronAPI.project.update(editProj.id, row)
    else {
      const p = await window.electronAPI.project.add(row)
      setActiveProjectId(p.id)
    }
    const list = await window.electronAPI.project.list()
    setProjects(list)
    setShowProj(false)
    onToast('Projek tersimpan')
  }

  const deleteProj = async () => {
    if (!editProj) return
    try {
      await window.electronAPI.project.remove(editProj.id)
      const list = await window.electronAPI.project.list()
      setProjects(list)
      setActiveProjectId(list[0]?.id ?? null)
      setShowProj(false)
      setConfirmDelProj(false)
      onToast('Projek dihapus')
    } catch (e) {
      onToast(`Gagal menghapus projek: ${errMsg(e)}`)
    }
  }

  const deleteNeed = async () => {
    if (!confirmDelNeed) return
    try {
      await window.electronAPI.kebutuhan.remove(confirmDelNeed.id)
      setConfirmDelNeed(null)
      reload()
    } catch (e) {
      onToast(`Gagal menghapus kebutuhan: ${errMsg(e)}`)
    }
  }

  const deleteNota = async () => {
    if (!confirmDelNota) return
    try {
      await window.electronAPI.nota.remove(confirmDelNota.id)
      setConfirmDelNota(null)
      reload()
    } catch (e) {
      onToast(`Gagal menghapus nota: ${errMsg(e)}`)
    }
  }

  const openNeed = (row: MasterRow | null) => {
    setEditNeed(row)
    setNeedForm(
      row
        ? {
            jenis: String(row.jenis),
            item_id: String(row.item_id ?? ''),
            satuan: String(row.satuan ?? ''),
            qty_rencana: String(row.qty_rencana ?? ''),
            notes: String(row.notes ?? '')
          }
        : { jenis: 'material', item_id: '', satuan: '', qty_rencana: '', notes: '' }
    )
    setShowNeed(true)
  }

  const submitNeed = async () => {
    if (!Number(needForm.qty_rencana)) return
    const row = {
      project_id: activeProjectId,
      jenis: needForm.jenis,
      item_type: needForm.jenis,
      item_id: needForm.item_id || null,
      satuan: needForm.satuan.trim(),
      qty_rencana: Number(needForm.qty_rencana),
      notes: needForm.notes.trim()
    }
    if (editNeed) await window.electronAPI.kebutuhan.update(editNeed.id, row)
    else await window.electronAPI.kebutuhan.add(row)
    setShowNeed(false)
    reload()
  }

  const needOptions = needForm.jenis === 'material' ? materials : needForm.jenis === 'alat' ? alats : tenaga
  const needItems = needRows.filter((r) => r.jenis === needTab)

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
      reload()
    } catch (e) {
      onToast(`Gagal menyimpan nota: ${errMsg(e)}`)
    }
  }

  const openEditNota = async (n: Nota) => {
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
      jenis: n.jenis,
      keterangan: n.keterangan,
      payment_status: n.payment_status ?? 'terbayar'
    })
    setShowNota(true)
  }

  const exportFullReport = async () => {
    if (!project) return
    const res = await window.electronAPI.report.export({ type: 'project', format: 'xlsx', projectId: project.id })
    if (res.canceled) return
    if (res.ok) onToast('Full Project Report tersimpan')
    else onToast(res.error || 'Gagal export')
  }

  return (
    <div>
      {!project ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-10">
            {projects.length === 0 ? (
              <>
                <EmptyNote>Belum ada projek di workspace ini. Buat projek baru untuk mulai.</EmptyNote>
                <PrimaryButton onClick={() => openProjModal(null)}>+ Projek Baru</PrimaryButton>
              </>
            ) : (
              <EmptyNote>Pilih salah satu projek di dropdown atas untuk melihat dashboard.</EmptyNote>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
      {/* info-bar */}
      <Card className="mb-4">
        <CardBody className="grid grid-cols-6 gap-4 text-sm">
          <InfoItem label="Owner" value={owners.find((o) => o.id === project.owner_id)?.name ? String(owners.find((o) => o.id === project.owner_id)!.name) : '—'} />
          <InfoItem label="Subkon" value={project.subkon_names || '—'} />
          <InfoItem label="Nilai Kontrak" value={fmtRupiah(project.contract_value)} bold />
          <InfoItem label="Mulai · MOU" value={`${fmtDate(project.start_date)} · ${project.durasi_mou || '-'}`} />
          <InfoItem label="Status" value={<Badge tone={project.status === 'selesai' ? 'blue' : project.status === 'dihentikan' ? 'red' : 'green'}>{project.status}</Badge>} />
          <div className="flex flex-col justify-center items-end gap-1">
            <button onClick={() => exportFullReport()} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
              Export Full Report
            </button>
            <button onClick={() => openProjModal(project)} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
              Edit Info
            </button>
            <button onClick={() => openProjModal(null)} className="text-xs text-zinc-400 hover:text-zinc-600 font-medium">
              + Projek Baru
            </button>
          </div>
        </CardBody>
      </Card>

      {/* 3 kartu */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Rekening Proyek" value={fmtRupiah(fin.rekening)} sub="saldo akumulatif (inflow − outflow)" />
        <StatCard label="Outflow Total" value={fmtRupiah(outflow)} negative sub={`${notas.filter((n) => isKeluar(n.jenis)).length} nota keluar`} />
        <StatCard label="Inflow Total" value={fmtRupiah(inflow)} positive sub="rekening + outflow (termin masuk global)" />
      </div>

      {/* KEBUTUHAN & PEMBELIAN */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-700">KEBUTUHAN &amp; PEMBELIAN</span>
        <div className="flex gap-2">
          {(['material', 'tenaga', 'alat'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setNeedTab(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                needTab === t ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-zinc-300 text-zinc-500'
              }`}
            >
              {t === 'material' ? 'Material' : t === 'tenaga' ? 'Tenaga' : 'Alat'}
            </button>
          ))}
          <GhostButton onClick={() => openNeed(null)} className="text-xs px-3 py-1">
            + Tambah Kebutuhan
          </GhostButton>
        </div>
      </div>

      <Card className="mb-5">
        {needTab === 'material' && (
          <NeedMaterialTable rows={needItems} materials={materials} onEdit={openNeed} onDelete={(r) => setConfirmDelNeed(r)} />
        )}
        {needTab === 'alat' && (
          <NeedAlatTable rows={needItems} alats={alats} onEdit={openNeed} onDelete={(r) => setConfirmDelNeed(r)} />
        )}
        {needTab === 'tenaga' && (
          <NeedTenagaTable rows={needItems} tenaga={tenaga} pekerjas={pekerjas} notas={notas} onEdit={openNeed} onDelete={(r) => setConfirmDelNeed(r)} onOpenPersonel={setPersonelModal} />
        )}
      </Card>

      {/* CASHFLOW PROYEK */}
      <Card className="mb-5">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-700">CASHFLOW PROYEK</span>
          <div className="flex gap-2">
            <GhostButton onClick={() => setShowTransfer(true)} className="text-xs px-3 py-1.5">
              ⇄ Transfer / Pinjam
            </GhostButton>
            <PrimaryButton
              onClick={() => {
                setEditNota(null)
                setEditItems([])
                setShowNota(true)
              }}
              className="text-xs px-3 py-1.5"
            >
              + Tambah Nota
            </PrimaryButton>
          </div>
        </div>
        {notas.length === 0 ? (
          <CardBody>
            <EmptyNote>Belum ada nota untuk projek ini</EmptyNote>
          </CardBody>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Jenis</th>
                <th className="px-4 py-2.5">Uraian</th>
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
                    {n.suplier_name || n.keterangan || '—'}
                    {n.jenis === 'keluar-material' && n.suplier_name && <span className="text-zinc-400"> — {n.suplier_name}</span>}
                    {isKeluar(n.jenis) && (
                      <Badge tone={n.payment_status === 'hutang' ? 'amber' : 'green'}>{n.payment_status === 'hutang' ? 'Hutang' : 'Terbayar'}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{n.rekening === 'global' ? 'Rek. Global' : 'Rek. Proyek'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${isKeluar(n.jenis) ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isKeluar(n.jenis) ? '-' : '+'}
                    {fmtRupiah(n.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {isKeluar(n.jenis) && (
                      <button
                        onClick={async () => {
                          await window.electronAPI.nota.setPayment(n.id, n.payment_status === 'hutang' ? 'terbayar' : 'hutang')
                          reload()
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 mr-2"
                        title={n.payment_status === 'hutang' ? 'Tandai terbayar' : 'Tandai hutang'}
                      >
                        {n.payment_status === 'hutang' ? '✓ Bayar' : '⧖ Hutang'}
                      </button>
                    )}
                    <button
                      onClick={() => openEditNota(n)}
                      className="text-zinc-300 hover:text-amber-600 mr-1 px-1.5 py-1 rounded-md hover:bg-amber-50"
                      title="Edit nota"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDelNota(n)}
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
      </Card>
        </>
      )}

      {/* Modal projek */}
      <datalist id="dl-owner">
        {owners.map((o) => <option key={o.id} value={String(o.name)} />)}
      </datalist>
      <datalist id="dl-subkon">
        {subkons.map((s) => <option key={s.id} value={String(s.name)} />)}
      </datalist>
      <Modal
        open={showProj}
        onClose={() => setShowProj(false)}
        title={editProj ? 'Edit Projek' : '+ Projek Baru'}
        footer={
          <>
            {editProj && <DangerButton onClick={() => setConfirmDelProj(true)} className="text-xs">Hapus Projek</DangerButton>}
            <span className="flex-1" />
            <GhostButton onClick={() => setShowProj(false)}>Batal</GhostButton>
            <PrimaryButton onClick={submitProj} disabled={!form.name?.trim()}>Simpan</PrimaryButton>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama Projek" req>
            <input className={inputCls} value={form.name ?? ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Desk">
            <select className={selectCls} value={form.desk_id ?? ''} onChange={(e) => setForm((p) => ({ ...p, desk_id: e.target.value }))}>
              <option value="">— Tanpa desk —</option>
              {desks.map((d) => (
                <option key={d.id} value={d.id}>{String(d.name)}</option>
              ))}
            </select>
          </Field>
          <Field label="Owner / Stakeholder">
            <div className="flex gap-1.5 items-center">
              <input
                className={inputCls}
                list="dl-owner"
                value={ownerName}
                onChange={(e) => pickOwner(e.target.value)}
                placeholder="Ketik nama owner..."
              />
              {ownerName.trim() && !owners.some((o) => String(o.name).toLowerCase() === ownerName.trim().toLowerCase()) && (
                <button type="button" onClick={saveNewOwner} className="shrink-0 px-2 py-1 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-400 hover:bg-amber-100">
                  Simpan
                </button>
              )}
            </div>
          </Field>
          <Field label="Subkontraktor">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {subkonIds.map((sid) => {
                const sk = subkons.find((s) => s.id === sid)
                return (
                  <span key={sid} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 rounded-md">
                    {sk ? String(sk.name) : sid}
                    <button type="button" onClick={() => removeSubkon(sid)} className="text-amber-500 hover:text-red-500">✕</button>
                  </span>
                )
              })}
            </div>
            <div className="flex gap-1.5 items-center">
              <input
                className={inputCls}
                list="dl-subkon"
                value={subkonName}
                onChange={(e) => pickSubkon(e.target.value)}
                placeholder="Ketik nama subkon, Enter untuk tambah..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const m = subkons.find((s) => String(s.name).toLowerCase() === subkonName.trim().toLowerCase())
                    if (m) addSubkon(m.id)
                  }
                }}
              />
              {subkonName.trim() && !subkons.some((s) => String(s.name).toLowerCase() === subkonName.trim().toLowerCase()) && (
                <button type="button" onClick={saveNewSubkon} className="shrink-0 px-2 py-1 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-400 hover:bg-amber-100">
                  Simpan
                </button>
              )}
            </div>
          </Field>
          <Field label="Nilai Kontrak (Rp)">
            <input className={inputCls} type="number" value={form.contract_value ?? ''} onChange={(e) => setForm((p) => ({ ...p, contract_value: e.target.value }))} />
          </Field>
          <Field label="Tanggal Mulai">
            <DateInput className={inputCls} value={form.start_date ?? ''} onChange={(iso) => setForm((p) => ({ ...p, start_date: iso }))} />
          </Field>
          <Field label="Durasi (sesuai MOU)">
            <input className={inputCls} value={form.durasi_mou ?? ''} onChange={(e) => setForm((p) => ({ ...p, durasi_mou: e.target.value }))} placeholder="Contoh: 6 bulan" />
          </Field>
          <Field label="Status">
            <select className={selectCls} value={form.status ?? 'aktif'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="aktif">Aktif</option>
              <option value="selesai">Selesai</option>
              <option value="dihentikan">Dihentikan</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Resume item dikerjakan">
              <textarea className={inputCls} rows={2} value={form.resume ?? ''} onChange={(e) => setForm((p) => ({ ...p, resume: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Modal kebutuhan */}
      <Modal
        open={showNeed}
        onClose={() => setShowNeed(false)}
        title={editNeed ? 'Edit Kebutuhan' : '+ Tambah Kebutuhan'}
        footer={
          <>
            <span className="flex-1" />
            <GhostButton onClick={() => setShowNeed(false)}>Batal</GhostButton>
            <PrimaryButton onClick={submitNeed} disabled={!Number(needForm.qty_rencana) || !needForm.item_id}>Simpan</PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Jenis" req>
            <select className={selectCls} value={needForm.jenis} onChange={(e) => setNeedForm((p) => ({ ...p, jenis: e.target.value, item_id: '' }))}>
              <option value="material">Material</option>
              <option value="tenaga">Tenaga (personel)</option>
              <option value="alat">Alat</option>
            </select>
          </Field>
          <Field label={needForm.jenis === 'material' ? 'Material' : needForm.jenis === 'alat' ? 'Alat' : 'Personel'} req>
            <select className={selectCls} value={needForm.item_id} onChange={(e) => {
              const id = e.target.value
              const found = needOptions.find((o) => o.id === id)
              setNeedForm((p) => ({ ...p, item_id: id, satuan: found ? String(found.unit ?? '') : p.satuan }))
            }}>
              <option value="">— Pilih —</option>
              {needOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {String(o.name ?? o.jenis)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Satuan" req>
              <input className={inputCls} value={needForm.satuan} onChange={(e) => setNeedForm((p) => ({ ...p, satuan: e.target.value }))} />
            </Field>
            <Field label="Qty Rencana" req>
              <input className={inputCls} type="number" value={needForm.qty_rencana} onChange={(e) => setNeedForm((p) => ({ ...p, qty_rencana: e.target.value }))} />
            </Field>
          </div>
          <Field label="Catatan">
            <input className={inputCls} value={needForm.notes} onChange={(e) => setNeedForm((p) => ({ ...p, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      {/* Modal nota */}
      {showNota && (
        <NotaModal
          open={showNota}
          from="project"
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

      {/* Modal transfer */}
      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} projects={projects} currentId={activeProjectId} onDone={(m) => { onToast(m); setShowTransfer(false) }} />}

      {/* Modal personel detail */}
      {personelModal && <PersonelModal row={personelModal} tenaga={tenaga} notas={notas} onClose={() => setPersonelModal(null)} />}

      <Confirm
        open={!!confirmDelNota}
        title="Hapus nota"
        message={`Yakin hapus nota "${confirmDelNota ? confirmDelNota.keterangan || confirmDelNota.suplier_name || confirmDelNota.id : ''}"?`}
        onCancel={() => setConfirmDelNota(null)}
        onConfirm={deleteNota}
      />

      <Confirm
        open={!!confirmDelNeed}
        title="Hapus kebutuhan"
        message={`Yakin hapus kebutuhan ini?`}
        onCancel={() => setConfirmDelNeed(null)}
        onConfirm={deleteNeed}
      />

      <Confirm
        open={confirmDelProj}
        title="Hapus projek"
        message={`Yakin hapus projek "${editProj ? editProj.name : ''}"? Semua nota dan kebutuhan terkait ikut terhapus.`}
        onCancel={() => setConfirmDelProj(false)}
        onConfirm={deleteProj}
      />
    </div>
  )
}

// ---------------- sub components

function InfoItem({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</div>
      <div className={`text-zinc-800 mt-0.5 ${bold ? 'font-bold' : ''}`}>{value}</div>
    </div>
  )
}

function NeedMaterialTable({ rows, materials, onEdit, onDelete }: {
  rows: MasterRow[]
  materials: MasterRow[]
  onEdit: (r: MasterRow) => void
  onDelete: (r: MasterRow) => void
}) {
  return (
    <div>
      <div className="px-4 pt-3 text-xs text-zinc-500">Terbeli = akumulasi qty dari nota pembelian (stok gudang)</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
            <th className="px-4 py-2.5">Material</th>
            <th className="px-4 py-2.5">Satuan</th>
            <th className="px-4 py-2.5 text-right">Kebutuhan</th>
            <th className="px-4 py-2.5 text-right">Terbeli</th>
            <th className="px-4 py-2.5 text-right">Sisa</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = materials.find((x) => x.id === r.item_id)
            return (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5 font-medium">{m ? String(m.name) : '—'}</td>
                <td className="px-4 py-2.5 text-zinc-600">{String(r.satuan ?? '')}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{Number(r.qty_rencana)}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600">0</td>
                <td className="px-4 py-2.5 text-right text-zinc-600">{Number(r.qty_rencana)}</td>
                <td className="px-4 py-2.5"><Badge tone="red">Belum dibeli</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  <MutedButton onClick={() => onEdit(r)}>Edit</MutedButton>
                  <DangerButton onClick={() => onDelete(r)}>✕</DangerButton>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Belum ada kebutuhan material</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function NeedAlatTable({ rows, alats, onEdit, onDelete }: {
  rows: MasterRow[]
  alats: MasterRow[]
  onEdit: (r: MasterRow) => void
  onDelete: (r: MasterRow) => void
}) {
  return (
    <div>
      <div className="px-4 pt-3 text-xs text-zinc-500">Terpakai = akumulasi dari nota harian</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
            <th className="px-4 py-2.5">Alat</th>
            <th className="px-4 py-2.5">Satuan</th>
            <th className="px-4 py-2.5 text-right">Kebutuhan</th>
            <th className="px-4 py-2.5 text-right">Terpakai</th>
            <th className="px-4 py-2.5 text-right">Sisa</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = alats.find((x) => x.id === r.item_id)
            return (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5 font-medium">{a ? String(a.name) : '—'}</td>
                <td className="px-4 py-2.5 text-zinc-600">{String(r.satuan ?? '')}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{Number(r.qty_rencana)}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600">0</td>
                <td className="px-4 py-2.5 text-right text-zinc-600">{Number(r.qty_rencana)}</td>
                <td className="px-4 py-2.5"><Badge tone="amber">Kurang</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  <MutedButton onClick={() => onEdit(r)}>Edit</MutedButton>
                  <DangerButton onClick={() => onDelete(r)}>✕</DangerButton>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Belum ada kebutuhan alat</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function NeedTenagaTable({ rows, tenaga, pekerjas, notas, onEdit, onDelete, onOpenPersonel }: {
  rows: MasterRow[]
  tenaga: MasterRow[]
  pekerjas: MasterRow[]
  notas: Nota[]
  onEdit: (r: MasterRow) => void
  onDelete: (r: MasterRow) => void
  onOpenPersonel: (r: MasterRow) => void
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs text-zinc-500 mb-3">Kebutuhan personel per jenis — klik personel untuk detail jam kerja</div>
      <div className="grid grid-cols-3 gap-3">
        {tenaga.map((t) => {
          const need = rows.find((r) => r.item_id === t.id)
          const personels = pekerjas.filter((p) => p.tenaga_kerja_id === t.id)
          return (
            <Card key={t.id} className="border border-zinc-200">
              <CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900">{String(t.jenis)}</span>
                  <span className="text-xs text-zinc-400">{fmtRupiah(Number(t.harga_satuan) || 0)}/{String(t.unit ?? 'OH')}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Kebutuhan {Number(need?.qty_rencana ?? 0)} · Terpakai 0 · Sisa {Number(need?.qty_rencana ?? 0)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {personels.length === 0 && <span className="text-xs text-zinc-400">Belum ada personel</span>}
                  {personels.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onOpenPersonel(p)}
                      className="px-2.5 py-1 text-xs bg-zinc-100 hover:bg-amber-50 hover:text-amber-700 rounded-full border border-zinc-200"
                    >
                      {String(p.name)}
                      <span className="text-zinc-400 ml-1">0 OH</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => need && onEdit(need)} className="text-xs text-zinc-400 hover:text-amber-600">
                    {need ? 'Edit kebutuhan' : 'Tambah kebutuhan'}
                  </button>
                </div>
              </CardBody>
            </Card>
          )
        })}
        {tenaga.length === 0 && <div className="col-span-3 text-sm text-zinc-400 py-6 text-center">Belum ada jenis tenaga kerja di Master Data</div>}
      </div>
    </div>
  )
}

function PersonelModal({ row, tenaga, notas, onClose }: {
  row: MasterRow
  tenaga: MasterRow[]
  notas: Nota[]
  onClose: () => void
}) {
  const jenis = tenaga.find((t) => t.id === row.tenaga_kerja_id)
  const upah = Number(row.upah_harian ?? jenis?.harga_satuan ?? 0) || 0
  const hours = notas.filter((n) => n.jenis === 'keluar-tenaga').length
  return (
    <Modal open onClose={onClose} title={String(row.name)} sub="· detail personel">
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-xs text-zinc-500">Jenis</div>
        <div className="text-xs text-zinc-500">Upah</div>
        <div className="text-xs text-zinc-500">Jam kerja berjalan</div>
        <div className="text-xs text-zinc-500">Total upah terpakai</div>
        <div className="text-sm font-semibold">{jenis ? String(jenis.jenis) : '—'}</div>
        <div className="text-sm font-semibold">{fmtRupiah(upah)}</div>
        <div className="text-sm font-semibold">{hours} OH</div>
        <div className="text-sm font-semibold text-red-600">-{fmtRupiah(hours * upah)}</div>
      </div>
      <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-2">RIWAYAT JAM KERJA</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
            <th className="px-2 py-2">Tanggal</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2">Satuan</th>
            <th className="px-2 py-2 text-right">Upah</th>
            <th className="px-2 py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {notas.filter((n) => n.jenis === 'keluar-tenaga').length === 0 && (
            <tr><td colSpan={5} className="px-2 py-4 text-center text-zinc-400">Belum ada riwayat</td></tr>
          )}
        </tbody>
      </table>
    </Modal>
  )
}

function TransferModal({ onClose, projects, currentId, onDone }: {
  onClose: () => void
  projects: Project[]
  currentId: string | null
  onDone: (msg: string) => void
}) {
  const [date, setDate] = useState(todayISO())
  const [jumlah, setJumlah] = useState('')
  const [dari, setDari] = useState('global')
  const [ke, setKe] = useState<string>(currentId ?? '')
  const [keterangan, setKeterangan] = useState('')
  const [saldo, setSaldo] = useState(0)

  useEffect(() => {
    window.electronAPI.finance.globalSaldo().then(setSaldo)
  }, [])

  const dariName = dari === 'global' ? 'Rek. Global' : projects.find((p) => p.id === dari)?.name ?? '?'
  const keName = ke === 'global' ? 'Rek. Global' : projects.find((p) => p.id === ke)?.name ?? '?'

  const submit = async () => {
    const v = Number(jumlah) || 0
    if (v <= 0 || !dari || !ke || dari === ke) {
      onDone('Jumlah harus > 0 dan rekening berbeda')
      return
    }
    const jenis = dari === 'global' ? 'pendanaan' : ke === 'global' ? 'pengembalian' : 'pinjam'
    await window.electronAPI.transfer.add({ date, dari, ke, jumlah: v, jenis, keterangan })
    onDone(`Transfer ${fmtRupiah(v)} ${dariName} → ${keName} tercatat`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="⇄ Transfer / Pinjam Rekening"
      sub="· sinkron rekening global & proyek"
      footer={
        <>
          <span className="text-sm text-zinc-500">Saldo {dari === 'global' ? 'Global' : dariName}:</span>
          <b className="text-amber-600">{fmtRupiah(saldo)}</b>
          <span className="flex-1" />
          <GhostButton onClick={onClose}>Batal</GhostButton>
          <PrimaryButton onClick={submit}>Proses Transfer</PrimaryButton>
        </>
      }
    >
      <p className="text-xs text-zinc-500 mb-4">
        Pendanaan: Global → Projek (saldo proyek naik, global turun). Pinjam antar projek: Rek A → Rek B. Pengembalian: kebalikannya.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tanggal" req>
          <DateInput className={inputCls} value={date} onChange={setDate} />
        </Field>
        <Field label="Jumlah (Rp)" req>
          <input type="number" className={inputCls} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
        </Field>
        <Field label="Dari rekening" req>
          <select className={selectCls} value={dari} onChange={(e) => setDari(e.target.value)}>
            <option value="global">Rek. Global</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Ke rekening" req>
          <select className={selectCls} value={ke} onChange={(e) => setKe(e.target.value)}>
            <option value="global">Rek. Global</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Keterangan">
            <input className={inputCls} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Contoh: pendanaan awal, pinjam dari Ruko A" />
          </Field>
        </div>
      </div>
      <div className="mt-4 text-sm text-zinc-600 bg-zinc-50 rounded-lg p-3">
        {fmtRupiah(Number(jumlah) || 0)} dari <b>{dariName}</b> ke <b>{keName}</b>
      </div>
    </Modal>
  )
}
