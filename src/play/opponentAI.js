import * as playState from './playState.js'
import * as gameState from './gameState.js'

/**
 * Run the opponent turn.
 * Every enemy piece gets exactly one action:
 * - If adjacent to player, attack once.
 * - Otherwise move by piece rules:
 *   - Red enemy ('enemy'): up to 3 squares diagonally.
 *   - Purple enemy ('collectible'): 1 square orthogonally.
 * Call after gameState.endPlayerTurn(). Updates grid via playState and gameState.
 */
export function runOpponentTurn() {
  const grid = playState.getState()

  const pieces = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const entity = grid[r][c]?.entity
      if (entity === 'enemy' || entity === 'collectible') {
        pieces.push({ row: r, col: c, entity })
      }
    }
  }

  for (const piece of pieces) {
    const playerPos = gameState.getPlayerPosition()
    if (!playerPos || gameState.getPlayerHealth() <= 0) break

    // Piece may have moved/been removed earlier in the turn; skip stale snapshot entries.
    if (grid[piece.row]?.[piece.col]?.entity !== piece.entity) continue

    if (gameState.isAdjacent(piece.row, piece.col, playerPos.row, playerPos.col)) {
      gameState.damagePlayer(1)
      continue
    }

    if (piece.entity === 'enemy') {
      moveRedEnemy(piece.row, piece.col, playerPos.row, playerPos.col)
    } else {
      movePurpleEnemy(piece.row, piece.col, playerPos.row, playerPos.col)
    }
  }

  gameState.endOpponentTurn()
}

function moveRedEnemy(fromRow, fromCol, playerRow, playerCol) {
  // Red pieces can move 1-3 squares diagonally.
  const diagonalDirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]

  const candidates = []
  for (const [dr, dc] of diagonalDirs) {
    for (let step = 1; step <= 3; step++) {
      const toRow = fromRow + dr * step
      const toCol = fromCol + dc * step
      if (!isValidDiagonalDestination(fromRow, fromCol, toRow, toCol)) break
      candidates.push({ row: toRow, col: toCol })
    }
  }

  const best = pickHighestScoringTile(candidates, playerRow, playerCol)
  if (best) {
    gameState.moveEnemy(fromRow, fromCol, best.row, best.col)
  }
}

function movePurpleEnemy(fromRow, fromCol, playerRow, playerCol) {
  const orthogonalDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  const candidates = []
  for (const [dr, dc] of orthogonalDirs) {
    const toRow = fromRow + dr
    const toCol = fromCol + dc
    if (!isOpenMovementCell(toRow, toCol)) continue
    candidates.push({ row: toRow, col: toCol })
  }

  const best = pickHighestScoringTile(candidates, playerRow, playerCol)
  if (!best) return
  playState.setCell(fromRow, fromCol, { entity: null })
  playState.setCell(best.row, best.col, { entity: 'collectible' })
}

function pickHighestScoringTile(candidates, playerRow, playerCol) {
  let best = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const tile of candidates) {
    const score = scoreTileForEnemy(tile.row, tile.col, playerRow, playerCol)
    if (score > bestScore) {
      bestScore = score
      best = tile
    }
  }
  return best
}

function scoreTileForEnemy(tileRow, tileCol, playerRow, playerCol) {
  // Higher score means better tile; closer to player scores higher.
  return -manhattan(tileRow, tileCol, playerRow, playerCol)
}

function isValidDiagonalDestination(fromRow, fromCol, toRow, toCol) {
  if (!isOpenMovementCell(toRow, toCol)) return false
  const rowStep = Math.sign(toRow - fromRow)
  const colStep = Math.sign(toCol - fromCol)
  const steps = Math.abs(toRow - fromRow)
  for (let i = 1; i <= steps; i++) {
    const r = fromRow + rowStep * i
    const c = fromCol + colStep * i
    // Intermediate cells and destination must be passable for sliding movement.
    if (i === steps) {
      if (!isOpenMovementCell(r, c)) return false
    } else {
      const grid = playState.getState()
      const cell = grid[r]?.[c]
      if (!cell || cell.base !== 'movement' || cell.entity != null) return false
    }
  }
  return true
}

function isOpenMovementCell(row, col) {
  const grid = playState.getState()
  const cell = grid[row]?.[col]
  return Boolean(cell && cell.base === 'movement' && cell.entity == null)
}

function manhattan(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2)
}
