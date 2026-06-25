import { useState, useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'

export interface LyricLine {
  time: number
  text: string
}

export interface LyricsData {
  plainLyrics: string
  syncedLyrics: LyricLine[]
  source: 'lrclib' | 'none'
}

// Cache in memory biar gak fetch ulang
const lyricsCache = new Map<string, LyricsData>()

export function useLyrics() {
  const { currentTrack, progress } = usePlayerStore()
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeLine, setActiveLine] = useState(-1)
  const currentTrackRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    if (!currentTrack) {
      setLyrics(null)
      setActiveLine(-1)
      currentTrackRef.current = null
      return
    }

    const trackId = currentTrack.id
    if (trackId === currentTrackRef.current) return
    currentTrackRef.current = trackId

    // Cek cache dulu
    const cached = lyricsCache.get(trackId)
    if (cached) {
      setLyrics(cached)
      setIsLoading(false)
      setActiveLine(-1)
      return
    }

    setIsLoading(true)
    setLyrics(null)
    setActiveLine(-1)

    const doFetch = async () => {
      if (fetchingRef.current) return
      fetchingRef.current = true

      try {
        const artist = encodeURIComponent(currentTrack.artist)
        const title = encodeURIComponent(currentTrack.title)

        // Coba fetch via main process (biar gak kena CSP blokade di file://)
        const fetchLyrics = async (url: string) => {
          if (window.electronAPI?.fetchLyrics) {
            return await window.electronAPI.fetchLyrics(url)
          }
          // Fallback: fetch langsung (buat development)
          const res = await fetch(url)
          if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status }
          const data = await res.json()
          return { data, status: res.status }
        }

        let result = await fetchLyrics(
          `https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}`
        )

        // Fallback: search
        if (result.error || result.status !== 200) {
          const q = encodeURIComponent(`${currentTrack.title} ${currentTrack.artist}`)
          result = await fetchLyrics(`https://lrclib.net/api/search?q=${q}`)
          if (result.error || result.status !== 200) throw new Error('Not found')

          const results = result.data
          const match = Array.isArray(results) ? results[0] : null
          if (!match || (!match.syncedLyrics && !match.plainLyrics)) throw new Error('No lyrics')

          const data: LyricsData = {
            plainLyrics: match.plainLyrics || '',
            syncedLyrics: parseSync(match.syncedLyrics || ''),
            source: 'lrclib',
          }
          lyricsCache.set(trackId, data)
          setLyrics(data)
          setIsLoading(false)
          fetchingRef.current = false
          return
        }

        const json = result.data
        const data: LyricsData = {
          plainLyrics: json.plainLyrics || '',
          syncedLyrics: parseSync(json.syncedLyrics || ''),
          source: 'lrclib',
        }
        lyricsCache.set(trackId, data)
        setLyrics(data)
      } catch {
        setLyrics({ plainLyrics: '', syncedLyrics: [], source: 'none' })
      }
      setIsLoading(false)
      fetchingRef.current = false
    }

    doFetch()
  }, [currentTrack])

  // Sync dengan progress untuk lirik
  useEffect(() => {
    if (!lyrics?.syncedLyrics?.length) {
      setActiveLine(-1)
      return
    }

    const lines = lyrics.syncedLyrics
    let idx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (progress >= lines[i].time) {
        idx = i
        break
      }
    }
    setActiveLine(idx)
  }, [progress, lyrics])

  // Reset activeLine ketika lagu berganti
  useEffect(() => {
    setActiveLine(-1)
  }, [currentTrack?.id])

  return { lyrics, isLoading, activeLine }
}

function parseSync(raw: string): LyricLine[] {
  if (!raw) return []
  const lines: LyricLine[] = []
  const regex = /\[(\d{1,3}):(\d{2})\.(\d{2,3})\](.*)/g
  let match
  while ((match = regex.exec(raw)) !== null) {
    const mins = parseInt(match[1])
    const secs = parseInt(match[2])
    const ms = parseInt(match[3].padEnd(3, '0'))
    const text = match[4]?.trim()
    if (text) {
      lines.push({ time: mins * 60 + secs + ms / 1000, text })
    }
  }
  lines.sort((a, b) => a.time - b.time)
  return lines
}
