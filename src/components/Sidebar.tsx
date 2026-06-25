import {
  Search, ListMusic, Palette, Settings,
  Disc3, LayoutGrid, Music, FileText
} from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { useAppStore } from '../store/appStore'
import { usePlayerStore } from '../store/playerStore'
import PixelMascot from './PixelMascot'

const navItems = [
  { id: 'player' as const, label: 'Now Playing', icon: LayoutGrid },
  { id: 'lyrics' as const, label: 'Lyrics', icon: FileText },
  { id: 'search' as const, label: 'Search', icon: Search },
  { id: 'queue' as const, label: 'Queue', icon: ListMusic },
  { id: 'theme-editor' as const, label: 'Themes', icon: Palette },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
]

interface Props {
  width: number
}

export default function Sidebar({ width }: Props) {
  const { theme } = useThemeStore()
  const { page, setPage } = useAppStore()
  const { currentTrack, isPlaying } = usePlayerStore()
  const expanded = width > 80

  return (
    <nav
      className="flex flex-col py-3 shrink-0 h-full"
      style={{
        width,
        background: theme.surface,
        borderRight: `1px solid ${theme.border}30`,
        transition: 'width 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo section */}
      <div
        className="flex items-center mb-5"
        style={{
          padding: expanded ? '0 14px' : '0',
          justifyContent: expanded ? 'flex-start' : 'center',
        }}
      >
        <div
          className="flex items-center justify-center rounded-xl overflow-hidden shrink-0"
          style={{
            width: 36,
            height: 36,
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
            boxShadow: `0 4px 12px ${theme.primary}40`,
          }}
        >
          <PixelMascot type={useThemeStore.getState().mascot} size={32} />
        </div>
        {expanded && (
          <span className="ml-2.5 text-sm font-bold tracking-wide" style={{ color: theme.text }}>
            Nyu<span style={{ color: theme.primary }}>'</span>rka
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-0.5 flex-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              className="flex items-center rounded-xl transition-all shrink-0 group"
              style={{
                height: 40,
                padding: expanded ? '0 10px' : '0',
                justifyContent: expanded ? 'flex-start' : 'center',
                color: isActive ? theme.primary : theme.textSecondary,
                background: isActive ? `${theme.primary}15` : 'transparent',
              }}
              onClick={() => setPage(item.id)}
              title={item.label}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              {expanded && (
                <span
                  className="text-xs font-medium ml-3 truncate"
                  style={{ color: isActive ? theme.primary : theme.textSecondary }}
                >
                  {item.label}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Now playing mini */}
      {currentTrack && (
        <div
          className="mt-auto pt-2 animate-fadeIn"
          style={{
            padding: expanded ? '8px' : '0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {expanded ? (
            <div
              className="flex items-center gap-2.5 rounded-xl w-full"
              style={{ background: `${theme.primary}10`, padding: '6px 8px', overflow: 'hidden' }}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: theme.surfaceAlt }}>
                {currentTrack.albumArt ? (
                  <img src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music size={14} style={{ color: theme.textSecondary }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium truncate" style={{ color: theme.text }}>{currentTrack.title}</div>
                <div className="text-[9px] truncate" style={{ color: theme.textSecondary }}>{currentTrack.artist}</div>
              </div>
              <Disc3 size={14} style={{ color: theme.primary, flexShrink: 0 }} className={isPlaying ? 'animate-spin-slow' : ''} />
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ padding: '6px' }}>
              <Disc3 size={20} style={{ color: theme.primary }} className={isPlaying ? 'animate-spin-slow' : ''} />
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
