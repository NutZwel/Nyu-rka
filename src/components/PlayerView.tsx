import {
  Play, Pause, SkipForward, SkipBack,
  Shuffle, Repeat, Repeat1, Music, Disc3,
  Volume2, Volume1, VolumeX, Search
} from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { usePlayerStore } from '../store/playerStore'
import { useAppStore } from '../store/appStore'
import DancingRobot from './DancingRobot'
import PixelMascot from './PixelMascot'

function invertHex(hex: string): string {
  const c = hex.replace('#', '')
  const r = (255 - parseInt(c.substring(0,2), 16)).toString(16).padStart(2,'0')
  const g = (255 - parseInt(c.substring(2,4), 16)).toString(16).padStart(2,'0')
  const b = (255 - parseInt(c.substring(4,6), 16)).toString(16).padStart(2,'0')
  return `#${r}${g}${b}`
}

export default function PlayerView() {
  const { theme } = useThemeStore()
  const {
    currentTrack, isPlaying, volume, progress, duration,
    loopMode, shuffle, togglePlay, setVolume,
    setProgress, setLoopMode, toggleShuffle, nextTrack, prevTrack,
  } = usePlayerStore()
  const { setPage, setSearchQuery } = useAppStore()

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-fadeIn" style={{ gap: 20 }}>
      {currentTrack ? (
        <>
          {/* Album Art */}
          <div className="relative group" style={{ filter: isPlaying ? 'drop-shadow(0 0 0)' : undefined }}>
            {/* Shadow berlawanan — gelap kalau background terang, terang kalau background gelap */}
            <div
              className="absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                top: 8,
                left: 8,
                background: invertHex(theme.background),
                opacity: 0.25,
                filter: 'blur(24px)',
                transform: 'translateY(8px) scale(0.95)',
                transition: 'all 0.3s ease',
              }}
            />
            {isPlaying && (
              <div
                className="absolute rounded-full animate-spin-slow"
                style={{
                  width: 224,
                  height: 224,
                  top: -12,
                  left: -12,
                  border: '2px solid',
                  borderColor: `${theme.primary}30`,
                  borderTopColor: theme.primary,
                }}
              />
            )}
            <div
              className="overflow-hidden rounded-full"
              style={{
                width: 200,
                height: 200,
                boxShadow: `0 8px 32px ${theme.primary}30`,
              }}
            >
              {currentTrack.albumArt ? (
                <img
                  src={currentTrack.albumArt}
                  alt=""
                  className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
                  style={{ transition: 'all 0.3s ease' }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: theme.surfaceAlt }}
                >
                  <Disc3 size={60} style={{ color: theme.textSecondary }} />
                </div>
              )}
            </div>

            {/* Play overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                className="rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{
                  width: 56,
                  height: 56,
                  background: theme.primary,
                  boxShadow: `0 4px 20px ${theme.primary}80`,
                }}
                onClick={togglePlay}
              >
                {isPlaying ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" />}
              </button>
            </div>

            {/* EQ bars */}
            {isPlaying && (
              <div className="absolute bottom-3 right-3 flex items-end gap-[3px]">
                {[4, 7, 5, 9, 6].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{
                      height: h,
                      background: theme.accent,
                      animation: `bar ${0.3 + i * 0.1}s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="text-center max-w-[260px]">
            <div className="text-lg font-bold truncate" style={{ color: theme.text }}>
              {currentTrack.title}
            </div>
            <div className="text-sm truncate mt-0.5" style={{ color: theme.textSecondary }}>
              {currentTrack.artist}
            </div>
            <div className="text-xs truncate mt-0.5" style={{ color: theme.textSecondary + '90' }}>
              {currentTrack.album}
            </div>
          </div>

          {/* Simple range slider untuk seek */}
          <div className="w-full max-w-[280px] flex items-center gap-2">
            <span className="text-xs tabular-nums font-mono" style={{ color: theme.textSecondary, minWidth: 32 }}>
              {fmt(progress)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={progress}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                ;(window as any).__seekAudio?.(val)
              }}
              className="flex-1"
              style={{
                height: 4,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${progressPct}%, ${theme.surfaceAlt} ${progressPct}%, ${theme.surfaceAlt} 100%)`,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            <span className="text-xs tabular-nums font-mono" style={{ color: theme.textSecondary, minWidth: 32 }}>
              {fmt(duration)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button className="btn-icon" onClick={toggleShuffle}
              style={{ color: shuffle ? theme.accent : theme.textSecondary }}>
              <Shuffle size={16} />
            </button>
            <button className="btn-icon" onClick={() => prevTrack()}>
              <SkipBack size={20} />
            </button>
            <button
              className="flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                width: 56, height: 56,
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                color: '#fff',
                boxShadow: `0 4px 20px ${theme.primary}50`,
              }}
              onClick={togglePlay}
            >
              {isPlaying ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" />}
            </button>
            <button className="btn-icon" onClick={() => nextTrack()}>
              <SkipForward size={20} />
            </button>
            <button className="btn-icon relative" onClick={() => {
              const modes: ('none' | 'one' | 'all')[] = ['none', 'all', 'one']
              const idx = modes.indexOf(loopMode)
              setLoopMode(modes[(idx + 1) % modes.length])
            }} style={{ color: loopMode !== 'none' ? theme.accent : theme.textSecondary }}>
              {loopMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 w-full max-w-[180px]">
            {volume === 0 ? <VolumeX size={14} style={{ color: theme.textSecondary }} /> :
             volume < 0.5 ? <Volume1 size={14} style={{ color: theme.textSecondary }} /> :
             <Volume2 size={14} style={{ color: theme.textSecondary }} />}
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1"
              style={{
                background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${volume * 100}%, ${theme.surfaceAlt} ${volume * 100}%, ${theme.surfaceAlt} 100%)`,
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full animate-fadeIn" style={{ gap: 16 }}>
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 140,
              height: 140,
              background: `linear-gradient(135deg, ${theme.primary}20, ${theme.secondary}20)`,
              boxShadow: `0 0 40px ${theme.primary}20, inset 0 0 40px ${theme.secondary}10`,
            }}
          >
            <PixelMascot type={useThemeStore.getState().mascot || 'whale'} size={120} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold" style={{ color: theme.text }}>
              Nothing Playing
            </div>
            <div className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              Search for music to start
            </div>
          </div>
          <button
            className="px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
              color: '#fff',
              boxShadow: `0 4px 16px ${theme.primary}50`,
            }}
            onClick={() => { setPage('search'); setSearchQuery('') }}
          >
            <Search size={16} />
            Find Music
          </button>
        </div>
      )}
    </div>
  )
}
