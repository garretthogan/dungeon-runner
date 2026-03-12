const COLS = 8
const ROWS = 8
export const CELL_SIZE = 48
const CELL_RADIUS = 4

/* Mockup palette: light blue-grey movement tiles with subtle dotted texture */
const COLORS = {
  movement: '#6a7c92',
  movementHighlight: '#7a8ca2',
  movementShadow: '#5a6a7e',
  movementDots: 'rgba(255, 255, 255, 0.4)',
  obstacle: '#2d3546',
  player: '#b0d038',
  playerGlow: '#90b020',
  enemy: '#b83840',
  exitBg: '#6a7c92',
  exitText: '#ffffff',
  collectible: '#d8b830',
  collectibleGlow: '#b89828',
  gridLine: '#3a4558',
  moveHighlight: '#d87890',
}

export function createCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL_SIZE
  canvas.height = ROWS * CELL_SIZE
  canvas.className = 'puzzle-canvas'
  return canvas
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
  const sx = x + 0.5
  const sy = y + 0.5
  const sw = size - 1
  const sh = size - 1

  const gradient = ctx.createLinearGradient(x, y, x, y + size)
  gradient.addColorStop(0, COLORS.movementHighlight)
  gradient.addColorStop(0.4, COLORS.movement)
  gradient.addColorStop(1, COLORS.movementShadow)
  ctx.beginPath()
  roundRect(ctx, sx, sy, sw, sh, r)
  ctx.fillStyle = gradient
  ctx.fill()

  ctx.fillStyle = COLORS.movementDots
  const step = size / 5
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      ctx.beginPath()
      ctx.arc(x + step * (i + 0.5), y + step * (j + 0.5), 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawObstacle(ctx, x, y, size) {
  ctx.beginPath()
  roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, CELL_RADIUS)
  ctx.fillStyle = COLORS.obstacle
  ctx.fill()
}

function drawPlayer(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 3
  ctx.shadowColor = COLORS.playerGlow
  ctx.shadowBlur = 10
  ctx.fillStyle = COLORS.player
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawEnemy(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 3.2
  ctx.fillStyle = COLORS.enemy
  ctx.beginPath()
  ctx.ellipse(cx, cy + 2, r * 1.05, r * 0.9, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawExit(ctx, x, y, size) {
  ctx.beginPath()
  roundRect(ctx, x + 2, y + 2, size - 4, size - 4, CELL_RADIUS - 1)
  ctx.fillStyle = COLORS.exitBg
  ctx.fill()
  ctx.fillStyle = COLORS.exitText
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('EXIT', x + size / 2, y + size / 2 - 5)
  ctx.beginPath()
  ctx.moveTo(x + size / 2 - 5, y + size / 2 + 2)
  ctx.lineTo(x + size / 2, y + size / 2 + 10)
  ctx.lineTo(x + size / 2 + 5, y + size / 2 + 2)
  ctx.closePath()
  ctx.fill()
}

function drawCollectible(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 4
  ctx.shadowColor = COLORS.collectibleGlow
  ctx.shadowBlur = 8
  ctx.fillStyle = COLORS.collectible
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = COLORS.collectibleGlow
  ctx.beginPath()
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawMoveHighlight(ctx, x, y, size) {
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.fillStyle = COLORS.moveHighlight
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fill()
}

export function render(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const highlightSet = options.highlightCells
    ? new Set(options.highlightCells.map((c) => `${c.row},${c.col}`))
    : null

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
      else if (cell.entity === 'exit') drawExit(ctx, x, y, CELL_SIZE)
      else if (cell.entity === 'collectible') drawCollectible(ctx, x, y, CELL_SIZE)

      if (highlightSet && highlightSet.has(`${row},${col}`)) {
        drawMoveHighlight(ctx, x, y, CELL_SIZE)
      }
    }
  }

  ctx.strokeStyle = COLORS.gridLine
  ctx.lineWidth = 1
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath()
    ctx.moveTo(i * CELL_SIZE, 0)
    ctx.lineTo(i * CELL_SIZE, h)
    ctx.stroke()
  }
  for (let i = 1; i < ROWS; i++) {
    ctx.beginPath()
    ctx.moveTo(0, i * CELL_SIZE)
    ctx.lineTo(w, i * CELL_SIZE)
    ctx.stroke()
  }
}

export function getCellFromPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (clientX - rect.left) * scaleX
  const y = (clientY - rect.top) * scaleY
  const col = Math.floor(x / CELL_SIZE)
  const row = Math.floor(y / CELL_SIZE)
  if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
    return { row, col }
  }
  return null
}
