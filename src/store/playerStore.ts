import { create } from 'zustand'
import { Track, QueueItem } from '../types'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  volume: number
  progress: number
  duration: number
  queue: QueueItem[]
  queueIndex: number
  loopMode: 'none' | 'one' | 'all'
  shuffle: boolean
  searchResults: Track[]
  isSearching: boolean
  isRecommendLoading: boolean

  setTrack: (track: Track) => void
  togglePlay: () => void
  setPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  nextTrack: () => Promise<Track | null>
  prevTrack: () => Track | null
  setLoopMode: (mode: 'none' | 'one' | 'all') => void
  toggleShuffle: () => void
  setSearchResults: (results: Track[]) => void
  setIsSearching: (val: boolean) => void
  playTrackNext: (track: Track) => void
  loadRecommendations: () => Promise<void>
  importPlaylist: (url: string) => Promise<{ success: boolean; count: number; message: string }>
  savePlayback: () => Promise<void>
  loadPlayback: () => Promise<boolean>
}

// Preload a track in background
async function preloadTrack(track: Track) {
  if (!track.youtubeUrl && !track.youtubeId) return
  const url = track.youtubeUrl || `https://youtube.com/watch?v=${track.youtubeId}`
  try { await window.electronAPI?.youtubePreload?.(url) } catch {}
}

