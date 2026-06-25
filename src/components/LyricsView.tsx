import { useEffect, useRef, useMemo } from 'react'
import { Music } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { usePlayerStore } from '../store/playerStore'
import { useLyrics } from '../hooks/useLyrics'

// --- Gradient sweep animation kayak Spicy Lyrics ---
// CSS keyframes buat progress gradient scan
const scanKeyframes = `
@keyframes lyricScan {
  0% { --grad-pos: -50%; }
  100% { --grad-pos: 150%; }
}
@keyframes fadeScaleIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes fadeScaleOut {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.92); }
}
`

export default function LyricsView() {
  const { theme } = useThemeStore()
  const { currentTrack, progress, duration } = usePlayerStore()
  const { lyrics, isLoading, activeLine } = useLyrics()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const injectRef = useRef(false)

  // Inject keyframes once
  useEffect(() => {
    if (injectRef.current) return
    injectRef.current = true
    const style = document.createElement('style')
    style.id = 'lyrics-scan-keyframes'
    style.textContent = scanKeyframes
    document.head.appendChild(style)
    return () => {
      const el = document.getElementById('lyrics-scan-keyframes')
      if (el) el.remove()
    }
  }, [])

  // Auto-scroll ke lirik aktif (smooth, center)
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current
      const el = activeRef.current
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2
      container.scrollTo({
        top: container.scrollTop + offset,
        behavior: 'smooth',
      })
    }
  }, [activeLine])

  // Hitung progress percentage buat gradient sweep
  const lineProgress = useMemo(() => {
    if (!lyrics?.syncedLyrics?.length || activeLine < 0 || !progress || !duration) return 0
    const currentLine = lyrics.syncedLyrics[activeLine]
    if (!currentLine) return 0
    const nextLine = lyrics.syncedLyrics[activeLine + 1]
    const lineStart = currentLine.time
    const lineEnd = nextLine?.time ?? duration
    const lineDuration = lineEnd - lineStart
    if (lineDuration <= 0) return 0
    return Math.min((progress - lineStart) / lineDuration, 1)
  }, [lyrics, activeLine, progress, duration])

  // Synced lyrics
  if (lyrics?.syncedLyrics?.length && lyrics.syncedLyrics.length > 0) {
    return (
      <div className="flex flex-col h-full animate-fadeIn">
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            scrollBehavior: 'smooth',
          }}
        >
          <div
            className="flex flex-col items-center min-h-full"
            style={{ padding: '45% 0 50% 0' }}
          >
            {lyrics.syncedLyrics.map((line, idx) => {
              const isActive = idx === activeLine
              const distance = Math.abs(idx - activeLine)

              // Scale & blur effect — active terbesar, makin jauh makin kecil & blur
              const fontSize = isActive ? 23 : Math.max(13, 23 - distance * 2.8)
              const opacityVal = isActive ? 1 : Math.max(0.08, 1 - distance * 0.22)
              const blurVal = isActive ? 0 : Math.min(5, (distance - 1) * 1.5)
              const scaleVal = isActive ? 1 : Math.max(0.8, 1 - distance * 0.05)

              return (
                <div
                  key={idx}
                  ref={isActive ? activeRef : undefined}
                  className="transition-all duration-[400ms] select-none"
                  style={{
                    fontSize,
                    lineHeight: 1.65,
                    fontWeight: 600,
                    textAlign: 'center',
                    width: '100%',
                    maxWidth: 380,
                    padding: '3px 20px',
                    color: theme.textSecondary,
                    opacity: opacityVal,
                    filter: blurVal > 0 ? `blur(${blurVal}px)` : 'none',
                    transform: `scale(${scaleVal})`,
                    transformOrigin: 'center center',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    WebkitTextFillColor: isActive ? 'transparent' : theme.textSecondary,
                    backgroundImage: isActive
                      ? `linear-gradient(90deg,
                          ${theme.text} 0%,
                          ${theme.text} ${lineProgress * 100}%,
                          ${theme.textSecondary + '90'} ${lineProgress * 100}%,
                          ${theme.textSecondary + '90'} 100%)`
                      : 'none',
                    backgroundClip: isActive ? 'text' : 'unset',
                    WebkitBackgroundClip: isActive ? 'text' : 'unset',
                    position: 'relative',
                    textShadow: isActive
                      ? `0 0 24px ${theme.primary}40`
                      : (distance <= 1 ? `0 0 8px ${theme.primary}15` : 'none'),
                    margin: '1px 0',
                  }}
                >
                  {line.text}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Plain lyrics (unsynced)
  if (lyrics?.plainLyrics) {
    return (
      <div className="flex flex-col h-full animate-fadeIn" style={{ paddingBottom: 16 }}>
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto flex items-start justify-center"
        >
          <div
            className="text-sm leading-relaxed whitespace-pre-line text-center max-w-[400px]"
            style={{ color: theme.textSecondary, padding: '0 16px' }}
          >
            {lyrics.plainLyrics}
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 20 }}>
        {/* Spicy-style loader bars */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: `${theme.surfaceAlt}` }}>
            <div className="flex items-end gap-[3px] h-10">
              {[3, 5, 4, 7, 5, 8, 4, 6, 3].map((h, i) => (
                <div key={i}
                  className="w-[3px] rounded-full"
                  style={{
                    height: h,
                    background: theme.primary,
                    animation: `bar 0.6s ease-in-out infinite`,
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs font-medium" style={{ color: theme.textSecondary }}>Loading Lyrics</div>
          <div className="text-[10px]" style={{ color: theme.textSecondary + '70' }}>
            {currentTrack?.title}
          </div>
        </div>
      </div>
    )
  }

  // No track
  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 14 }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: theme.surfaceAlt }}>
          <Music size={22} style={{ color: theme.textSecondary }} />
        </div>
        <div className="text-xs font-medium" style={{ color: theme.textSecondary }}>
          No track playing
        </div>
      </div>
    )
  }

  // No lyrics found
  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ gap: 14 }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: theme.surfaceAlt }}>
        <Music size={22} style={{ color: theme.textSecondary }} />
      </div>
      <div className="text-xs font-medium" style={{ color: theme.textSecondary }}>
        No lyrics found
      </div>
      <div className="text-[10px] text-center max-w-[240px]" style={{ color: theme.textSecondary + '80' }}>
        <span className="truncate block">{currentTrack.title} — {currentTrack.artist}</span>
      </div>
    </div>
  )
}
