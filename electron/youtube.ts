import { ipcMain } from 'electron'
import { search } from 'play-dl'
import { spawn } from 'child_process'
import { createServer } from 'http'

let activeStream: any = null
let activeServer: any = null

export function registerYoutubeIPCs() {
  ipcMain.handle('youtube-search', async (_event, query: string) => {
    try {
      if (query.includes('youtube.com/watch') || query.includes('youtu.be/') || query.includes('youtube.com/shorts/')) {
        try {
          const { execSync } = require('child_process')
          const meta = execSync(
            `yt-dlp --print "%(id)s|%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s" --no-warnings "${query}"`,
            { encoding: 'utf8', timeout: 15000 }
          )
          const parts = meta.trim().split('|')
          if (parts.length >= 2) {
            return [{
              id: parts[0], title: parts[1],
              url: `https://www.youtube.com/watch?v=${parts[0]}`,
              duration: parseInt(parts[3]) || 0,
              thumbnail: parts[4] || `https://i.ytimg.com/vi/${parts[0]}/hqdefault.jpg`,
              channel: parts[2] || 'Unknown', views: 0,
            }]
          }
        } catch {}
      }
      const results = await search(query, { limit: 15, source: { youtube: 'video' } })
      return results.map(r => ({
        id: r.id, title: r.title, url: r.url,
        duration: r.durationInSec, thumbnail: r.thumbnails?.[0]?.url || '',
        channel: r.channel?.name || '', views: r.views,
      }))
    } catch { return { error: 'Search failed' } }
  })

  ipcMain.handle('youtube-get-stream', async (_event, videoUrl: string) => {
    try {
      killStream()

      // Get metadata
      const { execSync } = require('child_process')
      let title = 'Unknown', duration = 0, videoId = 'unknown'
      try {
        const meta = execSync(
          `yt-dlp --print "%(id)s|%(title)s|%(duration)s" --no-warnings "${videoUrl}"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        const parts = meta.trim().split('|')
        videoId = parts[0] || 'unknown'
        title = parts[1] || 'Unknown'
        duration = parseInt(parts[2]) || 0
      } catch {}

      // Start local streaming server — pipes yt-dlp directly to response
      const port = await startStreamServer(videoUrl)

      return {
        streamUrl: `http://127.0.0.1:${port}/`,
        duration,
        title,
        videoId,
      }
    } catch (err) {
      console.error('Stream error:', err)
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('youtube-stop-stream', () => { killStream(); return true })
}

function killStream() {
  if (activeStream) { activeStream.kill('SIGKILL'); activeStream = null }
  if (activeServer) { activeServer.close(); activeServer = null }
}

function startStreamServer(videoUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    killStream()

    const server = createServer((_req, res) => {
      // Spawn yt-dlp and pipe directly
      const proc = spawn('yt-dlp', [
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '-o', '-',
        '--no-warnings',
        videoUrl,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })

      activeStream = proc

      res.writeHead(200, {
        'Content-Type': 'audio/mp4',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      })

      let hasData = false
      proc.stdout.on('data', (chunk: Buffer) => {
        if (!hasData) {
          hasData = true
          console.log('Stream started, sending data')
        }
        res.write(chunk)
      })

      proc.stdout.on('end', () => {
        console.log('Stream ended')
        res.end()
      })

      proc.on('error', () => res.end())
      proc.stderr.on('data', (d: Buffer) => console.log('yt-dlp:', d.toString().trim()))

      _req.on('close', () => proc.kill('SIGKILL'))
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        activeServer = server
        console.log('Stream server on', addr.port)
        resolve(addr.port)
      } else reject(new Error('Failed to start server'))
    })
    server.on('error', reject)
  })
}
