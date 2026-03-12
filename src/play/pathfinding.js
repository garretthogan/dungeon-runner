const ROWS = 8
const COLS = 8

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
]

/**
 * BFS from (fromRow, fromCol) to (toRow, toCol).
 * Only traverses cells with base === 'movement'. Entity can be anything (we allow stepping to target cell).
 * Returns { row, col } for the first step from from toward to, or null if unreachable.
 */
export function getNextStepToward(grid, fromRow, fromCol, toRow, toCol) {
  if (fromRow === toRow && fromCol === toCol) return null
  const visited = new Set()
  const queue = [[toRow, toCol]]
  visited.add(`${toRow},${toCol}`)
  const parent = new Map()
  parent.set(`${toRow},${toCol}`, null)

  while (queue.length > 0) {
    const [r, c] = queue.shift()
    if (r === fromRow && c === fromCol) {
      const path = []
      let key = `${r},${c}`
      while (key != null) {
        const [rr, cc] = key.split(',').map(Number)
        path.push([rr, cc])
        key = parent.get(key) ?? null
      }
      if (path.length >= 2) {
        const next = { row: path[1][0], col: path[1][1] }
        if (next.row === toRow && next.col === toCol) return null
        return next
      }
      return null
    }
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      const cell = grid[nr][nc]
      if (cell?.base !== 'movement') continue
      const isTarget = nr === toRow && nc === toCol
      const isFrom = nr === fromRow && nc === fromCol
      if (!isTarget && !isFrom && cell.entity != null) continue
      const k = `${nr},${nc}`
      if (visited.has(k)) continue
      visited.add(k)
      parent.set(k, `${r},${c}`)
      queue.push([nr, nc])
    }
  }
  return null
}
