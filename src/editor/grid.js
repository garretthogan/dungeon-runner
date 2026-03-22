const COLS = 9
const ROWS = 16
export const CELL_SIZE = 48
const CELL_RADIUS = 0
const GRID_PIXEL_WIDTH = COLS * CELL_SIZE
const GRID_PIXEL_HEIGHT = ROWS * CELL_SIZE

/* Palette: dark 06265F, second lightest blue 42588B, lightest 8ABFFF, enemy FF92AC, player/exit 8EFDB0, purple enemy CE8FFF */
const COLORS = {
  movement: '#42588B',
  movementHighlight: '#8ABFFF',
  movementShadow: '#06265F',
  movementDots: 'rgba(138, 191, 255, 0.4)',
  obstacle: '#06265F',
  player: '#8EFDB0',
  enemy: '#FF92AC',
  exitBg: '#8EFDB0',
  exitText: '#06265F',
  collectible: '#CE8FFF',
  gridLine: '#06265F',
  moveHighlight: '#8EFDB0',
}
const ASSET_BASE_URL = import.meta.env.BASE_URL || '/'
const EXIT_SVG_SRC = `${ASSET_BASE_URL}Exit.svg`
const exitTileImage = new Image()
let isExitTileImageReady = false
exitTileImage.addEventListener('load', () => {
  isExitTileImageReady = true
})
exitTileImage.src = EXIT_SVG_SRC

export function createCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = GRID_PIXEL_WIDTH
  canvas.height = GRID_PIXEL_HEIGHT
  canvas.className = 'puzzle-canvas'
  return canvas
}

function setupCanvasForDpr(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1
  const pixelWidth = Math.round(GRID_PIXEL_WIDTH * dpr)
  const pixelHeight = Math.round(GRID_PIXEL_HEIGHT * dpr)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function roundRect(ctx, x, y, w, h, r) {
  if (r <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}

function drawMovementTile(ctx, x, y, size) {
  const r = CELL_RADIUS
  ctx.beginPath()
  roundRect(ctx, x, y, size, size, r)
  ctx.fillStyle = COLORS.movement
  ctx.fill()
}

function drawObstacle(ctx, x, y, size) {
  let drawX = x
  let drawY = y
  let drawW = size
  let drawH = size
  // Slightly overdraw edge obstacles to avoid subpixel seams against
  // the canvas border when scaled on some devices.
  if (x === 0) {
    drawX -= 1
    drawW += 1
  }
  if (y === 0) {
    drawY -= 1
    drawH += 1
  }
  if (x + size === GRID_PIXEL_WIDTH) drawW += 1
  if (y + size === GRID_PIXEL_HEIGHT) drawH += 1

  ctx.beginPath()
  roundRect(ctx, drawX, drawY, drawW, drawH, CELL_RADIUS)
  ctx.fillStyle = COLORS.obstacle
  ctx.fill()
}

function drawPlayer(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 3
  ctx.fillStyle = COLORS.player
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawEnemy(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 3.2
  ctx.fillStyle = COLORS.enemy
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function getExitRotation(x, y, size) {
  if (y === 0) return 0
  if (y + size === GRID_PIXEL_HEIGHT) return Math.PI
  if (x === 0) return -Math.PI / 2
  if (x + size === GRID_PIXEL_WIDTH) return Math.PI / 2
  return 0
}

function drawExit(ctx, x, y, size, showLabel = true) {
  if (isExitTileImageReady) {
    const rotation = getExitRotation(x, y, size)
    if (rotation === 0) {
      ctx.drawImage(exitTileImage, x, y, size, size)
    } else {
      ctx.save()
      ctx.translate(x + size / 2, y + size / 2)
      ctx.rotate(rotation)
      ctx.drawImage(exitTileImage, -size / 2, -size / 2, size, size)
      ctx.restore()
    }
  }

  if (showLabel) {
    ctx.fillStyle = COLORS.exitText
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Exit', x + size / 2, y + size / 2)
  }
}

function drawCollectible(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 3.2
  ctx.fillStyle = COLORS.collectible
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawMoveHighlight(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = 5
  ctx.fillStyle = 'rgba(142, 253, 176, 0.58)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

export function render(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  setupCanvasForDpr(canvas, ctx)
  const w = GRID_PIXEL_WIDTH
  const h = GRID_PIXEL_HEIGHT
  ctx.clearRect(0, 0, w, h)
  // Paint a dark base so subpixel seams at edges/grid boundaries
  // don't show up as light 1px insets when the canvas is scaled.
  ctx.fillStyle = COLORS.obstacle
  ctx.fillRect(0, 0, w, h)

  const highlightSet = options.highlightCells
    ? new Set(options.highlightCells.map((c) => `${c.row},${c.col}`))
    : null
  const showExitLabel = options.showExitLabel !== false

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = state[row][col]
      const x = col * CELL_SIZE
      const y = row * CELL_SIZE

      if (cell.base === 'obstacle') {
        drawObstacle(ctx, x, y, CELL_SIZE)
      } else {
        drawMovementTile(ctx, x, y, CELL_SIZE)
      }

      if (cell.entity === 'player') drawPlayer(ctx, x, y, CELL_SIZE)
      else if (cell.entity === 'enemy') drawEnemy(ctx, x, y, CELL_SIZE)
      else if (cell.entity === 'exit') drawExit(ctx, x, y, CELL_SIZE, showExitLabel)
      else if (cell.entity === 'collectible') drawCollectible(ctx, x, y, CELL_SIZE)

      if (highlightSet && highlightSet.has(`${row},${col}`)) {
        drawMoveHighlight(ctx, x, y, CELL_SIZE)
      }
    }
  }

  ctx.strokeStyle = COLORS.gridLine
  ctx.lineWidth = 2
  ctx.lineCap = 'butt'
  for (let i = 1; i < COLS; i++) {
    const x = i * CELL_SIZE
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let i = 1; i < ROWS; i++) {
    const y = i * CELL_SIZE
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

export function getCellFromPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = GRID_PIXEL_WIDTH / rect.width
  const scaleY = GRID_PIXEL_HEIGHT / rect.height
  const x = (clientX - rect.left) * scaleX
  const y = (clientY - rect.top) * scaleY
  const col = Math.floor(x / CELL_SIZE)
  const row = Math.floor(y / CELL_SIZE)
  if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
    return { row, col }
  }
  return null
}
