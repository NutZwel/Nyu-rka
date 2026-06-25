import { create } from 'zustand'
import { Theme } from '../types'

const defaultTheme: Theme = {
  name: 'Pandora',
  primary: '#6AA8C0',
  secondary: '#4A9880',
  accent: '#B49878',
  background: '#1A2226',
  surface: '#242E32',
  surfaceAlt: '#2E3A40',
  text: '#D8E4E8',
  textSecondary: '#889AA0',
  border: '#3A4A50',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 16,
  compact: true,
  blur: false,
  blurAmount: 20,
  spacing: 4,
  animations: true,
}

interface ThemeState {
  theme: Theme
  mascot: string
  customMascotPath: string | null
  useCustomMascot: boolean
  availableThemes: { name: string; icon: string; mascot: string; theme: Partial<Theme> }[]
  isThemeEditorOpen: boolean
  loadTheme: () => Promise<void>
  setTheme: (theme: Theme) => void
  updateTheme: (partial: Partial<Theme>) => void
  resetTheme: () => void
  toggleThemeEditor: () => void
  applyPreset: (name: string) => void
  setCustomMascotPath: (path: string | null) => void
  setUseCustomMascot: (val: boolean) => void
}

const presets: { name: string; icon: string; mascot: string; theme: Partial<Theme> }[] = [
  {
    name: 'Pandora', icon: '🌊', mascot: 'whale',
    theme: {
      primary: '#6AA8C0', secondary: '#4A9880', accent: '#B49878',
      background: '#1A2226', surface: '#242E32', surfaceAlt: '#2E3A40',
      text: '#D8E4E8', textSecondary: '#889AA0', border: '#3A4A50',
    }
  },
  {
    name: 'Hutan', icon: '🌿', mascot: 'fox',
    theme: {
      primary: '#C49850', secondary: '#7A9A60', accent: '#B06840',
      background: '#1E1E18', surface: '#282820', surfaceAlt: '#323228',
      text: '#E0DCD0', textSecondary: '#8A8070', border: '#3A3830',
    }
  },
  {
    name: 'Senja', icon: '🌅', mascot: 'owl',
    theme: {
      primary: '#A07858', secondary: '#9880B0', accent: '#C49060',
      background: '#1E1A1A', surface: '#2A2424', surfaceAlt: '#342E2E',
      text: '#E0D8D4', textSecondary: '#8A7A78', border: '#3C3636',
    }
  },
  {
    name: 'Magma', icon: '🌋', mascot: 'dragon',
    theme: {
      primary: '#C07050', secondary: '#A05030', accent: '#D09030',
      background: '#1E1410', surface: '#2A1E18', surfaceAlt: '#362822',
      text: '#E0D0C8', textSecondary: '#8A7060', border: '#3C2E28',
    }
  },
  {
    name: 'Malam', icon: '🌙', mascot: 'cat',
    theme: {
      primary: '#7880A0', secondary: '#606898', accent: '#B8A070',
      background: '#14141E', surface: '#1E1E2A', surfaceAlt: '#282836',
      text: '#D0D0E0', textSecondary: '#787890', border: '#343448',
    }
  },
  {
    name: 'Sungai', icon: '🌴', mascot: 'frog',
    theme: {
      primary: '#6AA070', secondary: '#7A9A80', accent: '#90A860',
      background: '#161E18', surface: '#1E2820', surfaceAlt: '#283228',
      text: '#D0E0D0', textSecondary: '#788A78', border: '#303E34',
    }
  },
]

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: defaultTheme,
  mascot: 'whale',
  customMascotPath: null,
  useCustomMascot: false,
  availableThemes: presets,
  isThemeEditorOpen: false,

  loadTheme: async () => {
    try {
      const saved = await window.electronAPI?.getTheme()
      if (saved) {
        const preset = presets.find(p => p.name === saved.name)
        set({ theme: { ...defaultTheme, ...saved }, mascot: preset?.mascot || 'whale' })
      }
      // Load custom mascot path
      const customPath = await window.electronAPI?.storeGet?.('customMascotPath')
      const useCustom = await window.electronAPI?.storeGet?.('useCustomMascot')
      if (customPath) set({ customMascotPath: customPath, useCustomMascot: !!useCustom })
    } catch (e) { console.warn('Could not load theme', e) }
  },

  setTheme: (theme: Theme) => {
    set({ theme })
    window.electronAPI?.setTheme(theme)
  },

  updateTheme: (partial: Partial<Theme>) => {
    const updated = { ...get().theme, ...partial }
    set({ theme: updated })
    window.electronAPI?.setTheme(updated)
  },

  resetTheme: () => {
    set({ theme: defaultTheme, mascot: 'whale', useCustomMascot: false, customMascotPath: null })
    window.electronAPI?.setTheme(defaultTheme)
    window.electronAPI?.storeSet?.('customMascotPath', null)
    window.electronAPI?.storeSet?.('useCustomMascot', false)
  },

  toggleThemeEditor: () => set(state => ({ isThemeEditorOpen: !state.isThemeEditorOpen })),

  applyPreset: (name: string) => {
    const preset = presets.find(p => p.name === name)
    if (preset) {
      const updated = { ...get().theme, ...preset.theme, name }
      set({ theme: updated, mascot: preset.mascot })
      window.electronAPI?.setTheme(updated)
    }
  },

  setCustomMascotPath: (path: string | null) => {
    set({ customMascotPath: path, useCustomMascot: !!path })
    window.electronAPI?.storeSet?.('customMascotPath', path)
    window.electronAPI?.storeSet?.('useCustomMascot', !!path)
  },

  setUseCustomMascot: (val: boolean) => {
    set({ useCustomMascot: val })
    window.electronAPI?.storeSet?.('useCustomMascot', val)
  },
}))
