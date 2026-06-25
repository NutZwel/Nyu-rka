import { create } from 'zustand'

interface AppState {
  page: 'player' | 'search' | 'queue' | 'playlist' | 'settings' | 'theme-editor' | 'lyrics'
  alwaysOnTop: boolean
  isLoggedIn: boolean
  isMinimalView: boolean
  searchQuery: string
  showSplash: boolean
  sidebarWidth: number

  setPage: (page: AppState['page']) => void
  setAlwaysOnTop: (val: boolean) => void
  setLoggedIn: (val: boolean) => void
  toggleMinimalView: () => void
  setSearchQuery: (q: string) => void
  setShowSplash: (val: boolean) => void
  setSidebarWidth: (w: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  page: 'player',
  alwaysOnTop: false,
  isLoggedIn: false,
  isMinimalView: false,
  searchQuery: '',
  showSplash: true,
  sidebarWidth: 64,

  setPage: (page) => set({ page }),
  setAlwaysOnTop: (val) => set({ alwaysOnTop: val }),
  setLoggedIn: (val) => set({ isLoggedIn: val }),

  toggleMinimalView: () => {
    set(state => ({ isMinimalView: !state.isMinimalView }))
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowSplash: (val) => set({ showSplash: val }),

  setSidebarWidth: (w) => {
    set({ sidebarWidth: w })
    window.electronAPI?.storeSet?.('sidebarWidth', w)
  },
}))
