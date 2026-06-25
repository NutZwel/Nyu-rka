import { useState } from 'react'
import { Palette, RefreshCw, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { Theme } from '../types'
import PixelMascot from './PixelMascot'

type ColorKey = keyof Pick<Theme, 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'surfaceAlt' | 'text' | 'textSecondary' | 'border' | 'error' | 'success' | 'warning'>

const colorLabels: Record<ColorKey, string> = {
  primary: 'Primary', secondary: 'Secondary', accent: 'Accent',
  background: 'Background', surface: 'Surface', surfaceAlt: 'Surface Alt',
  text: 'Text', textSecondary: 'Text Secondary', border: 'Border',
  error: 'Error', success: 'Success', warning: 'Warning',
}

const colorGroups: { label: string; keys: ColorKey[] }[] = [
  { label: 'Brand Colors', keys: ['primary', 'secondary', 'accent'] },
  { label: 'Backgrounds', keys: ['background', 'surface', 'surfaceAlt'] },
  { label: 'Text', keys: ['text', 'textSecondary'] },
  { label: 'Utility', keys: ['border', 'error', 'success', 'warning'] },
]

const fontOptions = [
  'Inter, system-ui, sans-serif', 'SF Pro Display, system-ui, sans-serif',
  'JetBrains Mono, monospace', 'Poppins, sans-serif',
  'Space Grotesk, sans-serif', 'Outfit, sans-serif', 'system-ui, sans-serif',
]

export default function ThemeEditor() {
  const { theme, availableThemes, updateTheme, resetTheme, applyPreset } = useThemeStore()
  const [expandedGroup, setExpandedGroup] = useState('Brand Colors')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="w-7 h-7 rounded-xl border-2 cursor-pointer" style={{ background: value, borderColor: theme.border }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium" style={{ color: theme.textSecondary }}>{label}</div>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xs outline-none font-mono" style={{ color: theme.text }} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full animate-fadeIn space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Palette size={16} style={{ color: theme.primary }} /><span className="text-sm font-semibold" style={{ color: theme.text }}>Themes</span></div>
        <button className="px-2.5 py-1.5 rounded-xl text-[10px] font-medium flex items-center gap-1 transition-all" style={{ background: `${theme.error}15`, color: theme.error }} onClick={resetTheme}><RefreshCw size={10} />Reset</button>
      </div>

      {/* Presets */}
      <div>
        <div className="text-[10px] font-semibold tracking-wider mb-2.5" style={{ color: theme.textSecondary }}>PRESETS</div>
        <div className="grid grid-cols-2 gap-2">
          {availableThemes.map(p => (
            <button key={p.name} className="p-3 rounded-xl text-[10px] font-medium transition-all relative flex items-center gap-2"
              style={{ background: theme.name === p.name ? `${theme.primary}20` : theme.surface, border: `1px solid ${theme.name === p.name ? theme.primary : theme.border}30`, color: theme.name === p.name ? theme.primary : theme.textSecondary }}
              onClick={() => applyPreset(p.name)}>
              {theme.name === p.name && <Check size={10} className="absolute top-1 right-1" style={{ color: theme.primary }} />}
              <PixelMascot type={p.mascot} size={28} />
              <div className="text-left">
                <div className="text-xs font-semibold">{p.icon} {p.name}</div>
                <div className="text-[8px] opacity-60">{p.mascot}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {colorGroups.map(group => (
          <div key={group.label}>
            <button className="flex items-center justify-between w-full py-1.5" onClick={() => setExpandedGroup(expandedGroup === group.label ? '' : group.label)}>
              <span className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>{group.label.toUpperCase()}</span>
              {expandedGroup === group.label ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedGroup === group.label && <div className="space-y-2.5 mt-1.5">{group.keys.map(key => <ColorPicker key={key} label={colorLabels[key]} value={theme[key]} onChange={(v) => updateTheme({ [key]: v })} />)}</div>}
          </div>
        ))}

        <div className="my-2" style={{ borderTop: `1px solid ${theme.border}30` }} />

        <button className="flex items-center justify-between w-full py-1.5" onClick={() => setShowAdvanced(!showAdvanced)}>
          <span className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>ADVANCED</span>
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdvanced && <div className="space-y-3 animate-fadeIn">
          <div>
            <div className="flex items-center justify-between mb-1"><span className="text-[10px]" style={{ color: theme.textSecondary }}>Border Radius</span><span className="text-[10px] font-mono" style={{ color: theme.text }}>{theme.borderRadius}px</span></div>
            <input type="range" min={0} max={24} value={theme.borderRadius} onChange={(e) => updateTheme({ borderRadius: parseInt(e.target.value) })} className="w-full" style={{ background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${(theme.borderRadius / 24) * 100}%, ${theme.surfaceAlt} ${(theme.borderRadius / 24) * 100}%, ${theme.surfaceAlt} 100%)` }} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><span className="text-[10px]" style={{ color: theme.textSecondary }}>Spacing</span><span className="text-[10px] font-mono" style={{ color: theme.text }}>{theme.spacing}px</span></div>
            <input type="range" min={0} max={12} value={theme.spacing} onChange={(e) => updateTheme({ spacing: parseInt(e.target.value) })} className="w-full" style={{ background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${(theme.spacing / 12) * 100}%, ${theme.surfaceAlt} ${(theme.spacing / 12) * 100}%, ${theme.surfaceAlt} 100%)` }} />
          </div>
          <div>
            <span className="text-[10px]" style={{ color: theme.textSecondary }}>Font</span>
            <select value={theme.fontFamily} onChange={(e) => updateTheme({ fontFamily: e.target.value })} className="w-full px-2.5 py-1.5 rounded-xl text-xs outline-none mt-1" style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }}>
              {fontOptions.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
            </select>
          </div>
          {[ {key: 'compact', icon: '▫', label: 'Compact Mode'}, {key: 'blur', icon: '💫', label: 'Blur Effect'}, {key: 'animations', icon: '✨', label: 'Animations'} ].map(({key, icon, label}) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>{icon} {label}</span>
              <input type="checkbox" checked={!!(theme as any)[key]} onChange={(e) => updateTheme({ [key]: e.target.checked } as any)} className="toggle" />
            </label>
          ))}
          {theme.blur && <div className="pl-4">
            <div className="flex items-center justify-between mb-1"><span className="text-[10px]" style={{ color: theme.textSecondary }}>Blur Amount</span><span className="text-[10px] font-mono" style={{ color: theme.text }}>{theme.blurAmount}px</span></div>
            <input type="range" min={4} max={40} value={theme.blurAmount} onChange={(e) => updateTheme({ blurAmount: parseInt(e.target.value) })} className="w-full" style={{ background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${(theme.blurAmount / 40) * 100}%, ${theme.surfaceAlt} ${(theme.blurAmount / 40) * 100}%, ${theme.surfaceAlt} 100%)` }} />
          </div>}

          {/* Preview */}
          <div className="p-4 rounded-2xl mt-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="text-[10px] font-medium mb-2" style={{ color: theme.textSecondary }}>PREVIEW</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.primary, color: '#fff' }}>Primary</div>
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.secondary, color: '#fff' }}>Secondary</div>
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.accent, color: '#000' }}>Accent</div>
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.surfaceAlt, color: theme.text }}>Surface</div>
            </div>
            <div className="text-xs" style={{ color: theme.text }}>The quick brown fox jumps over the lazy dog.</div>
            <div className="text-[10px]" style={{ color: theme.textSecondary }}>Secondary text example</div>
          </div>
        </div>}
      </div>
    </div>
  )
}
