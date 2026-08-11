import { useEffect, useRef, useState } from 'react'
import { Modal, Field, inputCls, selectCls, PrimaryButton, GhostButton, DateInput } from './ui'
import { fmtRupiah, todayISO, uid, JENIS_OPTIONS } from '../lib/utils'
import type { Project, MasterRow, NotaPhoto } from '../env.d'

export interface NotaItemPayload {
  item_type: string
  item_id: string | null
  name: string
  unit: string
  price: number
  qty: number
  subtotal: number
}

export interface NotaPayload {
  date: string
  project_id: string | null
  suplier_id: string | null
  subkon_id: string | null
  jenis: string
  rekening: string
  keterangan: string
  payment_status: string
  items: NotaItemPayload[]
  photos?: string[]
}

interface RowState extends NotaItemPayload {
  key: string
}

const TYPE_LABELS: Record<string, string> = {
  material: 'Material',
  personel: 'Personel',
  alat: 'Alat',
  pekerjaan: 'Pekerjaan',
  subkon: 'Subkon',
  inflow: 'Sumber pemasukan',
  lain: 'Uraian'
}

export default function NotaModal({
  open = true,
  onClose,
  onSave,
  onToast,
  from,
  defaultProjectId,
  projects,
  editNota,
  editItems
}: {
  open?: boolean
  onClose: () => void
  onSave: (data: NotaPayload) => void
  onToast?: (m: string) => void
  from: 'workspace' | 'project'
  defaultProjectId?: string | null
  projects: Project[]
  editNota?: {
    id: string
    date: string
    project_id: string | null
    suplier_id: string | null
    subkon_id?: string | null
    jenis: string
    keterangan: string | null
    payment_status?: string
  } | null
  editItems?: NotaItemPayload[]
}) {
  const [date, setDate] = useState(todayISO())
  const [projectId, setProjectId] = useState<string>(from === 'project' ? defaultProjectId ?? '' : '')
  const [suplierId, setSuplierId] = useState<string>('')
  const [suplierName, setSuplierName] = useState('')
  const [subkonId, setSubkonId] = useState<string>('')
  const [subkonName, setSubkonName] = useState('')
  const [jenis, setJenis] = useState('keluar-material')
  const [payment, setPayment] = useState('terbayar')
  const [keterangan, setKeterangan] = useState('')
  const [items, setItems] = useState<RowState[]>([])
  const [supliers, setSupliers] = useState<MasterRow[]>([])
  const [subkons, setSubkons] = useState<MasterRow[]>([])
  const [pekerjaans, setPekerjaans] = useState<MasterRow[]>([])
  const [materials, setMaterials] = useState<MasterRow[]>([])
  const [personels, setPersonels] = useState<MasterRow[]>([])
  const [alats, setAlats] = useState<MasterRow[]>([])
  const [tenaga, setTenaga] = useState<MasterRow[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [subkonPrices, setSubkonPrices] = useState<Record<string, number>>({})
  const [showNewPersonel, setShowNewPersonel] = useState(false)
  const [newPersonelName, setNewPersonelName] = useState('')
  const [newPersonelTenaga, setNewPersonelTenaga] = useState('')
  const [newPersonelUpah, setNewPersonelUpah] = useState('')
  const [showNewMaster, setShowNewMaster] = useState(false)
  const [newMasterType, setNewMasterType] = useState<'material' | 'pekerjaan' | 'alat'>('material')
  const [newMasterName, setNewMasterName] = useState('')
  const [newMasterSpec, setNewMasterSpec] = useState('')
  const [newMasterUnit, setNewMasterUnit] = useState('')
  const [newMasterPrice, setNewMasterPrice] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState<{ fileName: string; dataUrl: string }[]>([])
  const [existingPhotos, setExistingPhotos] = useState<NotaPhoto[]>([])
  const [existingUrls, setExistingUrls] = useState<Record<string, string>>({})
  const itemsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const saveRef = useRef<() => void>(() => {})
  const closeRef = useRef<() => void>(() => {})
  const showPersonelRef = useRef(false)
  showPersonelRef.current = showNewPersonel
  const showMasterRef = useRef(false)
  showMasterRef.current = showNewMaster

  const isMaterial = jenis === 'keluar-material'
  const isPersonel = jenis === 'keluar-tenaga'
  const isAlat = jenis === 'keluar-alat'
  const isPekerjaan = jenis === 'keluar-pekerjaan'
  const isSubkon = jenis === 'keluar-subkon'
  const isLain = jenis === 'keluar-lain'
  const isMasuk = jenis === 'masuk'

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showPersonelRef.current) setShowNewPersonel(false)
        else if (showMasterRef.current) setShowNewMaster(false)
        else closeRef.current()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  useEffect(() => {
    if (!open) return
    setDate(editNota?.date || todayISO())
    setProjectId(editNota?.project_id ?? (from === 'project' ? defaultProjectId ?? '' : ''))
    setSuplierId(editNota?.suplier_id ?? '')
    setSuplierName('')
    setSubkonId(editNota?.subkon_id ?? '')
    setSubkonName('')
    setJenis(editNota?.jenis || 'keluar-material')
    setPayment(editNota?.payment_status || 'terbayar')
    setKeterangan(editNota?.keterangan ?? '')
    setItems(
      editItems && editItems.length
        ? editItems.map((it) => ({
            key: uid(),
            item_type: it.item_type,
            item_id: it.item_id,
            name: it.name,
            unit: it.unit,
            price: it.price,
            qty: it.qty,
            subtotal: it.subtotal
          }))
        : [{ key: uid(), item_type: itemTypeFor(editNota?.jenis ?? 'keluar-material'), item_id: null, name: '', unit: '', price: 0, qty: 1, subtotal: 0 }]
    )
    setShowNewPersonel(false)
    setNewPersonelName('')
    setNewPersonelTenaga('')
    setNewPersonelUpah('')
    setStagedPhotos([])
    setExistingPhotos([])
    setExistingUrls({})
    if (editNota) {
      window.electronAPI.photo.list(editNota.id).then(async (rows) => {
        setExistingPhotos(rows)
        const urls: Record<string, string> = {}
        await Promise.all(rows.map(async (r) => (urls[r.file_name] = (await window.electronAPI.photo.read(r.file_name)) ?? '')))
        setExistingUrls(urls)
      })
    }
    window.electronAPI.master.list('supliers').then((rows) => {
      setSupliers(rows)
      if (editNota?.suplier_id) {
        const s = rows.find((x) => String(x.id) === String(editNota.suplier_id))
        if (s) setSuplierName(String(s.name))
      }
    })
    window.electronAPI.master.list('materials').then(setMaterials)
    window.electronAPI.master.list('pekerjas').then(setPersonels)
    window.electronAPI.master.list('alats').then(setAlats)
    window.electronAPI.master.list('subkontraktors').then((rows) => {
      setSubkons(rows)
      if (editNota?.subkon_id) {
        const s = rows.find((x) => String(x.id) === String(editNota.subkon_id))
        if (s) setSubkonName(String(s.name))
      }
    })
    window.electronAPI.master.list('pekerjaans').then(setPekerjaans)
    window.electronAPI.master.list('tenaga_kerja').then((rows) => {
      setTenaga(rows)
      if (rows.length) {
        setNewPersonelTenaga(String(rows[0].id))
        setNewPersonelUpah(String(Number(rows[0].harga_satuan) || 0))
      }
    })
    window.electronAPI.prices.list('material_prices').then((rows) => {
      const map: Record<string, number> = {}
      rows.forEach((r) => {
        map[`${r.material_id}:${r.suplier_id}`] = Number(r.price) || 0
      })
      setPrices(map)
    })
    window.electronAPI.prices.list('subkon_prices').then((rows) => {
      const map: Record<string, number> = {}
      rows.forEach((r) => {
        map[`${r.pekerjaan_id}:${r.subkon_id}`] = Number(r.price) || 0
      })
      setSubkonPrices(map)
    })
  }, [open, from, defaultProjectId, editNota, editItems])

  const blankItem = (): RowState => ({
    key: uid(),
    item_type: itemTypeFor(jenis),
    item_id: null,
    name: '',
    unit: '',
    price: 0,
    qty: 1,
    subtotal: 0
  })

  function itemTypeFor(j: string): string {
    if (j === 'keluar-tenaga') return 'personel'
    if (j === 'keluar-alat') return 'alat'
    if (j === 'keluar-pekerjaan') return 'pekerjaan'
    if (j === 'keluar-subkon') return 'subkon'
    if (j === 'keluar-lain') return 'lain'
    if (j === 'masuk') return 'inflow'
    return 'material'
  }

  function sourceFor(j: string): { list: MasterRow[]; label: string } {
    if (j === 'keluar-tenaga') return { list: personels, label: 'Ketik nama personel…' }
    if (j === 'keluar-alat') return { list: alats, label: 'Ketik nama alat…' }
    if (j === 'keluar-pekerjaan') return { list: pekerjaans, label: 'Ketik nama pekerjaan…' }
    if (j === 'keluar-subkon') return { list: pekerjaans, label: 'Ketik nama pekerjaan…' }
    if (j === 'keluar-lain') return { list: [], label: 'Ketik uraian pengeluaran…' }
    if (j === 'masuk') return { list: [], label: 'Ketik sumber pemasukan (Termin, Pinjaman)…' }
    return { list: materials, label: 'Ketik nama material…' }
  }

  function changeJenis(j: string) {
    setJenis(j)
    const t = itemTypeFor(j)
    setItems((prev) => prev.map((it) => ({ ...it, item_type: t })))
  }

  function updateItem(key: string, patch: Partial<RowState>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it
        const next = { ...it, ...patch }
        if (patch.name !== undefined && !patch.item_id && !patch.price) {
          // auto-fill satuan/harga dari master
          const src = sourceFor(jenis)
          if (src.list.length) {
            const found = src.list.find((m) => String(m.name).toLowerCase() === String(next.name).trim().toLowerCase())
            if (found && next.item_type !== 'lain' && next.item_type !== 'inflow') {
              next.item_id = found.id
              next.unit = String(found.unit ?? '')
              next.price = Number(found.upah_harian ?? found.harga_satuan ?? 0) || 0
              if (isMaterial) {
                const p = prices[`${next.item_id}:${suplierId}`]
                if (p !== undefined) next.price = p
              }
              if (isSubkon) {
                const p = subkonPrices[`${next.item_id}:${subkonId}`]
                if (p !== undefined) next.price = p
              }
            }
          }
        }
        if (patch.item_id && patch.item_id !== it.item_id) {
          const found = [...materials, ...personels, ...alats, ...pekerjaans].find((m) => m.id === patch.item_id)
          if (found) {
            next.name = String(found.name)
            next.unit = String(found.unit ?? 'OH')
            next.price = Number(found.upah_harian ?? found.harga_satuan ?? 0) || 0
          }
          if (isMaterial) {
            const p = prices[`${next.item_id}:${suplierId}`]
            if (p !== undefined) next.price = p
          }
          if (isSubkon) {
            const p = subkonPrices[`${next.item_id}:${subkonId}`]
            if (p !== undefined) next.price = p
          }
        }
        next.subtotal = (Number(next.qty) || 0) * (Number(next.price) || 0)
        return next
      })
    )
  }

  const total = items.reduce((s, it) => s + it.subtotal, 0)

  const suplierMatch = supliers.find((s) => String(s.name).toLowerCase() === suplierName.trim().toLowerCase())
  const isNewSuplier = isMaterial && suplierName.trim() && !suplierMatch

  const subkonMatch = subkons.find((s) => String(s.name).toLowerCase() === subkonName.trim().toLowerCase())
  const isNewSubkon = isSubkon && subkonName.trim() && !subkonMatch

  const pickSubkon = (name: string) => {
    setSubkonName(name)
    const match = subkons.find((s) => String(s.name).toLowerCase() === name.trim().toLowerCase())
    const sid = match ? String(match.id) : ''
    setSubkonId(sid)
    if (sid) {
      setItems((prev) =>
        prev.map((it) => {
          if (!it.item_id || it.item_type !== 'subkon') return it
          const p = subkonPrices[`${it.item_id}:${sid}`]
          if (p !== undefined) {
            const price = Number(p) || 0
            return { ...it, price, subtotal: (Number(it.qty) || 0) * price }
          }
          return it
        })
      )
    }
  }

  const saveNewSubkon = async () => {
    const name = subkonName.trim()
    if (!name) return
    const s = await window.electronAPI.master.insert('subkontraktors', { name })
    setSubkons((prev) => [...prev, s])
    setSubkonId(String(s.id))
    onToast?.(`Subkon "${name}" tersimpan`)
  }

  const pickSuplier = (name: string) => {
    setSuplierName(name)
    const match = supliers.find((s) => String(s.name).toLowerCase() === name.trim().toLowerCase())
    const sid = match ? String(match.id) : ''
    setSuplierId(sid)
    if (sid) {
      setItems((prev) =>
        prev.map((it) => {
          if (!it.item_id || it.item_type !== 'material') return it
          const p = prices[`${it.item_id}:${sid}`]
          if (p !== undefined) {
            const price = Number(p) || 0
            return { ...it, price, subtotal: (Number(it.qty) || 0) * price }
          }
          return it
        })
      )
    }
  }

  const saveNewSuplier = async () => {
    const name = suplierName.trim()
    if (!name) return
    const s = await window.electronAPI.master.insert('supliers', { name })
    setSupliers((prev) => [...prev, s])
    setSuplierId(String(s.id))
    onToast?.(`Suplier "${name}" tersimpan`)
  }

  const save = async () => {
    const filled = items.filter((it) => it.name.trim())
    if (filled.length === 0) return
    const rekening = isMaterial || isPersonel || isAlat || isPekerjaan || isSubkon || isLain ? (projectId ? 'proyek' : 'global') : 'global'
    onSave({
      date,
      project_id: projectId || null,
      suplier_id: suplierId || null,
      subkon_id: subkonId || null,
      jenis,
      rekening,
      keterangan: keterangan.trim(),
      payment_status: payment,
      items: filled.map(({ key, ...it }) => ({ ...it, name: it.name.trim(), unit: it.unit || 'pcs' })),
      photos: stagedPhotos.map((p) => p.fileName)
    })
    setStagedPhotos([])
  }
  saveRef.current = save

  const quickAddPersonel = async () => {
    const name = newPersonelName.trim()
    if (!name || !newPersonelTenaga) return
    const row = await window.electronAPI.master.insert('pekerjas', {
      name,
      tenaga_kerja_id: newPersonelTenaga,
      upah_harian: Number(newPersonelUpah) || 0
    })
    setPersonels((prev) => [...prev, row])
    setItems((prev) =>
      prev.map((it) =>
        it.item_type === 'personel' && String(it.name).trim().toLowerCase() === name.toLowerCase()
          ? { ...it, item_id: String(row.id), price: Number(newPersonelUpah) || 0, subtotal: (Number(it.qty) || 0) * (Number(newPersonelUpah) || 0) }
          : it
      )
    )
    onToast?.(`Personel "${name}" tersimpan`)
    setShowNewPersonel(false)
    setNewPersonelName('')
  }

  const quickAddMaster = async () => {
    const name = newMasterName.trim()
    const price = Number(newMasterPrice) || 0
    if (!name) return
    let row: MasterRow
    if (newMasterType === 'material') {
      row = await window.electronAPI.master.insert('materials', {
        name,
        spesifikasi: newMasterSpec.trim() || null,
        unit: newMasterUnit.trim() || null,
        notes: null
      })
      if (suplierId) {
        await window.electronAPI.prices.upsert('material_prices', {
          material_id: String(row.id),
          suplier_id: suplierId,
          price
        })
        setPrices((prev) => ({ ...prev, [`${row.id}:${suplierId}`]: price }))
      }
      setMaterials((prev) => [...prev, row])
      setItems((prev) =>
        prev.map((it) =>
          it.item_type === 'material' && String(it.name).trim().toLowerCase() === name.toLowerCase()
            ? { ...it, item_id: String(row.id), unit: newMasterUnit.trim() || it.unit, price, subtotal: (Number(it.qty) || 0) * price }
            : it
        )
      )
    } else if (newMasterType === 'pekerjaan') {
      row = await window.electronAPI.master.insert('pekerjaans', {
        name,
        unit: newMasterUnit.trim() || null,
        harga_satuan: price,
        notes: null
      })
      setPekerjaans((prev) => [...prev, row])
      setItems((prev) =>
        prev.map((it) =>
          it.item_type === 'pekerjaan' && String(it.name).trim().toLowerCase() === name.toLowerCase()
            ? { ...it, item_id: String(row.id), unit: newMasterUnit.trim() || it.unit, price, subtotal: (Number(it.qty) || 0) * price }
            : it
        )
      )
    } else {
      row = await window.electronAPI.master.insert('alats', {
        name,
        unit: newMasterUnit.trim() || null,
        harga_satuan: price,
        notes: null
      })
      setAlats((prev) => [...prev, row])
      setItems((prev) =>
        prev.map((it) =>
          it.item_type === 'alat' && String(it.name).trim().toLowerCase() === name.toLowerCase()
            ? { ...it, item_id: String(row.id), unit: newMasterUnit.trim() || it.unit, price, subtotal: (Number(it.qty) || 0) * price }
            : it
        )
      )
    }
    onToast?.(`${newMasterType === 'material' ? 'Material' : newMasterType === 'pekerjaan' ? 'Pekerjaan' : 'Alat'} "${name}" tersimpan`)
    setShowNewMaster(false)
    setNewMasterName('')
    setNewMasterSpec('')
    setNewMasterUnit('')
    setNewMasterPrice('')
  }

  const openQuickAddMaster = (it: RowState, type: 'material' | 'pekerjaan' | 'alat') => {
    setNewMasterType(type)
    setNewMasterName(it.name.trim())
    setNewMasterSpec('')
    setNewMasterUnit(it.unit || '')
    setNewMasterPrice(it.price ? String(it.price) : '')
    setShowNewMaster(true)
  }

  const addPhotos = async () => {
    const rows = await window.electronAPI.photo.stage()
    if (rows.length) setStagedPhotos((prev) => [...prev, ...rows])
  }

  const removeStagedPhoto = (fileName: string) => {
    setStagedPhotos((prev) => {
      const target = prev.find((p) => p.fileName === fileName)
      if (target) window.electronAPI.photo.discard([fileName])
      return prev.filter((p) => p.fileName !== fileName)
    })
  }

  const removeExistingPhoto = async (photoId: string) => {
    await window.electronAPI.photo.remove(photoId)
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setExistingUrls((prev) => {
      const next = { ...prev }
      return next
    })
  }

  const handleClose = () => {
    if (stagedPhotos.length) window.electronAPI.photo.discard(stagedPhotos.map((p) => p.fileName))
    setStagedPhotos([])
    onClose()
  }
  closeRef.current = handleClose

  const focusItem = (key: string, field: 'name' | 'qty' | 'unit' | 'price') => {
    itemsRef.current[`${key}:${field}`]?.focus()
  }

  const addItemRow = () => {
    const row = blankItem()
    setItems((prev) => [...prev, row])
    setTimeout(() => focusItem(row.key, 'name'), 0)
  }

  const itemKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    it: RowState,
    idx: number,
    field: 'name' | 'qty' | 'unit' | 'price'
  ) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (field === 'name') {
      focusItem(it.key, 'qty')
      return
    }
    if (field === 'qty' || field === 'unit') {
      focusItem(it.key, 'price')
      return
    }
    if (idx < items.length - 1) focusItem(items[idx + 1].key, 'name')
    else addItemRow()
  }

  const itemRef = (key: string, field: 'name' | 'qty' | 'unit' | 'price') => (el: HTMLInputElement | null) => {
    if (el) itemsRef.current[`${key}:${field}`] = el
    else delete itemsRef.current[`${key}:${field}`]
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editNota ? 'Edit Nota' : '+ Tambah Nota'}
      sub={from === 'project' ? '· langsung ke projek ini' : '· pilih projek untuk nota ini'}
      wide
      footer={
        <>
          <span className="text-sm text-zinc-500">Total:</span>
          <b className="text-amber-600">{fmtRupiah(total)}</b>
          <span className="flex-1" />
          <GhostButton onClick={handleClose}>Batal</GhostButton>
          <PrimaryButton onClick={save} disabled={items.every((i) => !i.name.trim())}>
            {editNota ? 'Simpan Perubahan' : 'Input Nota'}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <Field label="Tanggal" req className="w-[150px]">
          <DateInput className={inputCls} value={date} onChange={setDate} />
        </Field>
        <Field label="Projek" className="flex-1 min-w-[220px]">
          {from === 'project' ? (
            <div className="text-sm text-zinc-500 py-1.5 px-2 bg-zinc-100 rounded-md">
              {projects.find((p) => p.id === defaultProjectId)?.name ?? '—'}
            </div>
          ) : (
            <select className={selectCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Pilih projek (opsional) —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        {isMaterial && (
          <Field label="Suplier" req className="flex-1 min-w-[220px]">
            <div className="flex gap-1.5 items-center">
              <input
                list="dl-suplier"
                className={inputCls}
                value={suplierName}
                placeholder="Ketik nama suplier…"
                onChange={(e) => pickSuplier(e.target.value)}
              />
              {isNewSuplier && (
                <button
                  onClick={saveNewSuplier}
                  className="shrink-0 px-2 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-300 rounded-md font-semibold hover:bg-amber-100"
                >
                  Simpan
                </button>
              )}
            </div>
          </Field>
        )}
        {isSubkon && (
          <Field label="Subkon" req className="flex-1 min-w-[220px]">
            <div className="flex gap-1.5 items-center">
              <input
                list="dl-subkon"
                className={inputCls}
                value={subkonName}
                placeholder="Ketik nama subkon…"
                onChange={(e) => pickSubkon(e.target.value)}
              />
              {isNewSubkon && (
                <button
                  onClick={saveNewSubkon}
                  className="shrink-0 px-2 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-300 rounded-md font-semibold hover:bg-amber-100"
                >
                  Simpan
                </button>
              )}
            </div>
          </Field>
        )}
        <Field label="Jenis Pengeluaran" className="w-[230px]">
          <select className={selectCls} value={jenis} onChange={(e) => changeJenis(e.target.value)}>
            {JENIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isLain && (
        <div className="mb-4">
          <Field label="Deskripsi lain-lain" req>
            <input
              className={inputCls}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: biaya tol, makan tim, fotokopi"
            />
          </Field>
        </div>
      )}

      {!isMasuk && (
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="Pembayaran" className="w-[230px]">
            <select className={selectCls} value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="terbayar">Terbayar / Lunas</option>
              <option value="hutang">Hutang (belum dibayar)</option>
            </select>
          </Field>
          {payment === 'hutang' && (
            <span className="text-xs text-amber-600 pb-2">
              Hutang ke {isMaterial ? 'suplier' : 'pihak terkait'} muncul di Balance Sheet
            </span>
          )}
        </div>
      )}

      <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-2">
        Items — {TYPE_LABELS[items[0]?.item_type ?? 'material']}
      </div>
      <div className="grid grid-cols-[2fr_64px_80px_100px_100px_24px] gap-2 mb-1 text-xs text-zinc-500 font-semibold px-1">
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Satuan</span>
        <span className="text-right">Harga</span>
        <span className="text-right">Subtotal</span>
      </div>
      <div className="space-y-1.5 mb-3">
        {items.map((it, idx) => {
          const src = sourceFor(jenis)
          const isUnmatchedPersonel =
            it.item_type === 'personel' && it.name.trim() && !personels.some((p) => String(p.name).toLowerCase() === it.name.trim().toLowerCase())
          const isUnmatchedMaterial =
            it.item_type === 'material' && it.name.trim() && !materials.some((p) => String(p.name).toLowerCase() === it.name.trim().toLowerCase())
          const isUnmatchedPekerjaan =
            it.item_type === 'pekerjaan' && it.name.trim() && !pekerjaans.some((p) => String(p.name).toLowerCase() === it.name.trim().toLowerCase())
          const isUnmatchedAlat =
            it.item_type === 'alat' && it.name.trim() && !alats.some((p) => String(p.name).toLowerCase() === it.name.trim().toLowerCase())

          return (
            <div key={it.key} className="grid grid-cols-[2fr_64px_80px_100px_100px_24px] gap-2 items-center">
              <div className="flex gap-1 items-center min-w-0">
                {src.list.length > 0 ? (
                  <input
                    list={`dl-${jenis}`}
                    className={inputCls}
                    value={it.name}
                    placeholder={src.label}
                    ref={itemRef(it.key, 'name')}
                    onChange={(e) => updateItem(it.key, { name: e.target.value })}
                  />
                ) : (
                  <input
                    className={inputCls}
                    value={it.name}
                    placeholder={src.label}
                    ref={itemRef(it.key, 'name')}
                    onKeyDown={(e) => itemKeyDown(e, it, idx, 'name')}
                    onChange={(e) => updateItem(it.key, { name: e.target.value })}
                  />
                )}
                {isUnmatchedPersonel && (
                  <button
                    onClick={() => {
                      setNewPersonelName(it.name.trim())
                      setShowNewPersonel(true)
                    }}
                    className="shrink-0 px-2 py-1.5 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-400 hover:bg-amber-100"
                  >
                    Simpan
                  </button>
                )}
                {isUnmatchedMaterial && (
                  <button
                    onClick={() => openQuickAddMaster(it, 'material')}
                    className="shrink-0 px-2 py-1.5 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-400 hover:bg-amber-100"
                  >
                    Simpan
                  </button>
                )}
                {isUnmatchedPekerjaan && (
                  <button
                    onClick={() => openQuickAddMaster(it, 'pekerjaan')}
                    className="shrink-0 px-2 py-1.5 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-400 hover:bg-amber-100"
                  >
                    Simpan
                  </button>
                )}
                {isUnmatchedAlat && (
                  <button
                    onClick={() => openQuickAddMaster(it, 'alat')}
                    className="shrink-0 px-2 py-1.5 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-400 hover:bg-amber-100"
                  >
                    Simpan
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0"
                className={`${inputCls} text-right`}
                value={it.qty}
                ref={itemRef(it.key, 'qty')}
                onKeyDown={(e) => itemKeyDown(e, it, idx, 'qty')}
                onChange={(e) => updateItem(it.key, { qty: Number(e.target.value) || 0 })}
              />
              <input
                className={`${inputCls} text-right`}
                value={it.unit}
                placeholder="—"
                ref={itemRef(it.key, 'unit')}
                onKeyDown={(e) => itemKeyDown(e, it, idx, 'unit')}
                onChange={(e) => updateItem(it.key, { unit: e.target.value })}
              />
              <input
                type="number"
                min="0"
                className={`${inputCls} text-right`}
                value={it.price}
                ref={itemRef(it.key, 'price')}
                onKeyDown={(e) => itemKeyDown(e, it, idx, 'price')}
                onChange={(e) => updateItem(it.key, { price: Number(e.target.value) || 0 })}
              />
              <div className="text-right text-sm font-semibold">{fmtRupiah(it.subtotal)}</div>
              <button
                className="text-zinc-300 hover:text-red-500 text-sm"
                onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== it.key) : prev))}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <datalist id={`dl-${jenis}`}>
        {sourceFor(jenis).list.map((m) => (
          <option key={m.id} value={String(m.name)} />
        ))}
      </datalist>

      <datalist id="dl-suplier">
        {supliers.map((s) => (
          <option key={s.id} value={String(s.name)} />
        ))}
      </datalist>

      <datalist id="dl-subkon">
        {subkons.map((s) => (
          <option key={s.id} value={String(s.name)} />
        ))}
      </datalist>

      <div className="flex gap-2">
        <GhostButton
          onClick={addItemRow}
          className="text-xs px-3 py-1.5"
        >
          + Tambah item
        </GhostButton>
        <span className="text-xs text-zinc-400 self-center">
          Ketik lalu pilih dari daftar untuk auto-fill satuan &amp; harga
        </span>
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">
            Foto (opsional)
          </div>
          <GhostButton onClick={addPhotos} className="text-xs px-3 py-1.5">
            + Tambah Foto
          </GhostButton>
        </div>
        {(existingPhotos.length > 0 || stagedPhotos.length > 0) ? (
          <div className="grid grid-cols-4 gap-2">
            {existingPhotos.map((p) => (
              <div key={p.id} className="relative group rounded-md overflow-hidden border border-zinc-200">
                <img src={existingUrls[p.file_name] || ''} alt={p.file_name} className="w-full h-20 object-cover" />
                <button
                  onClick={() => removeExistingPhoto(p.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none hidden group-hover:flex items-center justify-center"
                  title="Hapus foto"
                >
                  ✕
                </button>
              </div>
            ))}
            {stagedPhotos.map((p) => (
              <div key={p.fileName} className="relative group rounded-md overflow-hidden border border-amber-300">
                <img src={p.dataUrl} alt={p.fileName} className="w-full h-20 object-cover" />
                <button
                  onClick={() => removeStagedPhoto(p.fileName)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none hidden group-hover:flex items-center justify-center"
                  title="Hapus foto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-400">Belum ada foto. Foto membantu dokumentasi nota.</div>
        )}
      </div>

      {showNewPersonel && (
        <Modal
          open
          onClose={() => setShowNewPersonel(false)}
          title="Personel Baru"
          footer={
            <>
              <span className="flex-1" />
              <GhostButton onClick={() => setShowNewPersonel(false)}>Batal</GhostButton>
              <PrimaryButton onClick={quickAddPersonel} disabled={!newPersonelName.trim() || !newPersonelTenaga}>
                Simpan
              </PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Nama" req>
              <input className={inputCls} value={newPersonelName} onChange={(e) => setNewPersonelName(e.target.value)} placeholder="Nama personel" />
            </Field>
            <Field label="Jenis Tenaga Kerja" req>
              <select
                className={selectCls}
                value={newPersonelTenaga}
                onChange={(e) => {
                  setNewPersonelTenaga(e.target.value)
                  const t = tenaga.find((x) => String(x.id) === e.target.value)
                  if (t) setNewPersonelUpah(String(Number(t.harga_satuan) || 0))
                }}
              >
                {tenaga.map((t) => (
                  <option key={t.id} value={t.id}>
                    {String(t.jenis ?? t.name)} — Rp {Number(t.harga_satuan) || 0}/OH
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Upah Harian (Rp)" req>
              <input
                className={inputCls}
                type="number"
                min="0"
                value={newPersonelUpah}
                onChange={(e) => setNewPersonelUpah(e.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}

      {showNewMaster && (
        <Modal
          open
          onClose={() => setShowNewMaster(false)}
          title={newMasterType === 'material' ? 'Material Baru' : newMasterType === 'pekerjaan' ? 'Pekerjaan Baru' : 'Alat Baru'}
          footer={
            <>
              <span className="flex-1" />
              <GhostButton onClick={() => setShowNewMaster(false)}>Batal</GhostButton>
              <PrimaryButton onClick={quickAddMaster} disabled={!newMasterName.trim()}>
                Simpan
              </PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Nama" req>
              <input
                className={inputCls}
                value={newMasterName}
                onChange={(e) => setNewMasterName(e.target.value)}
                placeholder={newMasterType === 'material' ? 'Nama material' : newMasterType === 'pekerjaan' ? 'Nama pekerjaan' : 'Nama alat'}
              />
            </Field>
            {newMasterType === 'material' && (
              <Field label="Spesifikasi">
                <input className={inputCls} value={newMasterSpec} onChange={(e) => setNewMasterSpec(e.target.value)} placeholder="Contoh: 50kg" />
              </Field>
            )}
            <Field label="Satuan">
              <input className={inputCls} value={newMasterUnit} onChange={(e) => setNewMasterUnit(e.target.value)} placeholder="Contoh: sak, m3, batang" />
            </Field>
            <Field label={newMasterType === 'material' && suplierId ? `Harga per Suplier (Rp)` : `Harga Satuan (Rp)`}>
              <input
                className={inputCls}
                type="number"
                min="0"
                value={newMasterPrice}
                onChange={(e) => setNewMasterPrice(e.target.value)}
                placeholder="0"
              />
            </Field>
            {newMasterType === 'material' && suplierId && (
              <p className="text-xs text-zinc-500">
                Harga ini akan disimpan sebagai harga khusus untuk <b>{suplierName || 'suplier terpilih'}</b>.
              </p>
            )}
          </div>
        </Modal>
      )}
    </Modal>
  )
}
