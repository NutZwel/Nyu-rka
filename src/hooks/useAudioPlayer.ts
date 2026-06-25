import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animFrameRef = useRef<number>()
  const currentTrackIdRef = useRef<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const {
    currentTrack, isPlaying, volume, loopMode,
    setPlaying, setProgress, setDuration, nextTrack,
  } = usePlayerStore()

  // Init audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    }
  }, [])

  // Load and play track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (currentTrack.id === currentTrackIdRef.current) return
    currentTrackIdRef.current = currentTrack.id

    const run = async () => {
      try {
        // Stop previous
        window.electronAPI?.youtubeStopStream()
        if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }

        // Auto-search YouTube if no youtubeId/youtubeUrl
        let ytUrl = currentTrack.youtubeUrl
        let ytId = currentTrack.youtubeId
        if (!ytUrl && ytId) {
          ytUrl = `https://youtube.com/watch?v=${ytId}`
        }
        if (!ytUrl) {
          console.log('Auto-searching YouTube for:', currentTrack.title, currentTrack.artist)
          const query = `${currentTrack.title} ${currentTrack.artist} music`
          const results = await window.electronAPI?.youtubeSearch(query)
          if (Array.isArray(results) && results.length > 0) {
            ytUrl = results[0].url
            ytId = results[0].id
          }
        }
        if (!ytUrl) { setPlaying(false); return }

        const result = await window.electronAPI?.youtubeGetStream(ytUrl)
        if (!result || result.error) {
          console.error('Stream error:', result?.error || 'Unknown')
          setPlaying(false)
          return
        }

        if (!result.streamUrl) {
          console.error('No stream URL in response')
          setPlaying(false)
          return
        }

        if (result.duration) setDuration(result.duration)

        // Use streaming URL directly — HTML5 Audio handles chunked HTTP
        audio.src = result.streamUrl

        // Play as soon as data starts flowing
        audio.oncanplay = () => {
          if (usePlayerStore.getState().isPlaying) {
            audio.play().catch(e => console.warn('play:', e))
          }
        }

        audio.onloadedmetadata = () => {
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration)
          }
        }

        audio.onerror = () => {
          console.error('Audio error:', audio.error?.code, audio.error?.message)
          setPlaying(false)
        }

        audio.onended = async () => {
          const loop = usePlayerStore.getState().loopMode
          if (loop === 'one') { audio.currentTime = 0; audio.play() }
          else { await nextTrack() }
        }

        // Try playing (will start as soon as buffered data arrives)
        try {
          await audio.play()
          setPlaying(true)
        } catch (err) {
          console.warn('Autoplay blocked:', (err as Error).message)
          setPlaying(false)
        }

      } catch (err) {
        console.error('Playback error:', err)
        setPlaying(false)
      }
    }

    run()
  }, [currentTrack])

  // Play/Pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.play().catch(() => setPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Progress
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const update = () => {
      if (!audio.paused) setProgress(audio.currentTime)
      animFrameRef.current = requestAnimationFrame(update)
    }
    if (isPlaying) animFrameRef.current = requestAnimationFrame(update)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isPlaying, setProgress])

  const seek = useCallback((t: number) => {
    if (audioRef.current) { audioRef.current.currentTime = t; setProgress(t) }
  }, [setProgress])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current!.src = ''
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    setPlaying(false)
  }, [setPlaying])

  return { seek, stop }
}
