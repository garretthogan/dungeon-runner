import * as playState from './playState.js'

const DEFAULT_PLAYER_HP = 3
const DEFAULT_PLAYER_MAX_HP = 3
const DEFAULT_ENEMY_HP = 3
const DEFAULT_ENEMY_MAX_HP = 3

let turn = 'player'
let actionPoints = 0
let diceRoll = 0
let baseActionPoints = 0
let extraDiceRolls = []
let playerHealth = DEFAULT_PLAYER_HP
let playerMaxHealth = DEFAULT_PLAYER_MAX_HP
let enemies = []
let frozenOpponentTurns = 0
let moveEvents = []

export function getTurn() {
  return turn
}

export function getActionPoints() {
  return actionPoints
}

export function getDiceRoll() {
  return diceRoll
}

export function getDicePools() {
  const pools = []
  if (diceRoll > 0) {
    pools.push({ roll: diceRoll, remaining: Math.max(0, baseActionPoints) })
  }
  for (const die of extraDiceRolls) {
    pools.push({ roll: die.roll, remaining: Math.max(0, die.remaining) })
  }
  return pools
}

export function getPlayerHealth() {
  return playerHealth
}

export function getPlayerMaxHealth() {
  return playerMaxHealth
}

export function getEnemies() {
  return enemies
}

export function consumeMoveEvents() {
  const events = moveEvents
  moveEvents = []
  return events
}

export function initFromGrid(grid) {
  turn = 'player'
  actionPoints = 0
  diceRoll = 0
  baseActionPoints = 0
  extraDiceRolls = []
  playerHealth = DEFAULT_PLAYER_HP
  playerMaxHealth = DEFAULT_PLAYER_MAX_HP
  enemies = []
  frozenOpponentTurns = 0
  moveEvents = []
  const playerPos = playState.findEntity('player')
  if (!playerPos) return false
  const enemyCells = playState.findEnemies()
  for (const { row, col } of enemyCells) {
    enemies.push({ row, col, health: DEFAULT_ENEMY_HP, maxHealth: DEFAULT_ENEMY_MAX_HP })
  }
  return true
}

function rollWeightedValue() {
  const r = Math.random()
  if (r < 0.1) return 1
  if (r < 0.2) return 2
  if (r < 0.4) return 3
  if (r < 0.675) return 4
  if (r < 0.95) return 5
  return 6
}

function recomputeActionPoints() {
  const extra = extraDiceRolls.reduce((sum, die) => sum + Math.max(0, die.remaining), 0)
  actionPoints = Math.max(0, baseActionPoints) + extra
}

export function freezeOpponentsForTurns(turnCount) {
  if (turnCount <= 0) return
  frozenOpponentTurns = Math.max(frozenOpponentTurns, turnCount)
}

export function consumeOpponentFrozenTurn() {
  if (frozenOpponentTurns <= 0) return false
  frozenOpponentTurns -= 1
  return true
}

export function rollDice() {
  // Weighted for game feel:
  // - 1/2: 10% each (20% total)
  // - 3: 20%
  // - 4/5: 27.5% each (55% total)
  // - 6: 5%
  // This makes 3 notably more common while keeping 6 rare.
  diceRoll = rollWeightedValue()
  baseActionPoints = diceRoll
  extraDiceRolls = []
  recomputeActionPoints()
  return diceRoll
}

export function addExtraRoll() {
  const roll = rollWeightedValue()
  extraDiceRolls.push({ roll, remaining: roll })
  recomputeActionPoints()
  return roll
}

export function spendPoints(n) {
  if (n <= 0 || n > actionPoints) return false
  let remainingToSpend = n
  if (baseActionPoints > 0) {
    const spendBase = Math.min(baseActionPoints, remainingToSpend)
    baseActionPoints -= spendBase
    remainingToSpend -= spendBase
  }
  for (let i = 0; i < extraDiceRolls.length && remainingToSpend > 0; i++) {
    const die = extraDiceRolls[i]
    const spend = Math.min(die.remaining, remainingToSpend)
    die.remaining -= spend
    remainingToSpend -= spend
  }
  extraDiceRolls = extraDiceRolls.filter((die) => die.remaining > 0)
  recomputeActionPoints()
  return true
}

export function addActionPoints(n) {
  if (n <= 0) return
  baseActionPoints += n
  recomputeActionPoints()
}

export function getPlayerPosition() {
  return playState.findEntity('player')
}

function getEnemyAt(row, col) {
  return enemies.find((e) => e.row === row && e.col === col)
}

export function movePlayer(fromRow, fromCol, toRow, toCol) {
  const grid = playState.getState()
  const cell = grid[toRow]?.[toCol]
  if (!cell || cell.base !== 'movement') return false
  if (cell.entity != null && cell.entity !== 'exit') return false
  playState.setCell(fromRow, fromCol, { entity: null })
  playState.setCell(toRow, toCol, { entity: 'player' })
  moveEvents.push({ entity: 'player', fromRow, fromCol, toRow, toCol })
  return true
}

export function damagePlayer(amount) {
  playerHealth = Math.max(0, playerHealth - amount)
}

export function moveEnemy(fromRow, fromCol, toRow, toCol) {
  const grid = playState.getState()
  const cell = grid[toRow]?.[toCol]
  if (!cell || cell.base !== 'movement' || cell.entity != null) return false
  playState.setCell(fromRow, fromCol, { entity: null })
  playState.setCell(toRow, toCol, { entity: 'enemy' })
  const en = getEnemyAt(fromRow, fromCol)
  if (en) {
    en.row = toRow
    en.col = toCol
  }
  moveEvents.push({ entity: 'enemy', fromRow, fromCol, toRow, toCol })
  return true
}

export function moveCollectible(fromRow, fromCol, toRow, toCol) {
  const grid = playState.getState()
  const cell = grid[toRow]?.[toCol]
  if (!cell || cell.base !== 'movement' || cell.entity != null) return false
  playState.setCell(fromRow, fromCol, { entity: null })
  playState.setCell(toRow, toCol, { entity: 'collectible' })
  moveEvents.push({ entity: 'collectible', fromRow, fromCol, toRow, toCol })
  return true
}

export function damageEnemy(row, col, amount) {
  const en = getEnemyAt(row, col)
  if (!en) return false
  en.health -= amount
  if (en.health <= 0) {
    playState.setCell(row, col, { entity: null })
    enemies = enemies.filter((e) => e.row !== row || e.col !== col)
  }
  return true
}

export function healPlayer(amount) {
  playerHealth = Math.min(playerMaxHealth, playerHealth + amount)
}

export function healEnemy(row, col, amount) {
  const en = getEnemyAt(row, col)
  if (!en) return false
  en.health = Math.min(en.maxHealth ?? DEFAULT_ENEMY_MAX_HP, en.health + amount)
  return true
}

export function endPlayerTurn() {
  turn = 'opponent'
}

export function endOpponentTurn() {
  turn = 'player'
  if (actionPoints <= 0) {
    diceRoll = 0
    baseActionPoints = 0
    extraDiceRolls = []
    actionPoints = 0
  }
}

export function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1
}
