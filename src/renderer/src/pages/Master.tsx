import { useCallback, useEffect, useState } from 'react'
import { Card, CardBody, Field, GhostButton, Modal, PrimaryButton, DangerButton, MutedButton, Confirm, inputCls, EmptyNote, Badge } from '../components/ui'
import { fmtRupiah, uid } from '../lib/utils'
import type { MasterRow } from '../env.d'

type TabKey = 'suplier' | 'material' | 'gudang' | 'pekerja' | 'tenaga' | 'alat' | 'subkon' | 'pekerjaan'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'suplier', label: 'Suplier' },
  { key: 'material', label: 'Material' },
  { key: 'gudang', label: 'Gudang' },
  { key: 'pekerja', label: 'Pekerja' },
  { key: 'tenaga', label: 'Tenaga Kerja' },
  { key: 'alat', label: 'Alat' },
  { key: 'subkon', label: 'Subkon' },
  { key: 'pekerjaan', label: 'Pekerjaan' }
]

interface SimpleCrud {
  table: string
  fields: { key: string; label: string; type?: 'number' | 'text' }[]
  priceNote?: string
}

const CONFIGS: Record<TabKey, SimpleCrud> = {
  suplier: { table: 'supliers', fields: [{ key: 'name', label: 'Nama Toko' }, { key: 'phone', label: 'Nomor Telepon' }, { key: 'address', label: 'Alamat' }, { key: 'notes', label: 'Catatan' }] },
  gudang: { table: 'gudangs', fields: [{ key: 'name', label: 'Nama' }, { key: 'lokasi', label: 'Lokasi' }, { key: 'notes', label: 'Catatan' }] },
  pekerja: { table: 'pekerjas', fields: [{ key: 'name', label: 'Nama' }, { key: 'tenaga_kerja_id', label: 'Jenis', type: 'text' }, { key: 'upah_harian', label: 'Upah Harian', type: 'number' }, { key: 'notes', label: 'Catatan' }] },
  tenaga: { table: 'tenaga_kerja', fields: [{ key: 'jenis', label: 'Jenis' }, { key: 'unit', label: 'Satuan' }, { key: 'harga_satuan', label: 'Harga Satuan', type: 'number' }, { key: 'notes', label: 'Catatan' }] },
  alat: { table: 'alats', fields: [{ key: 'name', label: 'Nama Alat' }, { key: 'unit', label: 'Satuan' }, { key: 'harga_satuan', label: 'Harga Satuan', type: 'number' }, { key: 'notes', label: 'Catatan' }] },
  subkon: { table: 'subkontraktors', fields: [{ key: 'name', label: 'Nama Subkon' }, { key: 'phone', label: 'Nomor Telepon' }, { key: 'address', label: 'Alamat' }, { key: 'notes', label: 'Catatan' }] },
  pekerjaan: { table: 'pekerjaans', fields: [{ key: 'name', label: 'Nama Pekerjaan' }, { key: 'unit', label: 'Satuan' }, { key: 'harga_satuan', label: 'Harga Satuan', type: 'number' }, { key: 'notes', label: 'Catatan' }] },
  material: { table: 'materials', fields: [{ key: 'name', label: 'Nama Material' }, { key: 'spesifikasi', label: 'Spesifikasi' }, { key: 'unit', label: 'Satuan' }, { key: 'notes', label: 'Catatan' }] }
}

export default function Master() {
  const [tab, setTab] = useState<TabKey>('suplier')
  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              tab === t.key
                ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                : 'bg-white border-zinc-300 text-zinc-600 hover:border-amber-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'material' ? (
        <MaterialTab />
      ) : tab === 'pekerja' ? (
        <PekerjaTab />
      ) : (
        <SimpleCrudTab config={CONFIGS[tab]} />
      )}
    </div>
  )
}

// ---------------- Simple CRUD

