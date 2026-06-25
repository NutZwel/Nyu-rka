import { useEffect, useState } from 'react'
import { useThemeStore } from '../store/themeStore'

const LOGO_STEPS = [
  // Frame 1: circle
  `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" stroke-width="3" opacity="0.3"/>
  </svg>`,
  // Frame 2: circle + first line
  `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" stroke-width="3" opacity="0.3"/>
    <line x1="18" y1="55" x2="40" y2="30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  // Frame 3: circle + 2 lines
  `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" stroke-width="3" opacity="0.3"/>
    <line x1="18" y1="55" x2="40" y2="30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="42" y1="32" x2="58" y2="52" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  // Frame 4: music note complete
  `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="22" cy="54" rx="10" ry="8" fill="currentColor" opacity="0.9"/>
    <ellipse cx="52" cy="46" rx="10" ry="8" fill="currentColor" opacity="0.9"/>
    <rect x="28" y="12" width="5" height="44" rx="2.5" fill="currentColor"/>
    <rect x="56" y="4" width="5" height="44" rx="2.5" fill="currentColor"/>
    <path d="M33,14 Q54,4 56,6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
]

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const theme = useThemeStore(s => s.theme)
  const [step, setStep] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const [dots, setDots] = useState('')

  // Animate logo drawing
  useEffect(() => {
    if (step < LOGO_STEPS.length - 1) {
      const t = setTimeout(() => setStep(s => s + 1), 250)
      return () => clearTimeout(t)
    } else {
      // Logo complete, wait then fade
      const t = setTimeout(() => setFadeOut(true), 600)
      return () => clearTimeout(t)
    }
  }, [step])

  // Dots loading animation
  useEffect(() => {
    const i = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)
    return () => clearInterval(i)
  }, [])

  // Exit after fade
  useEffect(() => {
    if (fadeOut) {
      const t = setTimeout(onFinish, 500)
      return () => clearTimeout(t)
    }
  }, [fadeOut, onFinish])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.background,
        color: theme.text,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Logo animation */}
      <div
        style={{
          width: 100,
          height: 100,
          animation: 'splashPulse 2s ease-in-out infinite',
        }}
        dangerouslySetInnerHTML={{ __html: LOGO_STEPS[step] }}
      />

      {/* Brand name */}
      <div
        style={{
          marginTop: 24,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 2,
          opacity: step < 2 ? 0 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        NYU<span style={{ color: theme.primary }}>'</span>RKA
      </div>

      {/* Loading text */}
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: theme.textSecondary,
          letterSpacing: 1,
          opacity: step < 3 ? 0 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        loading{dots}
      </div>

      {/* Animated bars */}
      <div style={{ marginTop: 32, display: 'flex', gap: 3, alignItems: 'center', height: 20, opacity: step < 3 ? 0 : 1, transition: 'opacity 0.4s ease' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              background: `linear-gradient(to top, ${theme.primary}, ${theme.secondary})`,
              animation: 'splashBar 0.6s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
