import { useEffect, useRef } from 'react'
import { Resizable } from 're-resizable'
import { useThemeStore } from './store/themeStore'
import { useAppStore } from './store/appStore'
import { usePlayerStore } from './store/playerStore'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import PlayerView from './components/PlayerView'
import SearchView from './components/SearchView'
import QueueView from './components/QueueView'
import SettingsView from './components/SettingsView'
import ThemeEditor from './components/ThemeEditor'
import NowPlayingBar from './components/NowPlayingBar'
import SplashScreen from './components/SplashScreen'

export default function App() {
  const { theme, loadTheme } = useThemeStore()
  const { page, showSplash, setShowSplash, sidebarWidth, setSidebarWidth } = useAppStore()
  const { currentTrack, savePlayback, loadPlayback } = usePlayerStore()
  const loadedRef = useRef(false)

  // Initialize audio player hooks
  useAudioPlayer()

  useEffect(() => {
    loadTheme()
    checkLoginStatus()

    // Load playback state from last session
    if (!loadedRef.current) {
      loadedRef.current = true
      loadPlayback()
      // Load saved sidebar width
      window.electronAPI?.storeGet?.('sidebarWidth').then((w: number) => {
        if (w && w >= 48 && w <= 220) setSidebarWidth(w)
      })
    }
  }, [])

  // Auto-save playback when track changes
  const prevTrackIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentTrack && currentTrack.id !== prevTrackIdRef.current) {
      prevTrackIdRef.current = currentTrack.id
      setTimeout(() => savePlayback(), 500)
    }
  }, [currentTrack])

  const checkLoginStatus = async () => {
    if (window.electronAPI) {
      const loggedIn = await window.electronAPI.spotifyIsLoggedIn()
      useAppStore.getState().setLoggedIn(loggedIn)
    }
  }

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--secondary', theme.secondary)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--bg', theme.background)
    root.style.setProperty('--surface', theme.surface)
    root.style.setProperty('--surface-alt', theme.surfaceAlt)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--text-secondary', theme.textSecondary)
    root.style.setProperty('--border', theme.border)
    root.style.setProperty('--error', theme.error)
    root.style.setProperty('--success', theme.success)
    root.style.setProperty('--warning', theme.warning)
    root.style.setProperty('--radius', `${theme.borderRadius}px`)
    root.style.setProperty('--spacing', `${theme.spacing}px`)
    root.style.setProperty('--font', theme.fontFamily)
    root.style.fontFamily = theme.fontFamily

    if (theme.blur) {
      root.style.setProperty('--glass-bg', `rgba(from ${theme.surface} r g b / 0.6)`)
    }

    root.style.transition = theme.animations ? 'all 0.2s ease' : 'none'
  }, [theme])

  const renderPage = () => {
    switch (page) {
      case 'player':
        return <PlayerView />
      case 'search':
        return <SearchView />
      case 'queue':
        return <QueueView />
      case 'settings':
        return <SettingsView />
      case 'theme-editor':
        return <ThemeEditor />
      default:
        return <PlayerView />
    }
  }

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{
          backgroundColor: theme.background,
          color: theme.text,
          fontFamily: theme.fontFamily,
          opacity: showSplash ? 0 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Resizable
            size={{ width: sidebarWidth, height: '100%' }}
            minWidth={48}
            maxWidth={220}
            onResizeStop={(_e, _dir, _ref, d) => {
              const newW = sidebarWidth + d.width
              if (newW >= 48 && newW <= 220) setSidebarWidth(newW)
            }}
            enable={{ right: true }}
            handleStyles={{
              right: {
                width: 4,
                cursor: 'col-resize',
                right: -2,
                zIndex: 10,
                opacity: 0,
                transition: 'opacity 0.2s',
              },
            }}
            handleClasses={{
              right: 'sidebar-resize-handle',
            }}
          >
            <Sidebar width={sidebarWidth} />
          </Resizable>
          <main className="flex-1 overflow-y-auto p-3 animate-fadeIn" style={{ padding: `${8 + theme.spacing}px` }}>
            {renderPage()}
          </main>
        </div>
        {currentTrack && <NowPlayingBar />}
      </div>
    </>
  )
}
