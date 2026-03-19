const ROWS = 8
const COLS = 8

function createEmptyCell() {
  return { base: 'movement', entity: null }
}

function createGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => createEmptyCell())
  )
}

let grid = createGrid()

export function getState() {
  return grid
}

export function setCell(row, col, { base, entity } = {}) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return
  const cell = grid[row][col]
  if (base !== undefined) cell.base = base
  if (entity !== undefined) cell.entity = entity
}

/** Returns { row, col } for first match, or null. For 'enemy' use findEnemies() instead. */
export function findEntity(entityType) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].entity === entityType) return { row: r, col: c }
    }
  }
  return null
}

/** Returns all cells with entity === 'enemy'. */
export function findEnemies() {
  const out = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].entity === 'enemy') out.push({ row: r, col: c })
    }
  }
  return out
}

/** Load level from parsed JSON (same format as editor export). Returns true if valid. */
export function loadFromJson(data) {
  if (!data || typeof data !== 'object') return false
  const gridData = data.grid ?? (Array.isArray(data) ? data : null)
  if (!Array.isArray(gridData) || gridData.length !== ROWS) return false
  const row0 = gridData[0]
  if (!Array.isArray(row0) || row0.length !== COLS) return false
  for (let i = 0; i < ROWS; i++) {
    if (!Array.isArray(gridData[i]) || gridData[i].length !== COLS) return false
    for (let j = 0; j < COLS; j++) {
      const cell = gridData[i][j]
      const base = cell && cell.base === 'obstacle' ? 'obstacle' : 'movement'
      const entity =
        cell && (cell.entity === 'player' || cell.entity === 'enemy' || cell.entity === 'exit' || cell.entity === 'collectible')
          ? cell.entity
          : null
      grid[i][j] = { base, entity }
    }
  }
  return true
}
