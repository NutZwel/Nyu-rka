import { app, ipcMain } from 'electron'
import { search } from 'play-dl'
import { spawn, execSync } from 'child_process'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { existsSync, mkdirSync, unlinkSync, createReadStream, statSync } from 'fs'
import { join } from 'path'

let activeStream: any = null
let activeServer: any = null

// ── yt-dlp management ─────────────────────────────────────────────────

let ytDlpPath = 'yt-dlp'
let ytDlpVersion = ''

function getBinDir(): string {
  const d = join(app.getPath('userData'), 'bin')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function bundledPath(): string | null {
  const p = join(getBinDir(), 'yt-dlp.exe')
  return existsSync(p) ? p : null
}

/** Verifikasi bahwa yt-dlp benar-benar bisa dipanggil */
function verifyYtDlp(cmd: string): boolean {
  try {
    const ver = execSync(`"${cmd}" --version`, { encoding: 'utf8', timeout: 8000 }).trim()
    if (ver) { ytDlpVersion = ver; return true }
  } catch {}
  return false
}

function findYtDlp(): string | null {
  // 1. Cek folder bundled sendiri dulu
  const b = bundledPath()
  if (b && verifyYtDlp(b)) return b

  // 2. Cek PATH
  try {
    execSync('where yt-dlp', { stdio: 'pipe', timeout: 5000 })
    if (verifyYtDlp('yt-dlp')) return 'yt-dlp'
  } catch {}

  // 3. Cek python -m yt_dlp (tapi verifikasi beneran)
  for (const py of ['python', 'python3']) {
    try {
      execSync(`${py} -m yt_dlp --version`, { stdio: 'pipe', timeout: 8000 })
      // ytDlpPath diset khusus untuk python -m
      return `python~${py}`  // pakai ~ separator biar gak bingung sama spasi
    } catch {}
  }

  // 4. Cek folder Scripts umum
  const candidates = [
    join(process.env.APPDATA || '', 'Python', 'Scripts', 'yt-dlp.exe'),
    ...['310','311','312','313','314'].flatMap(v => [
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', `Python${v}`, 'Scripts', 'yt-dlp.exe'),
      join('C:', `Python${v}`, 'Scripts', 'yt-dlp.exe'),
    ]),
  ]
  for (const p of candidates) {
    if (existsSync(p) && verifyYtDlp(p)) return p
  }

  return null
}

function installViaPip(): string | null {
  for (const pip of ['pip', 'pip3', 'python -m pip']) {
    try {
      execSync(`${pip} install yt-dlp`, { stdio: 'pipe', timeout: 60000 })
      const found = findYtDlp()
      if (found) return found
    } catch {}
  }
  return null
}

function downloadFromGitHub(): string | null {
  const dest = join(getBinDir(), 'yt-dlp.exe')
  if (existsSync(dest)) return dest

  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  console.log('[yt-dlp] Downloading from GitHub... (~15MB)')

  // Try curl.exe (Windows 10+ built-in)
  for (const tool of [
    `curl.exe -# -L -o "${dest}" "${url}"`,
    `powershell -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing"`,
  ]) {
    try {
      execSync(tool, { timeout: 180000, stdio: 'pipe' })
      if (existsSync(dest) && verifyYtDlp(dest)) return dest
    } catch {}
  }

  return null
}

function ensureYtDlp(): boolean {
  // Phase 1: cari existing
  let found = findYtDlp()
  if (found) {
    // Handle python~ prefix
    if (found.startsWith('python~')) {
      const py = found.split('~')[1]
      ytDlpPath = `${py} -m yt_dlp`
    } else {
      ytDlpPath = found
    }
    console.log('[yt-dlp] Siap:', ytDlpPath, 'v' + ytDlpVersion)
    return true
  }

  // Phase 2: pip install
  console.log('[yt-dlp] Mencoba pip install...')
  found = installViaPip()
  if (found) {
    ytDlpPath = found
    console.log('[yt-dlp] Terinstall via pip:', found)
    return true
  }

  // Phase 3: download dari GitHub (anti-gagal, tanpa Python)
  console.log('[yt-dlp] Mencoba download dari GitHub...')
  found = downloadFromGitHub()
  if (found) {
    ytDlpPath = found
    console.log('[yt-dlp] Download selesai:', found, 'v' + ytDlpVersion)
    return true
  }

  console.warn('[yt-dlp] Gagal!')
  return false
}

// ── Helper execute yt-dlp ─────────────────────────────────────────────

/** Untuk execSync: pastiin command benar di cmd.exe */
function ytCmdStr(args: string): string {
  // yt-dlp as a direct binary
  if (ytDlpPath === 'yt-dlp') return `yt-dlp ${args}`
  // python -m yt_dlp (jangan di-quote karena python commandnya sendiri)
  if (ytDlpPath.includes(' -m ')) return `${ytDlpPath} ${args}`
  // Full path ke exe (quote karena ada backslash/spasi)
  return `"${ytDlpPath}" ${args}`
}

/** Untuk spawn: pecah jadi command + args array */
function ytSpawnArgs(extra: string[]) {
  if (ytDlpPath === 'yt-dlp') return ['yt-dlp', ...extra]
  if (ytDlpPath.includes(' -m ')) {
    const [cmd, ...rest] = ytDlpPath.split(' ')
    return [cmd, ...rest, ...extra]
  }
  return [ytDlpPath, ...extra]
}

function ytdlExec(args: string, opts?: any): string {
  return execSync(ytCmdStr(args), { encoding: 'utf8', timeout: 30000, ...opts })
}

function ytdlExecBuffer(args: string): Buffer {
  return execSync(ytCmdStr(args), { encoding: 'buffer', timeout: 120000, maxBuffer: 100 * 1024 * 1024 })
}

function ytdlSpawn(extra: string[]) {
  const [cmd, ...args] = ytSpawnArgs(extra)
  return spawn(cmd, args)
}

/** Async spawn — collects stdout, returns string. Non-blocking equivalent of execSync */
function spawnOutput(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
      reject(new Error('Timeout'))
    }, timeoutMs)

    proc.stdout.on('data', (d: Buffer) => stdout.push(d))
    proc.stderr.on('data', (d: Buffer) => stderr.push(d))
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return
      if (code === 0 || stdout.length > 0) {
        resolve(Buffer.concat(stdout).toString('utf8'))
      } else {
        reject(new Error(`Exit ${code}: ${Buffer.concat(stderr).toString('utf8').slice(0, 200)}`))
      }
    })
    proc.on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