// Extract YouTube playlist ID or video IDs from URL
function parsePlaylistUrl(url: string): { list?: string; videoId?: string } {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube') || u.hostname.includes('youtu.be')) {
      const list = u.searchParams.get('list') || undefined
      const videoId = u.searchParams.get('v') || undefined
      if (!videoId && u.pathname.length > 1 && u.hostname.includes('youtu.be')) {
        return { list, videoId: u.pathname.slice(1).split('?')[0] }
      }
      return { list, videoId }
    }
    if (u.hostname.includes('spotify')) {
      const parts = u.pathname.split('/')
      const idx = parts.indexOf('playlist')
      if (idx !== -1) return { list: `spotify:${parts[idx + 1]}` }
    }
    return {}
  } catch { return {} }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.7,
  progress: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  loopMode: 'none',
  shuffle: false,
  searchResults: [],
  isSearching: false,
  isRecommendLoading: false,

  setTrack: (track: Track) => {
    set({ currentTrack: track, progress: 0, duration: track.duration || 0 })
    preloadTrack(track)
  },

  togglePlay: () => {
    set(state => ({ isPlaying: !state.isPlaying }))
  },

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setVolume: (volume: number) => set({ volume }),
  setProgress: (progress: number) => set({ progress }),
  setDuration: (duration: number) => set({ duration }),

  addToQueue: (track: Track) => {
    const item: QueueItem = { track, addedBy: 'user', requestedAt: Date.now() }
    set(state => {
      // Jika queue kosong, auto-play langsung
      if (state.queue.length === 0) {
        return { queue: [item], queueIndex: 0, currentTrack: track, progress: 0, duration: track.duration || 0 }
      }
      return { queue: [...state.queue, item] }
    })
    // Preload this track
    preloadTrack(track)
  },

  removeFromQueue: (index: number) => {
    set(state => {
      const newQueue = [...state.queue]
      newQueue.splice(index, 1)
      let qi = state.queueIndex
      if (index < qi) qi--
      else if (index === qi && qi >= newQueue.length) qi = newQueue.length - 1
      return { queue: newQueue, queueIndex: qi }
    })
  },

  clearQueue: () => set({ queue: [], queueIndex: -1, currentTrack: null, progress: 0, duration: 0, isPlaying: false }),

  nextTrack: async () => {
    const state = get()
    if (state.queue.length === 0) {
      // Queue empty — auto-recommend based on current track
      if (state.currentTrack) {
        await state.loadRecommendations()
        const newState = get()
        if (newState.queue.length > 0) {
          set({ queueIndex: 0, currentTrack: newState.queue[0].track, progress: 0 })
          return newState.queue[0].track
        }
      }
      return null
    }

    let nextIndex: number
    if (state.shuffle) {
      nextIndex = Math.floor(Math.random() * state.queue.length)
    } else {
      nextIndex = state.queueIndex + 1
      if (nextIndex >= state.queue.length) {
        if (state.loopMode === 'all') {
          nextIndex = 0
        } else {
          // Try auto-recommend at end
          await state.loadRecommendations()
          const newState = get()
          if (newState.queue.length > state.queue.length) {
            nextIndex = state.queueIndex + 1
          } else {
            return null
          }
        }
      }
    }

    set({ queueIndex: nextIndex })
    const next = get().queue[nextIndex]
    if (next) set({ currentTrack: next.track, progress: 0 })
    // Preload track after this one
    const queue = get().queue
    const nextIdx = get().queueIndex
    if (queue[nextIdx + 1]) preloadTrack(queue[nextIdx + 1].track)
    return next?.track || null
  },

  prevTrack: () => {
    const state = get()
    if (state.queue.length === 0 || state.queueIndex <= 0) return null
    const prevIndex = state.queueIndex - 1
    set({ queueIndex: prevIndex })
    const prev = state.queue[prevIndex]
    if (prev) set({ currentTrack: prev.track, progress: 0 })
    return prev?.track || null
  },

  setLoopMode: (mode: 'none' | 'one' | 'all') => set({ loopMode: mode }),
  toggleShuffle: () => set(state => ({ shuffle: !state.shuffle })),
  setSearchResults: (results: Track[]) => set({ searchResults: results }),
  setIsSearching: (val: boolean) => set({ isSearching: val }),

  playTrackNext: (track: Track) => {
    const state = get()
    const item: QueueItem = { track, addedBy: 'user', requestedAt: Date.now() }
    const insertAt = state.queueIndex + 1
    const newQueue = [...state.queue]
    newQueue.splice(insertAt, 0, item)
    set({ queue: newQueue })
  },

  loadRecommendations: async () => {
    const state = get()
    if (!state.currentTrack || state.isRecommendLoading) return
    set({ isRecommendLoading: true })

    try {
      // Use current track title + artist as search query
      const query = `${state.currentTrack.title} ${state.currentTrack.artist} music`
      const yt = await window.electronAPI?.youtubeSearch(query)
      if (Array.isArray(yt) && yt.length > 0) {
        const currentTitle = state.currentTrack.title.toLowerCase()
        const newTracks: Track[] = []
        const existingIds = new Set(state.queue.map(q => q.track.id))

        for (const r of yt) {
          const id = `yt-${r.id}`
          if (existingIds.has(id) || id === state.currentTrack?.id) continue
          if (r.title.toLowerCase() === currentTitle) continue
          newTracks.push({
            id, title: r.title, artist: r.channel || 'Unknown',
            album: 'Recommendation', albumArt: r.thumbnail || '',
            duration: r.duration || 0, uri: r.url, youtubeId: r.id, youtubeUrl: r.url,
          })
          if (newTracks.length >= 5) break
        }

        if (newTracks.length > 0) {
          const items: QueueItem[] = newTracks.map(t => ({ track: t, addedBy: 'auto', requestedAt: Date.now() }))
          set(s => ({ queue: [...s.queue, ...items] }))
        }
      }
    } catch (err) {
      console.error('Recommend error:', err)
    } finally {
      set({ isRecommendLoading: false })
    }
  },

  importPlaylist: async (url: string) => {
    try {
      const result = await window.electronAPI?.playlistExtract(url)
      if (!result || result.error) {
        return { success: false, count: 0, message: result?.error || 'Extract failed' }
      }
      if (!result.tracks || result.tracks.length === 0) {
        return { success: false, count: 0, message: 'No tracks found' }
      }

      const tracks: Track[] = result.tracks.map((r: any) => ({
        id: r.id || `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: r.title || 'Unknown',
        artist: r.artist || 'Unknown',
        album: r.album || 'Playlist',
        albumArt: r.albumArt || '',
        duration: r.duration || 0,
        uri: r.uri || r.url || '',
        youtubeId: r.youtubeId,
        youtubeUrl: r.youtubeUrl,
      }))

      const items: QueueItem[] = tracks.map(t => ({
        track: t, addedBy: 'playlist', requestedAt: Date.now()
      }))

      set(s => ({
        queue: [...s.queue, ...items],
        currentTrack: s.currentTrack || tracks[0],
        queueIndex: s.currentTrack ? s.queueIndex : 0,
      }))

      return { success: true, count: tracks.length, message: `${tracks.length} songs imported!` }
    } catch (err) {
      return { success: false, count: 0, message: (err as Error).message }
    }
  },

  savePlayback: async () => {
    const state = get()
    if (!state.currentTrack) return
    try {
      await window.electronAPI?.storeSet('playback-state', {
        currentTrack: state.currentTrack,
        queue: state.queue.slice(0, 50),
        queueIndex: state.queueIndex,
        volume: state.volume,
        progress: state.progress,
        loopMode: state.loopMode,
        shuffle: state.shuffle,
        savedAt: Date.now(),
      })
    } catch {}
  },

  loadPlayback: async () => {
    try {
      const saved = await window.electronAPI?.storeGet('playback-state')
      if (!saved?.currentTrack) return false

      set({
        currentTrack: saved.currentTrack,
        queue: saved.queue || [],
        queueIndex: saved.queueIndex ?? -1,
        volume: saved.volume ?? 0.7,
        progress: saved.progress ?? 0,
        loopMode: saved.loopMode || 'none',
        shuffle: saved.shuffle || false,
      })
      return true
    } catch { return false }
  },
}))