function SimpleCrudTab({ config }: { config: SimpleCrud }) {
  const [rows, setRows] = useState<MasterRow[]>([])
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<MasterRow | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [del, setDel] = useState<MasterRow | null>(null)

  const reload = useCallback(() => {
    window.electronAPI.master.list(config.table).then(setRows)
  }, [config.table])

  useEffect(() => {
    reload()
  }, [reload])

  const openAdd = () => {
    setEditing(null)
    setForm({})
    setShow(true)
  }

  const openEdit = (row: MasterRow) => {
    setEditing(row)
    const f: Record<string, string> = {}
    config.fields.forEach((fld) => {
      const v = row[fld.key]
      f[fld.key] = v === null || v === undefined ? '' : String(v)
    })
    setForm(f)
    setShow(true)
  }

  const submit = async () => {
    const row: Record<string, unknown> = {}
    config.fields.forEach((fld) => {
      const v = form[fld.key] ?? ''
      row[fld.key] = fld.type === 'number' ? Number(v) || 0 : v.trim()
    })
    if (editing) await window.electronAPI.master.update(config.table, editing.id, row)
    else await window.electronAPI.master.insert(config.table, row)
    setShow(false)
    reload()
  }

  const labelOf = (r: MasterRow) => String(r.name ?? r.jenis ?? r.id)

  return (
    <Card>
      <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700">{label(config.table)}</span>
        <PrimaryButton onClick={openAdd} className="text-xs px-3 py-1.5">
          + Tambah
        </PrimaryButton>
      </div>
      {rows.length === 0 ? (
        <CardBody>
          <EmptyNote>Belum ada data</EmptyNote>
        </CardBody>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
              <th className="px-4 py-2.5">{config.fields[0]?.label ?? 'Nama'}</th>
              {config.fields.slice(1, 3).map((f) => (
                <th key={f.key} className="px-4 py-2.5">
                  {f.label}
                </th>
              ))}
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5 font-medium">{labelOf(r)}</td>
                {config.fields.slice(1, 3).map((f) => (
                  <td key={f.key} className="px-4 py-2.5 text-zinc-600">
                    {f.type === 'number' ? fmtRupiah(Number(r[f.key]) || 0) : String(r[f.key] ?? '—')}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <MutedButton onClick={() => openEdit(r)}>
                    Edit
                  </MutedButton>
                  <DangerButton onClick={() => setDel(r)}>
                    Hapus
                  </DangerButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editing ? 'Edit' : '+ Tambah'}
        footer={
          <>
            <span className="flex-1" />
            <GhostButton onClick={() => setShow(false)}>Batal</GhostButton>
            <PrimaryButton onClick={submit}>Simpan</PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          {config.fields.map((f) => (
            <Field key={f.key} label={f.label} req={f.key === config.fields[0].key}>
              <input
                className={inputCls}
                type={f.type === 'number' ? 'number' : 'text'}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </Modal>

      <Confirm
        open={!!del}
        title="Hapus data"
        message={`Yakin hapus "${del ? labelOf(del) : ''}"? Tindakan ini tidak bisa dibatalkan.`}
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (!del) return
          window.electronAPI.master
            .remove(config.table, del.id)
            .then(() => {
              setDel(null)
              reload()
            })
            .catch((e) => console.error('gagal hapus', e))
        }}
      />
    </Card>
  )
}

// ---------------- Material tab (dengan harga per suplier)

function MaterialTab() {
  const [materials, setMaterials] = useState<MasterRow[]>([])
  const [supliers, setSupliers] = useState<MasterRow[]>([])
  const [prices, setPrices] = useState<MasterRow[]>([])
  const [showMat, setShowMat] = useState(false)
  const [editMat, setEditMat] = useState<MasterRow | null>(null)
  const [delMat, setDelMat] = useState<MasterRow | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [priceForm, setPriceForm] = useState({ material_id: '', suplier_id: '', price: '' })
  const [showPrice, setShowPrice] = useState(false)

  const reload = () => {
    window.electronAPI.master.list('materials').then(setMaterials)
    window.electronAPI.master.list('supliers').then(setSupliers)
    window.electronAPI.prices.list('material_prices').then(setPrices)
  }

  useEffect(reload, [])

  const openAddMat = () => {
    setEditMat(null)
    setForm({})
    setShowMat(true)
  }

  const submitMat = async () => {
    const row = {
      name: form.name?.trim() ?? '',
      spesifikasi: form.spesifikasi?.trim() ?? '',
      unit: form.unit?.trim() ?? '',
      notes: form.notes?.trim() ?? ''
    }
    if (editMat) await window.electronAPI.master.update('materials', editMat.id, row)
    else await window.electronAPI.master.insert('materials', row)
    setShowMat(false)
    reload()
  }

  const submitPrice = async () => {
    if (!priceForm.material_id || !priceForm.suplier_id) return
    await window.electronAPI.prices.upsert('material_prices', {
      material_id: priceForm.material_id,
      suplier_id: priceForm.suplier_id,
      price: Number(priceForm.price) || 0
    })
    setShowPrice(false)
    setPriceForm({ material_id: '', suplier_id: '', price: '' })
    reload()
  }

  return (
    <Card>
      <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700">Material &amp; Harga per Suplier</span>
        <div className="flex gap-2">
          <GhostButton onClick={() => setShowPrice(true)} className="text-xs px-3 py-1.5">
            + Harga Suplier
          </GhostButton>
          <PrimaryButton onClick={openAddMat} className="text-xs px-3 py-1.5">
            + Material
          </PrimaryButton>
        </div>
      </div>
      {materials.length === 0 ? (
        <CardBody>
          <EmptyNote>Belum ada material</EmptyNote>
        </CardBody>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
              <th className="px-4 py-2.5">Material</th>
              <th className="px-4 py-2.5">Spesifikasi</th>
              <th className="px-4 py-2.5">Satuan</th>
              <th className="px-4 py-2.5">Harga Terendah</th>
              <th className="px-4 py-2.5">Jml Suplier</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const mPrices = prices.filter((p) => p.material_id === m.id)
              const min = mPrices.reduce((s, p) => Math.min(s, Number(p.price) || 0), Infinity)
              return (
                <tr key={m.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium">{String(m.name)}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{String(m.spesifikasi ?? '—')}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{String(m.unit ?? '—')}</td>
                  <td className="px-4 py-2.5 text-zinc-900">
                    {mPrices.length ? (
                      <span className="text-emerald-600 font-semibold">{fmtRupiah(min)}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {mPrices.length ? <Badge tone="amber">{mPrices.length}</Badge> : <span className="text-zinc-400">0</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <MutedButton
                      onClick={() => {
                        setEditMat(m)
                        setForm({ name: String(m.name), spesifikasi: String(m.spesifikasi ?? ''), unit: String(m.unit ?? ''), notes: String(m.notes ?? '') })
                        setShowMat(true)
                      }}
                    >
                      Edit
                    </MutedButton>
                    <DangerButton
                      onClick={() => setDelMat(m)}
                    >
                      Hapus
                    </DangerButton>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <p className="px-4 py-3 text-xs text-zinc-400">
        Harga material unik per pasangan material × suplier. Klik '+ Harga Suplier' untuk mencatat harga di toko tertentu.
      </p>

      <Modal open={showMat} onClose={() => setShowMat(false)} title={editMat ? 'Edit Material' : '+ Material'} footer={<>
        <span className="flex-1" />
        <GhostButton onClick={() => setShowMat(false)}>Batal</GhostButton>
        <PrimaryButton onClick={submitMat}>Simpan</PrimaryButton>
      </>}>
        <div className="space-y-3">
          <Field label="Nama Material" req><input className={inputCls} value={form.name ?? ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Spesifikasi"><input className={inputCls} value={form.spesifikasi ?? ''} onChange={(e) => setForm((p) => ({ ...p, spesifikasi: e.target.value }))} /></Field>
          <Field label="Satuan"><input className={inputCls} value={form.unit ?? ''} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal open={showPrice} onClose={() => setShowPrice(false)} title="+ Harga per Suplier" footer={<>
        <span className="flex-1" />
        <GhostButton onClick={() => setShowPrice(false)}>Batal</GhostButton>
        <PrimaryButton onClick={submitPrice} disabled={!priceForm.material_id || !priceForm.suplier_id}>Simpan</PrimaryButton>
      </>}>
        <div className="space-y-3">
          <Field label="Material" req>
            <select className={inputCls} value={priceForm.material_id} onChange={(e) => setPriceForm((p) => ({ ...p, material_id: e.target.value }))}>
              <option value="">— Pilih —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{String(m.name)}</option>
              ))}
            </select>
          </Field>
          <Field label="Suplier" req>
            <select className={inputCls} value={priceForm.suplier_id} onChange={(e) => setPriceForm((p) => ({ ...p, suplier_id: e.target.value }))}>
              <option value="">— Pilih —</option>
              {supliers.map((s) => (
                <option key={s.id} value={s.id}>{String(s.name)}</option>
              ))}
            </select>
          </Field>
          <Field label="Harga Satuan" req>
            <input className={inputCls} type="number" value={priceForm.price} onChange={(e) => setPriceForm((p) => ({ ...p, price: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!delMat}
        title="Hapus material"
        message={`Yakin hapus "${delMat ? String(delMat.name ?? delMat.id) : ''}"? Harga suplier terkait ikut terhapus.`}
        onCancel={() => setDelMat(null)}
        onConfirm={() => {
          if (!delMat) return
          window.electronAPI.master
            .remove('materials', delMat.id)
            .then(() => {
              setDelMat(null)
              reload()
            })
            .catch((e) => console.error('gagal hapus', e))
        }}
      />
    </Card>
  )
}

// ---------------- Pekerja tab

function PekerjaTab() {
  const [pekerjas, setPekerjas] = useState<MasterRow[]>([])
  const [tenaga, setTenaga] = useState<MasterRow[]>([])
  const [show, setShow] = useState(false)
  const [edit, setEdit] = useState<MasterRow | null>(null)
  const [del, setDel] = useState<MasterRow | null>(null)
  const [form, setForm] = useState({ name: '', tenaga_kerja_id: '', upah_harian: '', notes: '' })

  const reload = () => {
    window.electronAPI.master.list('pekerjas').then(setPekerjas)
    window.electronAPI.master.list('tenaga_kerja').then(setTenaga)
  }

  useEffect(reload, [])

  const submit = async () => {
    const row = {
      name: form.name.trim(),
      tenaga_kerja_id: form.tenaga_kerja_id || null,
      upah_harian: Number(form.upah_harian) || 0,
      notes: form.notes.trim()
    }
    if (edit) await window.electronAPI.master.update('pekerjas', edit.id, row)
    else await window.electronAPI.master.insert('pekerjas', row)
    setShow(false)
    reload()
  }

  return (
    <Card>
      <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700">Pekerja (Personel Tenaga)</span>
        <PrimaryButton
          onClick={() => {
            setEdit(null)
            setForm({ name: '', tenaga_kerja_id: '', upah_harian: '', notes: '' })
            setShow(true)
          }}
          className="text-xs px-3 py-1.5"
        >
          + Tambah Pekerja
        </PrimaryButton>
      </div>
      {pekerjas.length === 0 ? (
        <CardBody>
          <EmptyNote>Belum ada pekerja</EmptyNote>
        </CardBody>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-200 text-left">
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">Jenis</th>
              <th className="px-4 py-2.5 text-right">Upah Harian</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {pekerjas.map((p) => {
              const jenis = tenaga.find((t) => t.id === p.tenaga_kerja_id)
              return (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium">{String(p.name)}</td>
                  <td className="px-4 py-2.5">
                    {jenis ? <Badge tone="blue">{String(jenis.jenis)}</Badge> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmtRupiah(Number(p.upah_harian) || 0)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <MutedButton
                      onClick={() => {
                        setEdit(p)
                        setForm({
                          name: String(p.name),
                          tenaga_kerja_id: String(p.tenaga_kerja_id ?? ''),
                          upah_harian: String(p.upah_harian ?? ''),
                          notes: String(p.notes ?? '')
                        })
                        setShow(true)
                      }}
                    >
                      Edit
                    </MutedButton>
                    <DangerButton onClick={() => setDel(p)}>Hapus</DangerButton>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <Modal open={show} onClose={() => setShow(false)} title={edit ? 'Edit Pekerja' : '+ Pekerja'} footer={<>
        <span className="flex-1" />
        <GhostButton onClick={() => setShow(false)}>Batal</GhostButton>
        <PrimaryButton onClick={submit} disabled={!form.name.trim()}>Simpan</PrimaryButton>
      </>}>
        <div className="space-y-3">
          <Field label="Nama" req><input className={inputCls} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Jenis Tenaga Kerja">
            <select className={inputCls} value={form.tenaga_kerja_id} onChange={(e) => setForm((p) => ({ ...p, tenaga_kerja_id: e.target.value }))}>
              <option value="">— Pilih —</option>
              {tenaga.map((t) => (
                <option key={t.id} value={t.id}>{String(t.jenis)}</option>
              ))}
            </select>
          </Field>
          <Field label="Upah Harian (Rp)"><input className={inputCls} type="number" value={form.upah_harian} onChange={(e) => setForm((p) => ({ ...p, upah_harian: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Confirm
        open={!!del}
        title="Hapus pekerja"
        message={`Yakin hapus "${del ? String(del.name ?? del.id) : ''}"?`}
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (!del) return
          window.electronAPI.master
            .remove('pekerjas', del.id)
            .then(() => {
              setDel(null)
              reload()
            })
            .catch((e) => console.error('gagal hapus', e))
        }}
      />
    </Card>
  )
}

function label(table: string): string {
  const map: Record<string, string> = {
    supliers: 'Suplier (Toko)',
    gudangs: 'Logistik / Gudang',
    tenaga_kerja: 'Tenaga Kerja (Jenis)',
    alats: 'Alat',
    subkontraktors: 'Subkontraktor',
    pekerjaans: 'Pekerjaan'
  }
  return map[table] ?? table
}
