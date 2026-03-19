import * as playState from './playState.js'

const DEFAULT_PLAYER_HP = 5
const DEFAULT_PLAYER_MAX_HP = 5
const DEFAULT_ENEMY_HP = 5
const DEFAULT_ENEMY_MAX_HP = 5

let turn = 'player'
let actionPoints = 0
let diceRoll = 0
let playerHealth = DEFAULT_PLAYER_HP
let playerMaxHealth = DEFAULT_PLAYER_MAX_HP
let enemies = []

export function getTurn() {
  return turn
}

export function getActionPoints() {
  return actionPoints
}

export function getDiceRoll() {
  return diceRoll
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

export function initFromGrid(grid) {
  turn = 'player'
  actionPoints = 0
  diceRoll = 0
  playerHealth = DEFAULT_PLAYER_HP
  playerMaxHealth = DEFAULT_PLAYER_MAX_HP
  enemies = []
  const playerPos = playState.findEntity('player')
  if (!playerPos) return false
  const enemyCells = playState.findEnemies()
  for (const { row, col } of enemyCells) {
    enemies.push({ row, col, health: DEFAULT_ENEMY_HP, maxHealth: DEFAULT_ENEMY_MAX_HP })
  }
  return true
}

export function rollDice() {
  diceRoll = 1 + Math.floor(Math.random() * 6)
  actionPoints = diceRoll
  return diceRoll
}

export function spendPoints(n) {
  if (n <= 0 || n > actionPoints) return false
  actionPoints -= n
  return true
}

export function addActionPoints(n) {
  if (n <= 0) return
  actionPoints += n
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
  if (cell.entity != null && cell.entity !== 'exit' && cell.entity !== 'collectible') return false
  playState.setCell(fromRow, fromCol, { entity: null })
  playState.setCell(toRow, toCol, { entity: 'player' })
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
  diceRoll = 0
  actionPoints = 0
}

export function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1
}
