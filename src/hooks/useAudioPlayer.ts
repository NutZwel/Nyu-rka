import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const loadingRef = useRef(false)

  const {
    currentTrack, isPlaying, volume, loopMode,
    setPlaying, setProgress, setDuration, nextTrack,
  } = usePlayerStore()

  /** Stop audio segera — synchronous, paksa berhenti */
  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // Hapus semua listener dulu biar gak trigger error saat src di-clear
    cleanupRef.current?.()
    cleanupRef.current = null
    audio.pause()
    // Clear src biar audio beneran stop & lepas resource
    audio.src = ''
    audio.load()
    // Matiin juga server HTTP
    window.electronAPI?.youtubeStopStream()
  }, [])

  // Init audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      // Biar gak nahan resource ketika user ganti lagu
      audioRef.current.preload = 'none'
    }
    return () => {
      stopAudio()
      if (audioRef.current) {
        audioRef.current.src = ''
        audioRef.current.load()
      }
    }
  }, [stopAudio])

  // Load and play track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Jika currentTrack null → stop total
    if (!currentTrack) {
      stopAudio()
      currentTrackIdRef.current = null
      return
    }

    // Sama kaya sebelumnya, skip
    if (currentTrack.id === currentTrackIdRef.current) return
    currentTrackIdRef.current = currentTrack.id

    // ⚡ STOP DULU sebelum mulai yang baru
    // Ini kunci fix — paksa audio berhenti SEKARANG juga, syncronous
    stopAudio()

    let cancelled = false

    const run = async () => {
      loadingRef.current = true

      try {
        // Cari YouTube URL kalau belum ada
        let ytUrl = currentTrack.youtubeUrl
        let ytId = currentTrack.youtubeId
        if (!ytUrl && ytId) {
          ytUrl = `https://youtube.com/watch?v=${ytId}`
        }
        if (!ytUrl) {
          console.log('Searching YouTube:', currentTrack.title, currentTrack.artist)
          const q = `${currentTrack.title} ${currentTrack.artist} music`
          const results = await window.electronAPI?.youtubeSearch(q)
          if (Array.isArray(results) && results.length > 0) {
            ytUrl = results[0].url
            ytId = results[0].id
          }
        }
        if (!ytUrl || cancelled) { setPlaying(false); loadingRef.current = false; return }

        const result = await window.electronAPI?.youtubeGetStream(ytUrl)
        if (!result || result.error || !result.streamUrl || cancelled) {
          console.error('Stream error:', result?.error || 'No URL')
          setPlaying(false)
          loadingRef.current = false
          return
        }

        if (result.duration) setDuration(result.duration)
        audio.src = result.streamUrl

        const onCanPlay = () => {
          if (usePlayerStore.getState().isPlaying) {
            audio.play().catch(() => {})
          }
        }
        const onMeta = () => {
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration)
          }
        }
        const onTimeUpdate = () => {
          setProgress(audio.currentTime)
        }
        const onEnded = async () => {
          const loop = usePlayerStore.getState().loopMode
          if (loop === 'one') { audio.currentTime = 0; audio.play() }
          else { await nextTrack() }
        }
        const onError = () => {
          console.error('Audio error:', audio.error?.code)
          setPlaying(false)
          loadingRef.current = false
        }

        audio.addEventListener('canplay', onCanPlay)
        audio.addEventListener('loadedmetadata', onMeta)
        audio.addEventListener('timeupdate', onTimeUpdate)
        audio.addEventListener('ended', onEnded)
        audio.addEventListener('error', onError)

        cleanupRef.current = () => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('loadedmetadata', onMeta)
          audio.removeEventListener('timeupdate', onTimeUpdate)
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
        }

        try {
          await audio.play()
          setPlaying(true)
        } catch {
          setPlaying(false)
        }

        loadingRef.current = false
      } catch {
        setPlaying(false)
        loadingRef.current = false
      }
    }

    run()
    return () => { cancelled = true }
  }, [currentTrack, stopAudio])

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

  const seek = useCallback((t: number) => {
    if (audioRef.current) { audioRef.current.currentTime = t; setProgress(t) }
  }, [setProgress])

  useEffect(() => {
    (window as any).__seekAudio = seek
    return () => { delete (window as any).__seekAudio }
  }, [seek])

  const stop = useCallback(() => {
    stopAudio()
    setPlaying(false)
  }, [stopAudio, setPlaying])

  return { seek, stop }
}
