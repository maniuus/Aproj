import { create } from 'zustand'
import type { Project } from '../env.d'

interface AppState {
  workspace: { path: string; name: string } | null
  projects: Project[]
  activeTab: string
  activeProjectId: string | null
  setWorkspace: (w: { path: string; name: string } | null) => void
  setProjects: (p: Project[]) => void
  setActiveTab: (t: string) => void
  setActiveProjectId: (id: string | null | ((prev: string | null) => string | null)) => void
}

export const useAppStore = create<AppState>((set) => ({
  workspace: null,
  projects: [],
  activeTab: 'home',
  activeProjectId: null,
  setWorkspace: (w) => set({ workspace: w }),
  setProjects: (p) => set({ projects: p }),
  setActiveTab: (t) => set({ activeTab: t }),
  setActiveProjectId: (id) =>
    set((state) => ({ activeProjectId: typeof id === 'function' ? id(state.activeProjectId) : id }))
}))
