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

export function clearEntity(entity) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].entity === entity) {
        grid[r][c].entity = null
      }
    }
  }
}

/** Replace the entire grid (e.g. after import). Validates dimensions and cell shape. */
export function loadState(rows, cols, gridData) {
  const r = Number(rows) || ROWS
  const c = Number(cols) || COLS
  if (r !== ROWS || c !== COLS) return false
  if (!Array.isArray(gridData) || gridData.length !== r) return false
  for (let i = 0; i < r; i++) {
    if (!Array.isArray(gridData[i]) || gridData[i].length !== c) return false
    for (let j = 0; j < c; j++) {
      const cell = gridData[i][j]
      const base = cell?.base === 'obstacle' ? 'obstacle' : 'movement'
      const entity =
        cell?.entity === 'player' ||
        cell?.entity === 'enemy' ||
        cell?.entity === 'exit' ||
        cell?.entity === 'collectible'
          ? cell.entity
          : null
      grid[i][j] = { base, entity }
    }
  }
  return true
}
