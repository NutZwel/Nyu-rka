import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search, Play, Plus, Clock, Music, Disc3, X,
  ListMusic, Check, Loader
} from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { usePlayerStore } from '../store/playerStore'
import { Track } from '../types'

export default function SearchView() {
  const { theme } = useThemeStore()
  const { addToQueue, setSearchResults, searchResults, setIsSearching, isSearching, importPlaylist } = usePlayerStore()
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showPlaylistInput, setShowPlaylistInput] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { inputRef.current?.focus(); loadRecent() }, [])

  const loadRecent = async () => {
    const r = await window.electronAPI?.storeGet('recentSearches')
    if (r) setRecentSearches(r)
  }

  const saveRecent = async (q: string) => {
    const u = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10)
    setRecentSearches(u)
    await window.electronAPI?.storeSet('recentSearches', u)
  }

  const isYouTubeUrl = (q: string) =>
    q.includes('youtube.com/watch') || q.includes('youtu.be/') || q.includes('youtube.com/shorts/')

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setIsSearching(true)
    saveRecent(q)
    try {
      const tracks: Track[] = []

      // If it's a YouTube URL, extract the video directly
      if (isYouTubeUrl(q)) {
        const yt = await window.electronAPI?.youtubeSearch(q)
        if (Array.isArray(yt) && yt.length > 0) {
          yt.forEach((r: any) => tracks.push({
            id: `yt-${r.id}`, title: r.title, artist: r.channel || 'Unknown',
            album: 'YouTube', albumArt: r.thumbnail || '',
            duration: r.duration || 0, uri: r.url, youtubeId: r.id, youtubeUrl: r.url,
          }))
        }
        setSearchResults(tracks)
        setIsSearching(false)
        return
      }

      const yt = await window.electronAPI?.youtubeSearch(q)
      const sp = await window.electronAPI?.spotifySearch(q)
      if (Array.isArray(yt)) {
        yt.forEach((r: any) => tracks.push({
          id: `yt-${r.id}`, title: r.title, artist: r.channel || 'Unknown',
          album: 'YouTube', albumArt: r.thumbnail || '',
          duration: r.duration || 0, uri: r.url, youtubeId: r.id, youtubeUrl: r.url,
        }))
      }
      if (sp?.tracks?.items) {
        sp.tracks.items.forEach((item: any) => {
          if (!tracks.some(t => t.title.toLowerCase() === item.name.toLowerCase())) {
            tracks.push({
              id: `sp-${item.id}`, title: item.name,
              artist: item.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
              album: item.album?.name || '',
              albumArt: item.album?.images?.[0]?.url || '',
              duration: Math.round(item.duration_ms / 1000), uri: item.uri,
            })
          }
        })
      }
      setSearchResults(tracks)
    } catch (err) { console.error('Search error:', err) }
    finally { setIsSearching(false) }
  }, [setSearchResults, setIsSearching, saveRecent])

  const handleSearch = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length > 2) debounceRef.current = setTimeout(() => doSearch(value), 500)
    else setSearchResults([])
  }

  const handlePlay = (track: Track) => {
    addToQueue(track)
  }

  const handleImportPlaylist = async () => {
    if (!playlistUrl.trim()) return
    setImporting(true)
    setImportResult(null)
    const result = await importPlaylist(playlistUrl.trim())
    setImportResult(result)
    setImporting(false)
    if (result.success) {
      setPlaylistUrl('')
      setShowPlaylistInput(false)
    }
  }

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full animate-fadeIn" style={{ gap: 10 }}>
      {/* Search bar + Playlist button */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all"
          style={{
            background: theme.surface,
            border: `1px solid ${query ? theme.primary + '50' : theme.border}`,
            boxShadow: query ? `0 0 0 3px ${theme.primary}20` : 'none',
          }}
        >
          <Search size={16} style={{ color: theme.textSecondary }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search songs, artists..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: theme.text }}
          />
          {query && (
            <button className="btn-icon !w-7 !h-7" onClick={() => { setQuery(''); setSearchResults([]) }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className="shrink-0 flex items-center justify-center rounded-2xl transition-all"
          style={{
            width: 44,
            height: 44,
            background: showPlaylistInput ? theme.primary : theme.surface,
            border: `1px solid ${theme.border}`,
            color: showPlaylistInput ? '#fff' : theme.textSecondary,
          }}
          onClick={() => setShowPlaylistInput(!showPlaylistInput)}
          title="Import Playlist"
        >
          <ListMusic size={18} />
        </button>
      </div>

      {/* Playlist input */}
      {showPlaylistInput && (
        <div className="p-3 rounded-2xl animate-fadeIn" style={{ background: theme.surface, border: `1px solid ${theme.border}30` }}>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: theme.textSecondary }}>
            YouTube / Spotify playlist link
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://youtube.com/playlist?list=..."
              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
              style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }}
              onKeyDown={(e) => e.key === 'Enter' && handleImportPlaylist()}
            />
            <button
              className="px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
              style={{ background: theme.primary, color: '#fff' }}
              onClick={handleImportPlaylist}
              disabled={importing}
            >
              {importing ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
              Add
            </button>
          </div>
          {importResult && (
            <div className="text-xs mt-1.5 flex items-center gap-1" style={{ color: importResult.success ? theme.success : theme.error }}>
              {importResult.success ? <Check size={11} /> : <X size={11} />}
              {importResult.message}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {isSearching ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Disc3 size={28} style={{ color: theme.primary }} className="animate-spin-slow" />
            <div className="text-sm" style={{ color: theme.textSecondary }}>Searching...</div>
          </div>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-1">
          {searchResults.map((track) => (
            <div key={track.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-all group animate-fadeIn"
              style={{ background: theme.surface, border: `1px solid ${theme.border}20` }}>
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: theme.surfaceAlt }}>
                {track.albumArt ? <img src={track.albumArt} alt="" className="w-full h-full object-cover" /> : <Music size={16} style={{ color: theme.textSecondary }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: theme.text }}>{track.title}</div>
                <div className="flex items-center gap-1 text-xs" style={{ color: theme.textSecondary }}>
                  <span className="truncate">{track.artist}</span>
                  <span>·</span>
                  <span>{fmt(track.duration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="btn-icon !w-8 !h-8" onClick={() => addToQueue(track)} title="Add to queue">
                  <Plus size={14} />
                </button>
                <button className="!w-8 !h-8 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: theme.primary, color: '#fff' }}
                  onClick={() => handlePlay(track)} title="Play">
                  <Play size={14} fill="#fff" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : query.length > 0 && query.length < 3 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm" style={{ color: theme.textSecondary }}>Type at least 3 characters</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn" style={{ gap: 16 }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: theme.surfaceAlt }}>
            <Search size={24} style={{ color: theme.textSecondary }} />
          </div>
          <div className="text-center">
            <div className="text-sm" style={{ color: theme.textSecondary }}>Search for songs or paste a playlist link</div>
            <div className="text-xs mt-1" style={{ color: theme.textSecondary + '80' }}>Click the <ListMusic size={10} className="inline" /> button to import</div>
          </div>
          {recentSearches.length > 0 && (
            <div className="w-full">
              <div className="text-xs font-semibold mb-2" style={{ color: theme.textSecondary }}>Recent</div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.slice(0, 5).map(s => (
                  <button key={s} className="px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5"
                    style={{ background: theme.surfaceAlt, color: theme.textSecondary }}
                    onClick={() => { setQuery(s); doSearch(s) }}>
                    <Clock size={10} />{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
