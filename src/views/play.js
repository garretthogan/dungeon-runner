import * as playState from '../play/playState.js'
import * as gameState from '../play/gameState.js'
import * as grid from '../editor/grid.js'
import { CELL_SIZE } from '../editor/grid.js'
import { runOpponentTurn } from '../play/opponentAI.js'

const DAMAGE_INDICATOR_MS = 1200

export function renderPlay(navigate) {
  let clickMode = null
  let gameActive = false

  const root = document.createElement('div')
  root.className = 'view view-play'

  root.innerHTML = `
    <header class="play-header">
      <a href="/" class="nav-link back-link" data-path="/">← Back</a>
      <h1 class="play-title">DUNGEON RUNNER</h1>
      <button type="button" class="play-gear" aria-label="Settings">⚙</button>
    </header>
    <p class="play-turn-indicator" id="play-turn-indicator">Load a level to start</p>
    <div class="play-stage-wrap">
      <div class="play-opponent-overlay" id="play-opponent-overlay" aria-live="polite" hidden>
        <span class="play-opponent-spinner"></span>
        <span class="play-opponent-label">Opponent turn</span>
      </div>
      <div class="canvas-wrap play-canvas-wrap">
        <canvas class="puzzle-canvas" id="play-canvas"></canvas>
      </div>
      <div class="play-status-bar">
        <span class="play-status-item"><span class="play-status-icon" aria-hidden="true">🎲</span> <span id="play-dice">–</span></span>
        <span class="play-status-item"><span class="play-status-icon" aria-hidden="true">❤</span> <span id="play-hp">–</span></span>
        <span class="play-status-item"><span class="play-status-icon" aria-hidden="true">⚡</span> <span id="play-ap">–</span></span>
      </div>
      <div class="play-actions" role="toolbar">
        <button type="button" class="play-action-card" id="play-btn-move">Move</button>
        <button type="button" class="play-action-card" id="play-btn-attack">Attack</button>
        <button type="button" class="play-action-card" id="play-btn-defend">Defend</button>
        <button type="button" class="play-action-card" id="play-btn-end">End turn</button>
      </div>
    </div>
    <div class="play-load-wrap">
      <label class="action-btn action-btn-import">
        Load level
        <input type="file" accept=".json,application/json" id="play-load-level" hidden />
      </label>
    </div>
  `

  const backLink = root.querySelector('[data-path="/"]')
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

  function renderCanvas() {
    grid.render(canvas, playState.getState())
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
    const hpEl = root.querySelector('#play-hp')
    const apEl = root.querySelector('#play-ap')
    const btnMove = root.querySelector('#play-btn-move')
    const btnAttack = root.querySelector('#play-btn-attack')
    const btnDefend = root.querySelector('#play-btn-defend')
    const btnEnd = root.querySelector('#play-btn-end')

    if (!gameActive) {
      indicator.textContent = 'Load a level to start'
      diceEl.textContent = '–'
      hpEl.textContent = '–'
      apEl.textContent = '–'
      const overlay = root.querySelector('#play-opponent-overlay')
      if (overlay) overlay.hidden = true
      btnMove.disabled = true
      btnAttack.disabled = true
      btnDefend.disabled = true
      btnEnd.disabled = true
      return
    }

    const turn = gameState.getTurn()
    const ap = gameState.getActionPoints()
    const hp = gameState.getPlayerHealth()
    const maxHp = gameState.getPlayerMaxHealth()
    const dice = gameState.getDiceRoll()

    const overlay = root.querySelector('#play-opponent-overlay')
    if (turn === 'opponent') {
      indicator.textContent = 'Opponent turn'
      if (overlay) overlay.hidden = false
      btnMove.disabled = true
      btnAttack.disabled = true
      btnDefend.disabled = true
      btnEnd.disabled = true
    } else {
      if (overlay) overlay.hidden = true
      indicator.textContent = 'Your turn'
      diceEl.textContent = String(dice)
      hpEl.textContent = `${hp}/${maxHp}`
      apEl.textContent = String(ap)
      btnMove.disabled = ap < 1
      btnAttack.disabled = ap < 1
      btnDefend.disabled = ap < 1
      btnEnd.disabled = ap !== 0
    }
  }

  function startGame() {
    if (!gameState.initFromGrid(playState.getState())) {
      alert('Level has no player.')
      return
    }
    gameActive = true
    gameState.rollDice()
    updateUI()
    renderCanvas()
  }

  function onCellClick(row, col) {
    if (!gameActive || gameState.getTurn() !== 'player') return
    const playerPos = gameState.getPlayerPosition()
    if (!playerPos) return
    const gridData = playState.getState()
    const cell = gridData[row]?.[col]
    if (!cell) return

    if (clickMode === 'move') {
      if (!gameState.isAdjacent(playerPos.row, playerPos.col, row, col)) return
      if (cell.base !== 'movement' || cell.entity != null) return
      if (!gameState.spendPoints(1)) return
      gameState.movePlayer(playerPos.row, playerPos.col, row, col)
      clickMode = null
      updateUI()
      renderCanvas()
      return
    }

    if (clickMode === 'attack') {
      if (!gameState.isAdjacent(playerPos.row, playerPos.col, row, col)) return
      if (cell.entity !== 'enemy') return
      const enemy = gameState.getEnemies().find((e) => e.row === row && e.col === col)
      const maxHp = enemy?.maxHealth ?? 3
      const healthBefore = enemy?.health ?? 0
      if (!gameState.spendPoints(1)) return
      gameState.damageEnemy(row, col, 1)
      const remaining = Math.max(0, healthBefore - 1)
      showDamageIndicator(row, col, remaining, maxHp)
      clickMode = null
      updateUI()
      renderCanvas()
    }
  }

  canvas.addEventListener('click', (e) => {
    const cell = grid.getCellFromPoint(canvas, e.clientX, e.clientY)
    if (cell) onCellClick(cell.row, cell.col)
  })

  root.querySelector('#play-btn-move').addEventListener('click', () => {
    clickMode = clickMode === 'move' ? null : 'move'
    root.querySelector('#play-btn-move').classList.toggle('active', clickMode === 'move')
    root.querySelector('#play-btn-attack').classList.toggle('active', clickMode === 'attack')
  })
  root.querySelector('#play-btn-attack').addEventListener('click', () => {
    clickMode = clickMode === 'attack' ? null : 'attack'
    root.querySelector('#play-btn-attack').classList.toggle('active', clickMode === 'attack')
    root.querySelector('#play-btn-move').classList.toggle('active', clickMode === 'move')
  })
  root.querySelector('#play-btn-defend').addEventListener('click', () => {
    if (gameState.getTurn() !== 'player' || gameState.getActionPoints() < 1) return
    gameState.spendPoints(1)
    gameState.healPlayer(1)
    updateUI()
  })
  root.querySelector('#play-btn-end').addEventListener('click', () => {
    if (gameState.getTurn() !== 'player' || gameState.getActionPoints() !== 0) return
    clickMode = null
    root.querySelector('#play-btn-move').classList.remove('active')
    root.querySelector('#play-btn-attack').classList.remove('active')
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
      }, remaining)
    }, 100)
  })

  function loadLevel(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!playState.loadFromJson(data)) {
          alert('Invalid level file.')
          return
        }
        renderCanvas()
        startGame()
      } catch (_) {
        alert('Invalid level file.')
      }
    }
    reader.readAsText(file)
  }

  root.querySelector('#play-load-level').addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    if (file) {
      loadLevel(file)
      e.target.value = ''
    }
  })

  renderCanvas()
  updateUI()
  return root
}
