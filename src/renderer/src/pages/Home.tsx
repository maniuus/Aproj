import { useEffect, useState } from 'react'
import { useAppStore } from '../stores'
import { Card, CardBody, Field, GhostButton, Modal, PrimaryButton, inputCls, EmptyNote } from '../components/ui'
import { fmtDate } from '../lib/utils'

interface Recent {
  path: string
  name: string
  lastOpened: string
}

export default function Home({ onToast }: { onToast: (m: string) => void }) {
  const workspace = useAppStore((s) => s.workspace)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId)
  const [recents, setRecents] = useState<Recent[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => window.electronAPI.workspace.recent().then(setRecents)

  useEffect(() => {
    reload()
  }, [workspace])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    const w = await window.electronAPI.workspace.create({ name: name.trim() })
    setBusy(false)
    if (w) {
      setWorkspace(w)
      setShowCreate(false)
      setName('')
      onToast(`Workspace "${w.name}" dibuat`)
    }
  }

  const open = async () => {
    const w = await window.electronAPI.workspace.open()
    if (w) {
      setWorkspace(w)
      onToast(`Workspace "${w.name}" dibuka`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto pt-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">AProj</h1>
          <p className="text-sm text-zinc-500 mt-1">Administrasi Proyek Konstruksi — cashflow, kebutuhan &amp; master data dalam satu workspace.</p>
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <PrimaryButton onClick={() => setShowCreate(true)}>+ Buat Workspace Baru</PrimaryButton>
        <GhostButton onClick={open}>Buka Folder Workspace…</GhostButton>
      </div>

      <div className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-2">Workspace Terakhir</div>
      {recents.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyNote>Belum ada workspace. Buat satu untuk mulai mencatat cashflow proyek.</EmptyNote>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {recents.map((r) => (
            <Card key={r.path} className="hover:border-amber-500 cursor-pointer transition-colors">
              <CardBody className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-900">{r.name}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-md">{r.path}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">Terakhir: {fmtDate(r.lastOpened.slice(0, 10))}</span>
                  <button
                    onClick={() => {
                      window.electronAPI.workspace.removeRecent(r.path).then(reload)
                    }}
                    className="text-zinc-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              </CardBody>
              <button
                className="w-full text-left px-4 pb-3 text-sm text-amber-600 hover:text-amber-700"
                onClick={() => {
                  window.electronAPI.workspace.openPath(r.path).then((w) => {
                    if (w) {
                      setWorkspace(w)
                      setActiveTab('overview')
                    }
                  })
                }}
              >
                Buka →
              </button>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400 mt-8">
        1 workspace = 1 folder <code className="bg-zinc-100 px-1 rounded">.apro</code> berisi semua data (projek, nota, master data). Salin folder untuk pindah komputer.
      </p>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Buat Workspace Baru"
        sub="· 1 folder berisi semua projek Anda"
        footer={
          <>
            <span className="spacer flex-1" />
            <GhostButton onClick={() => setShowCreate(false)}>Batal</GhostButton>
            <PrimaryButton disabled={busy || !name.trim()} onClick={create}>
              Buat Workspace
            </PrimaryButton>
          </>
        }
      >
        <Field label="Nama Workspace" req>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Contoh: PT Abimanyu Konstruksi"
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  )
}
