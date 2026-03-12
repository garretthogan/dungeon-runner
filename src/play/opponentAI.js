import * as playState from './playState.js'
import * as gameState from './gameState.js'
import { getNextStepToward } from './pathfinding.js'

/**
 * Run the opponent turn: roll dice, pick random enemy, move toward player or heal, then end turn.
 * Call after gameState.endPlayerTurn(). Updates grid via playState and gameState.
 */
export function runOpponentTurn() {
  gameState.rollDice()

  const enemies = gameState.getEnemies()
  if (enemies.length === 0) {
    gameState.endOpponentTurn()
    return
  }

  const grid = playState.getState()
  const playerPos = gameState.getPlayerPosition()
  if (!playerPos) {
    gameState.endOpponentTurn()
    return
  }

  const idx = Math.floor(Math.random() * enemies.length)
  const enemy = enemies[idx]
  if (!enemy) {
    gameState.endOpponentTurn()
    return
  }

  let { row: er, col: ec } = enemy
  const { row: pr, col: pc } = playerPos
  const playerHealth = gameState.getPlayerHealth()

  while (gameState.getActionPoints() > 0) {
    const adjacent = gameState.isAdjacent(er, ec, pr, pc)
    if (!adjacent) {
      const next = getNextStepToward(grid, er, ec, pr, pc)
      if (!next) break
      const ok = gameState.moveEnemy(er, ec, next.row, next.col)
      if (!ok) break
      gameState.spendPoints(1)
      er = next.row
      ec = next.col
      enemy.row = er
      enemy.col = ec
      continue
    }
    if (enemy.health < playerHealth) {
      gameState.healEnemy(er, ec, 1)
      gameState.spendPoints(1)
    } else {
      break
    }
  }

  gameState.endOpponentTurn()
}
