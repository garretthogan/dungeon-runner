import * as playState from '../play/playState.js'
import * as gameState from '../play/gameState.js'
import * as grid from '../editor/grid.js'
import { CELL_SIZE } from '../editor/grid.js'
import { runOpponentTurn } from '../play/opponentAI.js'
import { getReachableCells, getNextStepToward } from '../play/pathfinding.js'

const DAMAGE_INDICATOR_MS = 1200
const GRID_SIZE = 8

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

export function renderPlay(navigate) {
  let gameActive = false
  let lastLevelData = null
  let endlessLevel = 1

  const root = document.createElement('div')
  root.className = 'view view-play'

  root.innerHTML = `
    <header class="play-header">
      <div class="play-header-spacer"></div>
      <h1 class="play-title"><img src="${baseUrl}DR-Logo.png" alt="Dungeon Runner" class="app-logo" /></h1>
      <div class="play-settings-wrap">
        <button type="button" class="play-gear" aria-label="Settings" aria-expanded="false" aria-haspopup="menu" id="play-gear"><img src="${baseUrl}settings-icon.png" alt="" class="play-gear-icon" aria-hidden="true" /></button>
        <div class="play-settings-menu" id="play-settings-menu" role="menu" hidden>
          <a href="/" class="play-settings-menu-item nav-link" data-path="/" role="menuitem">← Back</a>
        </div>
      </div>
    </header>
    <p class="play-turn-indicator" id="play-turn-indicator"></p>
    <div class="play-stage-wrap">
      <div class="play-opponent-overlay" id="play-opponent-overlay" aria-live="polite" hidden>
        <span class="play-opponent-spinner"></span>
        <span class="play-opponent-label">Opponent turn</span>
      </div>
      <div class="play-stage-inner">
        <div class="canvas-wrap play-canvas-wrap">
          <canvas class="puzzle-canvas" id="play-canvas"></canvas>
        </div>
        <div class="play-bottom-bar">
          <div class="play-dice-wrap">
            <button type="button" class="play-dice-tap" id="play-dice-tap">Tap</button>
            <div class="play-dice" id="play-dice" role="img" aria-label="Dice showing 0" data-value="0">
            <span class="play-dice-pip pip-1" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-2" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-3" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-4" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-5" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-6" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-7" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-8" aria-hidden="true">●</span>
            <span class="play-dice-pip pip-9" aria-hidden="true">●</span>
            </div>
          </div>
          <div class="play-status-bar">
            <div class="play-hearts" id="play-hearts" aria-label="Player hit points"></div>
            <div class="play-energy" id="play-energy" aria-label="Action points"></div>
          </div>
        </div>
        <div class="play-actions" role="toolbar" aria-label="Action card slots">
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
          <div class="play-action-slot" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  `

  const gearBtn = root.querySelector('#play-gear')
  const settingsMenu = root.querySelector('#play-settings-menu')
  const backLink = root.querySelector('.play-settings-menu-item[data-path="/"]')
  if (gearBtn && settingsMenu) {
    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const open = settingsMenu.hidden
      settingsMenu.hidden = !open
      gearBtn.setAttribute('aria-expanded', open)
    })
    document.addEventListener('click', (e) => {
      if (!settingsMenu.hidden && !gearBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
        settingsMenu.hidden = true
        gearBtn.setAttribute('aria-expanded', 'false')
      }
    })
  }
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault()
      navigate('/')
    })
  }

  const canvasWrap = root.querySelector('.play-canvas-wrap')
  const canvas = grid.createCanvas()
  canvas.id = 'play-canvas'
  canvasWrap.innerHTML = ''
  canvasWrap.appendChild(canvas)

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function shuffle(items) {
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  function cellKey(row, col) {
    return `${row},${col}`
  }

  function hasPath(gridData, start, goal) {
    const queue = [{ row: start.row, col: start.col }]
    const visited = new Set([cellKey(start.row, start.col)])
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    while (queue.length > 0) {
      const cur = queue.shift()
      if (cur.row === goal.row && cur.col === goal.col) return true
      for (const [dr, dc] of dirs) {
        const nr = cur.row + dr
        const nc = cur.col + dc
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue
        const cell = gridData[nr]?.[nc]
        if (!cell || cell.base !== 'movement') continue
        const key = cellKey(nr, nc)
        if (visited.has(key)) continue
        visited.add(key)
        queue.push({ row: nr, col: nc })
      }
    }
    return false
  }

  function createEndlessLevel(levelNumber) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const gridData = Array.from({ length: GRID_SIZE }, () =>
        Array.from({ length: GRID_SIZE }, () => ({ base: 'movement', entity: null }))
      )

      const allCells = []
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          allCells.push({ row, col })
        }
      }

      const playerCell = allCells[randomInt(0, allCells.length - 1)]
      const farCells = allCells.filter(
        (c) => Math.abs(c.row - playerCell.row) + Math.abs(c.col - playerCell.col) >= 6
      )
      if (farCells.length === 0) continue
      const exitCell = farCells[randomInt(0, farCells.length - 1)]

      const reserved = new Set([cellKey(playerCell.row, playerCell.col), cellKey(exitCell.row, exitCell.col)])
      const obstacleCount = Math.min(22, 8 + levelNumber)
      let placedObstacles = 0
      for (const c of shuffle(allCells)) {
        const key = cellKey(c.row, c.col)
        if (reserved.has(key)) continue
        if (placedObstacles >= obstacleCount) break
        if (gridData[c.row][c.col].base === 'obstacle') continue
        gridData[c.row][c.col].base = 'obstacle'
        if (!hasPath(gridData, playerCell, exitCell)) {
          gridData[c.row][c.col].base = 'movement'
        } else {
          placedObstacles += 1
        }
      }

      if (!hasPath(gridData, playerCell, exitCell)) continue

      gridData[playerCell.row][playerCell.col].entity = 'player'
      gridData[exitCell.row][exitCell.col].entity = 'exit'

      const freeCells = shuffle(
        allCells.filter((c) => {
          const cell = gridData[c.row][c.col]
          return cell.base === 'movement' && cell.entity == null
        })
      )

      const redCount = Math.min(8, 2 + Math.floor(levelNumber / 2))
      const purpleCount = Math.min(8, 1 + Math.floor(levelNumber / 3))
      let idx = 0
      for (let i = 0; i < redCount && idx < freeCells.length; i++, idx++) {
        const c = freeCells[idx]
        gridData[c.row][c.col].entity = 'enemy'
      }
      for (let i = 0; i < purpleCount && idx < freeCells.length; i++, idx++) {
        const c = freeCells[idx]
        gridData[c.row][c.col].entity = 'collectible'
      }

      return {
        version: 1,
        name: `Endless ${levelNumber}`,
        dimensions: { rows: GRID_SIZE, cols: GRID_SIZE },
        createdAt: new Date().toISOString(),
        grid: gridData,
      }
    }
    return null
  }

  function startLevelData(data) {
    if (!data || !playState.loadFromJson(data)) return false
    lastLevelData = data
    renderCanvas()
    startGame()
    return true
  }

  function startEndlessLevel(levelNumber) {
    const levelData = createEndlessLevel(levelNumber)
    if (!levelData) return false
    return startLevelData(levelData)
  }

  function advanceEndlessMode() {
    endlessLevel += 1
    const ok = startEndlessLevel(endlessLevel)
    if (!ok) {
      gameActive = false
      updateUI()
      alert('Could not generate the next endless level.')
    }
  }

  function renderCanvas() {
    const state = playState.getState()
    let highlightCells = []
    if (
      gameActive &&
      gameState.getTurn() === 'player' &&
      gameState.getActionPoints() >= 1
    ) {
      const playerPos = gameState.getPlayerPosition()
      if (playerPos) {
        highlightCells = getReachableCells(
          state,
          playerPos.row,
          playerPos.col,
          gameState.getActionPoints()
        )
      }
    }
    grid.render(canvas, state, { highlightCells })
  }

  function showDamageIndicator(row, col, remaining, maxHealth) {
    const wrap = root.querySelector('.play-canvas-wrap')
    if (!wrap) return
    const el = document.createElement('div')
    el.className = 'play-damage-indicator'
    el.textContent = `${remaining}/${maxHealth}`
    const gridPx = 8 * CELL_SIZE
    el.style.left = `${((col + 0.5) / 8) * 100}%`
    el.style.top = `${((row * CELL_SIZE - 6) / gridPx) * 100}%`
    wrap.appendChild(el)
    setTimeout(() => {
      el.classList.add('play-damage-indicator-fade')
      setTimeout(() => el.remove(), 300)
    }, DAMAGE_INDICATOR_MS)
  }

  function updateUI() {
    const indicator = root.querySelector('#play-turn-indicator')
    const diceEl = root.querySelector('#play-dice')
    const tapBtn = root.querySelector('#play-dice-tap')

    if (!gameActive) {
      if (tapBtn) tapBtn.classList.remove('play-dice-tap-visible')
      indicator.textContent = ''
      if (diceEl) {
        const defaultRoll = 1 + Math.floor(Math.random() * 6)
        diceEl.setAttribute('data-value', String(defaultRoll))
        diceEl.setAttribute('aria-label', `Dice showing ${defaultRoll}`)
        const pipMap = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
        const show = pipMap[defaultRoll] || []
        for (let i = 1; i <= 9; i++) {
          const pip = diceEl.querySelector(`.pip-${i}`)
          if (pip) pip.classList.toggle('show', show.includes(i))
        }
      }
      const heartsEl = root.querySelector('#play-hearts')
      if (heartsEl) {
        const count = 6
        let html = ''
        for (let i = 0; i < count; i++) {
          html += `<img src="${baseUrl}heart-icon.svg" alt="" class="play-heart" aria-hidden="true" />`
        }
        heartsEl.innerHTML = html
        heartsEl.setAttribute('aria-label', `${count} of ${count} hit points`)
      }
      const energyEl = root.querySelector('#play-energy')
      if (energyEl) {
        const count = 6
        let html = ''
        for (let i = 0; i < count; i++) {
          html += `<img src="${baseUrl}energy-icon.svg" alt="" class="play-energy-icon" aria-hidden="true" />`
        }
        energyEl.innerHTML = html
        energyEl.setAttribute('aria-label', `${count} action points`)
      }
      const overlay = root.querySelector('#play-opponent-overlay')
      if (overlay) overlay.hidden = true
      return
    }

    const turn = gameState.getTurn()
    const ap = gameState.getActionPoints()
    const hp = gameState.getPlayerHealth()
    const maxHp = gameState.getPlayerMaxHealth()
    const dice = gameState.getDiceRoll()

    const overlay = root.querySelector('#play-opponent-overlay')
    const iconCount = 6
    const heartsEl = root.querySelector('#play-hearts')
    if (heartsEl) {
      const filledHearts = maxHp > 0 ? Math.round((hp / maxHp) * iconCount) : iconCount
      let html = ''
      for (let i = 0; i < iconCount; i++) {
        const filled = i < filledHearts
        const src = filled ? `${baseUrl}heart-icon.svg` : `${baseUrl}heart-icon-outline.svg`
        html += `<img src="${src}" alt="" class="play-heart" aria-hidden="true" />`
      }
      heartsEl.innerHTML = html
      heartsEl.setAttribute('aria-label', `${hp} of ${maxHp} hit points`)
    }
    const energyEl = root.querySelector('#play-energy')
    if (energyEl) {
      let html = ''
      for (let i = 0; i < iconCount; i++) {
        const filled = i < ap
        const src = filled ? `${baseUrl}energy-icon.svg` : `${baseUrl}energy-icon-outline.svg`
        html += `<img src="${src}" alt="" class="play-energy-icon" aria-hidden="true" />`
      }
      energyEl.innerHTML = html
      energyEl.setAttribute('aria-label', `${ap} action points`)
    }
    if (diceEl) {
      diceEl.setAttribute('data-value', String(dice))
      diceEl.setAttribute('aria-label', `Dice showing ${dice}`)
      const pipMap = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
      const show = pipMap[dice] || []
      for (let i = 1; i <= 9; i++) {
        const pip = diceEl.querySelector(`.pip-${i}`)
        if (pip) pip.classList.toggle('show', show.includes(i))
      }
    }
    if (turn === 'opponent') {
      if (tapBtn) tapBtn.classList.remove('play-dice-tap-visible')
      indicator.textContent = 'Opponent turn'
      if (overlay) overlay.hidden = false
    } else {
      if (overlay) overlay.hidden = true
      const needsRoll = dice === 0
      if (tapBtn) tapBtn.classList.toggle('play-dice-tap-visible', needsRoll)
      indicator.textContent = `Your turn - Endless ${endlessLevel}`
    }
  }

  function startGame() {
    if (!gameState.initFromGrid(playState.getState())) {
      alert('Level has no player.')
      return
    }
    gameActive = true
    updateUI()
    renderCanvas()
  }

  function endPlayerTurnNow() {
    if (!gameActive || gameState.getTurn() !== 'player') return
    gameState.endPlayerTurn()
    updateUI()
    renderCanvas()
    const overlay = root.querySelector('#play-opponent-overlay')
    if (overlay) overlay.hidden = false
    const minOpponentMs = 600
    const start = Date.now()
    setTimeout(() => {
      runOpponentTurn()
      const elapsed = Date.now() - start
      const remaining = Math.max(0, minOpponentMs - elapsed)
      setTimeout(() => {
        updateUI()
        renderCanvas()
        if (gameState.getPlayerHealth() <= 0) {
          if (lastLevelData) {
            playState.loadFromJson(lastLevelData)
            renderCanvas()
            startGame()
          } else {
            gameActive = false
            updateUI()
            alert('You lose!')
          }
        }
      }, remaining)
    }, 100)
  }

  function scheduleEndTurnIfNoAp() {
    if (gameActive && gameState.getTurn() === 'player' && gameState.getActionPoints() === 0) {
      setTimeout(endPlayerTurnNow, 1000)
    }
  }

  function isAttackableEntity(entity) {
    return entity === 'enemy' || entity === 'collectible'
  }

  function attackTarget(row, col, entity) {
    if (!gameState.spendPoints(1)) return false
    if (entity === 'enemy') {
      const enemy = gameState.getEnemies().find((e) => e.row === row && e.col === col)
      const maxHp = enemy?.maxHealth ?? 3
      const healthBefore = enemy?.health ?? 0
      gameState.damageEnemy(row, col, 1)
      const remaining = Math.max(0, healthBefore - 1)
      showDamageIndicator(row, col, remaining, maxHp)
      return true
    }
    if (entity === 'collectible') {
      // Purple-dot enemies are currently represented as collectible entities in level data.
      playState.setCell(row, col, { entity: null })
      showDamageIndicator(row, col, 0, 1)
      return true
    }
    return false
  }

  function onCellClick(row, col) {
    if (!gameActive || gameState.getTurn() !== 'player') return
    const playerPos = gameState.getPlayerPosition()
    if (!playerPos) return
    const gridData = playState.getState()
    const cell = gridData[row]?.[col]
    if (!cell) return

    const ap = gameState.getActionPoints()

    if (
      ap >= 1 &&
      gameState.isAdjacent(playerPos.row, playerPos.col, row, col) &&
      isAttackableEntity(cell.entity)
    ) {
      const attacked = attackTarget(row, col, cell.entity)
      if (!attacked) return
      updateUI()
      renderCanvas()
      scheduleEndTurnIfNoAp()
      return
    }

    if (ap >= 1) {
      const reachable = getReachableCells(
        gridData,
        playerPos.row,
        playerPos.col,
        ap
      )
      const isReachable = reachable.some((c) => c.row === row && c.col === col)
      if (isReachable) {
        const next = getNextStepToward(
          gridData,
          playerPos.row,
          playerPos.col,
          row,
          col
        )
        if (next && gameState.spendPoints(1)) {
          const destCell = gridData[next.row]?.[next.col]
          const movedToExit = destCell?.entity === 'exit'
          gameState.movePlayer(playerPos.row, playerPos.col, next.row, next.col)
          updateUI()
          renderCanvas()
          if (movedToExit) {
            advanceEndlessMode()
          } else {
            scheduleEndTurnIfNoAp()
          }
        }
      }
    }
  }

  canvas.addEventListener('click', (e) => {
    const cell = grid.getCellFromPoint(canvas, e.clientX, e.clientY)
    if (cell) onCellClick(cell.row, cell.col)
  })

  function loadLevel(file) {
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        const text = typeof reader.result === 'string' ? reader.result.trim() : ''
        data = JSON.parse(text)
      } catch (_) {
        alert('Invalid level file: not valid JSON.')
        return
      }
      if (!data || !playState.loadFromJson(data)) {
        alert('Invalid level file: need an 8×8 grid with a player cell.')
        return
      }
      lastLevelData = data
      renderCanvas()
      startGame()
    }
    reader.onerror = () => alert('Could not read file.')
    reader.readAsText(file)
  }

  if (!startEndlessLevel(endlessLevel)) {
    alert('Could not generate endless level.')
  }

  root.querySelector('#play-dice-tap').addEventListener('click', () => {
    if (!gameActive || gameState.getTurn() !== 'player' || gameState.getDiceRoll() !== 0) return
    gameState.rollDice()
    root.querySelector('#play-dice-tap').classList.remove('play-dice-tap-visible')
    updateUI()
    renderCanvas()
  })

  renderCanvas()
  updateUI()
  return root
}
