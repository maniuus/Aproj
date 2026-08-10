import { deflateSync, crc32 } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const SIZE = 512
const ROUND = 96
const AMBER_A = [245, 158, 11]   // #f59e0b
const AMBER_B = [217, 119, 6]    // #d97706
const WHITE = [255, 255, 255]

// bitmap font 11x13 untuk huruf "A"
const A = [
  '...######...',
  '..#......#..',
  '..#......#..',
  '.##......##.',
  '.#........#.',
  '.#...##...#.',
  '############',
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#'
]

function inRoundRect(x, y) {
  if (x < ROUND && y < ROUND) return Math.hypot(x - (ROUND - 0.5), y - (ROUND - 0.5)) <= ROUND
  if (x >= SIZE - ROUND && y < ROUND) return Math.hypot(x - (SIZE - ROUND + 0.5), y - (ROUND - 0.5)) <= ROUND
  if (x < ROUND && y >= SIZE - ROUND) return Math.hypot(x - (ROUND - 0.5), y - (SIZE - ROUND + 0.5)) <= ROUND
  if (x >= SIZE - ROUND && y >= SIZE - ROUND) return Math.hypot(x - (SIZE - ROUND + 0.5), y - (SIZE - ROUND + 0.5)) <= ROUND
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE
}

function glyphHit(px, py) {
  const rows = A.length
  const cols = A[0].length
  const cell = 30
  const gw = cols * cell
  const gh = rows * cell
  const ox = Math.floor((SIZE - gw) / 2)
  const oy = Math.floor((SIZE - gh) / 2)
  const gx = Math.floor((px - ox) / cell)
  const gy = Math.floor((py - oy) / cell)
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false
  return A[gy][gx] === '#'
}

// supersampling 2x2 untuk anti-aliasing
function pixel(x, y) {
  let r = 0, g = 0, b = 0, a = 0, n = 0
  for (let dx = 0; dx < 2; dx++) {
    for (let dy = 0; dy < 2; dy++) {
      const sx = x + dx * 0.5
      const sy = y + dy * 0.5
      if (!inRoundRect(sx, sy)) continue
      const t = (sx + sy) / (2 * SIZE)
      const bg = [
        AMBER_A[0] + (AMBER_B[0] - AMBER_A[0]) * t,
        AMBER_A[1] + (AMBER_B[1] - AMBER_A[1]) * t,
        AMBER_A[2] + (AMBER_B[2] - AMBER_A[2]) * t
      ]
      const c = glyphHit(sx, sy) ? WHITE : bg
      r += c[0]; g += c[1]; b += c[2]; a += 255; n++
    }
  }
  if (n === 0) return [0, 0, 0, 0]
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)]
}

// ---- PNG encoder (RGBA, bit depth 8) ----
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

function buildPNG() {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * (SIZE * 4 + 1)
    raw[rowStart] = 0 // filter none
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = pixel(x, y)
      const o = rowStart + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- ICO wrapper (Vista+: berisi PNG) ----
function buildICO(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type icon
  header.writeUInt16LE(1, 4) // count 1
  const entry = Buffer.alloc(16)
  entry[0] = SIZE >= 256 ? 0 : SIZE
  entry[1] = SIZE >= 256 ? 0 : SIZE
  entry[2] = 0 // palette
  entry[3] = 0 // reserved
  entry.writeUInt16LE(1, 4)  // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12) // data offset
  return Buffer.concat([header, entry, png])
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'build')
mkdirSync(outDir, { recursive: true })
const png = buildPNG()
const ico = buildICO(png)
writeFileSync(join(outDir, 'icon.png'), png)
writeFileSync(join(outDir, 'icon.ico'), ico)
console.log(`build/icon.png ${png.length} bytes, build/icon.ico ${ico.length} bytes`)