// ── Audio streaming (disk-based) ──────────────────────────────────────

/** Info lagu yang lagi di-download */
let downloading = new Set<string>()

/** Cache: pake Map biasa, auto-expire via timer, max 3 entries biar hemat RAM */
interface CacheEntry {
  filePath: string
  size: number
  contentType: string
  timer: ReturnType<typeof setTimeout>
}
const streamCache = new Map<string, CacheEntry>()
const MAX_CACHE = 3

function cacheSet(key: string, entry: CacheEntry) {
  // Evict oldest kalau udah penuh
  if (streamCache.size >= MAX_CACHE) {
    const first = streamCache.keys().next().value
    if (first) cacheDelete(first)
  }
  streamCache.set(key, entry)
}

function cacheDelete(key: string) {
  const old = streamCache.get(key)
  if (old) {
    clearTimeout(old.timer)
    try { unlinkSync(old.filePath) } catch {}
    streamCache.delete(key)
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────

export function registerYoutubeIPCs() {
  const ytAvailable = ensureYtDlp()

  ipcMain.handle('yt-dlp-status', () => ({ available: ytAvailable, path: ytDlpPath, version: ytDlpVersion }))

  ipcMain.handle('youtube-search', async (_event, query: string) => {
    try {
      if (!ytAvailable) return { error: 'yt-dlp not available' }
      // Kalau URL langsung, pake yt-dlp aja
      if (/youtube\.com\/(watch|shorts)/.test(query) || /youtu\.be\//.test(query)) {
        try {
          const meta = ytdlExec(`--print "%(id)s|%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s" --no-warnings "${query}"`, { timeout: 15000 })
          const p = meta.trim().split('|')
          if (p.length >= 2) return [{
            id: p[0], title: p[1], url: `https://www.youtube.com/watch?v=${p[0]}`,
            duration: parseInt(p[3]) || 0, thumbnail: p[4] || `https://i.ytimg.com/vi/${p[0]}/hqdefault.jpg`,
            channel: p[2] || 'Unknown', views: 0,
          }]
        } catch {}
      }
      const results = await search(query, { limit: 15, source: { youtube: 'video' } })
      return results.map(r => ({
        id: r.id, title: r.title, url: r.url, duration: r.durationInSec,
        thumbnail: r.thumbnails?.[0]?.url || '', channel: r.channel?.name || '', views: r.views,
      }))
    } catch { return { error: 'Search failed' } }
  })

  ipcMain.handle('youtube-get-stream', async (_event, videoUrl: string) => {
    try {
      if (!ytAvailable) return { error: 'yt-dlp not available' }
      killStream()
      const videoId = extractId(videoUrl)
      const idKey = videoId || `stream_${Date.now()}`

      // Cek cache dulu
      if (streamCache.has(idKey)) {
        const cached = streamCache.get(idKey)!
        console.log('[yt-dlp] Cache hit:', idKey)
        const port = await serveFromFile(cached.filePath, cached.size, cached.contentType)
        return { streamUrl: `http://127.0.0.1:${port}/`, duration: 0, title: '', videoId: idKey }
      }

      // Jika sedang didownload (dari preload), tunggu sampai selesai
      if (downloading.has(idKey)) {
        console.log('[yt-dlp] Waiting for preload:', idKey)
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 500))
          if (streamCache.has(idKey)) {
            const cached = streamCache.get(idKey)!
            console.log('[yt-dlp] Preload finished, serving:', idKey)
            const port = await serveFromFile(cached.filePath, cached.size, cached.contentType)
            return { streamUrl: `http://127.0.0.1:${port}/`, duration: 0, title: '', videoId: idKey }
          }
          if (!downloading.has(idKey)) break // dibatalkan
        }
        // Fallthrough: download langsung
      }

      downloading.add(idKey)

      try {
        // Ambil metadata via spawn async
        let title = 'Unknown', duration = 0
        try {
          const [cmd, ...args] = ytSpawnArgs(['--print', '%(title)s|%(duration)s', '--no-warnings', videoUrl])
          const meta = await spawnOutput(cmd, args, 8000)
          const p = meta.trim().split('|')
          title = p[0] || 'Unknown'
          duration = parseInt(p[1]) || 0
        } catch {}

        // Download via spawn async
        const tmpFile = join(app.getPath('temp'), `nyurka_${idKey}_${Date.now()}.m4a`)
        console.log('[yt-dlp] Downloading audio:', idKey)

        const [dlCmd, ...dlArgs] = ytSpawnArgs(['-f', 'bestaudio[ext=m4a]/bestaudio', '-o', tmpFile, '--no-warnings', '--no-progress', videoUrl])
        await spawnOutput(dlCmd, dlArgs, 180000)

        if (!existsSync(tmpFile)) {
          downloading.delete(idKey)
          return { error: 'Download failed' }
        }

        const stat = statSync(tmpFile)
        const contentType = 'audio/mp4'

        const timer = setTimeout(() => cacheDelete(idKey), 120000)
        cacheSet(idKey, { filePath: tmpFile, size: stat.size, contentType, timer })

        const port = await serveFromFile(tmpFile, stat.size, contentType)
        downloading.delete(idKey)

        return { streamUrl: `http://127.0.0.1:${port}/`, duration, title, videoId: idKey }
      } catch (err) {
        downloading.delete(idKey)
        throw err
      }
    } catch (err) {
      console.error('[yt-dlp] Stream error:', err)
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('youtube-preload', async (_event, videoUrl: string) => {
    try {
      if (!ytAvailable) return false
      const videoId = extractId(videoUrl)
      if (!videoId || streamCache.has(videoId) || downloading.has(videoId)) return true
      downloading.add(videoId)

      const tmpFile = join(app.getPath('temp'), `nyurka_${videoId}_${Date.now()}.m4a`)
      const proc = ytdlSpawn(['-f', 'bestaudio[ext=m4a]/bestaudio', '-o', tmpFile, '--no-warnings', videoUrl])
      proc.on('exit', () => {
        if (existsSync(tmpFile)) {
          const stat = statSync(tmpFile)
          const timer = setTimeout(() => cacheDelete(videoId), 120000)
          cacheSet(videoId, { filePath: tmpFile, size: stat.size, contentType: 'audio/mp4', timer })
          console.log('[yt-dlp] Preload selesai:', videoId)
        }
        downloading.delete(videoId)
      })
      proc.on('error', () => downloading.delete(videoId))
    } catch {}
    return true
  })

  ipcMain.handle('youtube-stop-stream', () => { killStream(); return true })
}

// ── Utility ────────────────────────────────────────────────────────────

function extractId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] || null
}

function killStream() {
  if (activeStream) { activeStream.kill('SIGKILL'); activeStream = null }
  if (activeServer) { activeServer.close(); activeServer = null }
  // Reset downloading state — lagu baru gak bakal dianggap "Already downloading"
  downloading.clear()
}

/** Serve file dari disk dengan Range support (streaming, bukan memory) */
function serveFromFile(filePath: string, fileSize: number, contentType: string): Promise<number> {
  return new Promise((resolve, reject) => {
    killStream()
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const range = req.headers.range

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1
        const chunkLen = end - start + 1

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkLen,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        })

        // Stream dari file (tidak load ke memory!)
        const stream = createReadStream(filePath, { start, end })
        stream.pipe(res)
        stream.on('error', () => { res.end() })
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        })
        const stream = createReadStream(filePath)
        stream.pipe(res)
        stream.on('error', () => { res.end() })
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') { activeServer = server; resolve(addr.port) }
      else reject(new Error('Failed to bind'))
    })
    server.on('error', reject)
  })
}
