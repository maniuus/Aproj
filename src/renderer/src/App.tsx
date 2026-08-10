import { useEffect, useState } from 'react'
import { useAppStore } from './stores'
import Home from './pages/Home'
import Overview from './pages/Overview'
import Cashflow from './pages/Cashflow'
import BalanceSheet from './pages/BalanceSheet'
import Desk from './pages/Desk'
import Projek from './pages/Projek'
import Master from './pages/Master'
import { Toast } from './components/ui'

type Tab = 'home' | 'overview' | 'cashflow' | 'balancesheet' | 'desk' | 'projek' | 'master'

const NAV: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Workspace' },
  { key: 'overview', label: 'Overview' },
  { key: 'cashflow', label: 'Daily Cashflow' },
  { key: 'balancesheet', label: 'Balance Sheet' },
  { key: 'desk', label: 'Desk' },
  { key: 'projek', label: 'Projek' }
]

const MASTER_LINKS = ['Suplier', 'Material', 'Gudang', 'Pekerja', 'Alat', 'Subkon', 'Pekerjaan']

export default function App() {
  const workspace = useAppStore((s) => s.workspace)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const projects = useAppStore((s) => s.projects)
  const setProjects = useAppStore((s) => s.setProjects)
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.workspace.getCurrent().then((w) => {
      if (w) setWorkspace({ path: w.path, name: w.name })
    })
  }, [setWorkspace])

  useEffect(() => {
    if (!workspace) return
    window.electronAPI.project.list().then((list) => {
      setProjects(list)
      setActiveProjectId((prev) => (list.some((p) => p.id === prev) ? prev : list[0]?.id ?? null))
    })
  }, [workspace, setProjects, setActiveProjectId])

  if (!workspace) {
    return (
      <div className="h-full">
        <Home onToast={setToast} />
        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const backup = async () => {
    const r = await window.electronAPI.workspace.export()
    if (r.ok) setToast(`Backup tersimpan: ${r.path}`)
    else if (!r.canceled) setToast('Backup gagal')
  }

  const restore = async () => {
    const r = await window.electronAPI.workspace.import()
    if (r.ok && r.path) {
      setWorkspace({ path: r.path, name: r.name ?? '' })
      setActiveProjectId(null)
      setActiveTab('overview')
      setToast(`Workspace "${r.name}" dipulihkan`)
    } else if (!r.canceled) {
      setToast('Restore gagal')
    }
  }

  return (
    <div className="h-full flex">
      <aside className="w-56 shrink-0 bg-zinc-900 text-zinc-300 flex flex-col">
        <div className="px-4 py-4">
          <div className="text-lg font-bold">
            A<span className="text-amber-500">Proj</span>
          </div>
          <div className="text-xs text-zinc-500 truncate mt-0.5">{workspace.name}</div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setActiveTab(n.key)}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                activeTab === n.key ? 'bg-amber-500 text-zinc-900 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {n.label}
            </button>
          ))}
          <div className="text-xs text-zinc-500 px-3 pt-4 pb-1 uppercase tracking-wider">Master Data</div>
          {MASTER_LINKS.map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab('master')}
              className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                activeTab === 'master' ? 'bg-amber-500 text-zinc-900 font-semibold' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              {m}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800 space-y-1">
          <button
            onClick={backup}
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            Backup Workspace…
          </button>
          <button
            onClick={restore}
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            Restore dari Backup…
          </button>
          <button
            onClick={() => {
              setWorkspace(null)
              setActiveProjectId(null)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-400 hover:text-white rounded-lg pt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            ← Kembali ke daftar workspace
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {activeTab !== 'home' && (
          <div className="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200 px-6 py-2.5 flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              <span className="font-semibold text-zinc-900">{workspace.name}</span>
              {activeProject && <span className="text-zinc-400"> / {activeProject.name}</span>}
            </span>
            <select
              className="ml-auto px-2 py-1 text-sm border border-zinc-300 rounded-md bg-white"
              value={activeProjectId ?? ''}
              onChange={(e) => setActiveProjectId(e.target.value || null)}
            >
              <option value="">Semua projek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="p-6">
          {activeTab === 'home' && <Home onToast={setToast} />}
          {activeTab === 'overview' && <Overview onToast={setToast} />}
          {activeTab === 'cashflow' && <Cashflow onToast={setToast} />}
          {activeTab === 'balancesheet' && <BalanceSheet />}
          {activeTab === 'desk' && <Desk onToast={setToast} />}
          {activeTab === 'projek' && <Projek onToast={setToast} />}
          {activeTab === 'master' && <Master />}
        </div>
      </main>

      {toast && <Toast msg={toast} />}
    </div>
  )
}
