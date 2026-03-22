import * as playState from '../play/playState.js'
import * as gameState from '../play/gameState.js'
import * as grid from '../editor/grid.js'
import { CELL_SIZE } from '../editor/grid.js'
import { runOpponentTurn } from '../play/opponentAI.js'
import { getReachableCells, getNextStepToward } from '../play/pathfinding.js'

const DAMAGE_INDICATOR_MS = 1200
const MOVE_ANIMATION_MS = 170
const LONGBOW_BEAM_MS = 240
const LONGBOW_TRAIL_FRACTION = 0.2
const GRID_ROWS = 16
const GRID_COLS = 9
const ACTION_SLOT_COUNT = 4
const CARD_REWARD_INTERVAL_WINS = 3

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
const TUTORIAL_MANIFEST_URL = `${baseUrl}tutorial-seeds-manifest.json`
const ACTION_CARD_MANIFEST_URL = `${baseUrl}action-cards-manifest.json`

function hashStringToUint32(input) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function createSeededRandom(seedValue) {
  let t = hashStringToUint32(seedValue) || 1
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function parseHashParams() {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  if (!raw) return new URLSearchParams()
  const params = new URLSearchParams(raw)
  if ([...params.keys()].length > 0) return params
  const legacySeed = decodeURIComponent(raw).trim()
  const legacyParams = new URLSearchParams()
  if (legacySeed) legacyParams.set('seed', legacySeed)
  return legacyParams
}

function generateSeedKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

function setHashParams(params) {
  const hash = params.toString()
  const suffix = hash ? `#${hash}` : ''
  const url = `${window.location.pathname}${window.location.search}${suffix}`
  history.replaceState(history.state, '', url)
}

async function loadTutorialSeeds() {
  const response = await fetch(TUTORIAL_MANIFEST_URL, { cache: 'no-cache' })
  if (!response.ok) throw new Error('Could not load tutorial seed manifest.')
  const data = await response.json()
  if (!Array.isArray(data?.seeds)) throw new Error('Tutorial manifest is missing seeds.')
  const seeds = data.seeds.map((seed) => `${seed}`.trim()).filter(Boolean)
  if (seeds.length === 0) throw new Error('Tutorial seed list is empty.')
  return seeds
}

function resolveCardIconPath(iconPath) {
  const raw = `${iconPath || ''}`.trim()
  if (!raw) return `${baseUrl}energy-icon.svg`
  if (raw.startsWith('/') || raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${baseUrl}${raw}`
}

async function loadActionCardManifest() {
  const response = await fetch(ACTION_CARD_MANIFEST_URL, { cache: 'no-cache' })
  if (!response.ok) throw new Error('Could not load action cards manifest.')
  const data = await response.json()
  if (!Array.isArray(data?.cards)) throw new Error('Action cards manifest is missing cards.')

  const cards = data.cards
    .map((card) => ({
      id: `${card?.id || ''}`.trim(),
      name: `${card?.name || ''}`.trim(),
      icon: resolveCardIconPath(card?.icon),
      cost: Number(card?.cost),
    }))
    .filter((card) => card.id && card.name && Number.isFinite(card.cost) && card.cost > 0)

  if (cards.length === 0) throw new Error('Action cards list is empty.')
  return { cards }
}

export function renderPlay(navigate) {
  const GAME_OVER_SUBTITLES = [
    'better luck next time chump',
    'do better..get good..',
    'fatality',
    'maybe try not to die?',
    'such a loser',
    'you suck again',
    'well well well.. not surprised',
    'abc 123.. you suck',
    'hahahaha',
    'jajajaja',
    'oops you, did it again',
    'your soul is mine',
    "this game isn't even that hard..",
    'a.i. will take over the world',
    "that's what you said",
    'you snooze you lose',
    "you lost loser mc'loser",
    'dang those dots really got ya huh',
    'please not again',
    'please try and do better next time',
    'sucks to suck buttercup',
    'maybe one day..',
  ]
  let gameActive = false
  let lastLevelData = null
  let endlessLevel = 1
  let completedPuzzles = 0
  let hasPlayerMovedThisPuzzle = false
  const selectedActionCards = []
  let pendingRewardCard = null
  let actionCardOptions = []
  let activeActionCardIndex = -1
  let moveAnimations = []
  let moveAnimationProgress = 1
  let moveAnimationFrameId = 0
  let longbowBeamAnimation = null
  let longbowBeamFrameId = 0
  const supportsHaptics =
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    ((typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches))
  const hashParams = parseHashParams()
  const mode = hashParams.get('mode') === 'tutorial' ? 'tutorial' : 'endless'
  let tutorialSeeds = []
  let tutorialSeedIndex = Math.max(0, Number.parseInt(hashParams.get('tutorialSeed') || '0', 10) || 0)
  let seedKey = (hashParams.get('seed') || '').trim()
  if (!seedKey) {
    seedKey = generateSeedKey()
  }
  hashParams.set('seed', seedKey)
  if (mode !== 'tutorial') {
    hashParams.delete('tutorialSeed')
    hashParams.delete('mode')
  }
  setHashParams(hashParams)

  const root = document.createElement('div')
  root.className = 'view view-play'

  root.innerHTML = `
    <header class="play-header">
      <div class="play-header-spacer"></div>
      <h1 class="play-title">
        <img src="${baseUrl}DR-Logo.png" alt="Dungeon Runner" class="app-logo" />
      </h1>
      <div class="play-settings-wrap">
        <button type="button" class="play-gear" aria-label="Settings" aria-expanded="false" aria-haspopup="menu" id="play-gear"><img src="${baseUrl}settings-icon.png" alt="" class="play-gear-icon" aria-hidden="true" /></button>
        <div class="play-settings-menu" id="play-settings-menu" role="menu" hidden>
          <a href="/" class="play-settings-menu-item nav-link" data-path="/" role="menuitem">← Back</a>
        </div>
      </div>
    </header>
    <div class="play-stage-wrap">
      <div class="play-stage-inner">
        <div class="canvas-wrap play-canvas-wrap">
          <canvas class="puzzle-canvas" id="play-canvas"></canvas>
          <div class="play-puzzle-counter" id="play-puzzle-counter" aria-label="Current puzzle">Puzzle 1</div>
        </div>
        <div class="play-bottom-bar">
          <div class="play-dice-column">
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
              <div class="play-extra-dice" id="play-extra-dice" aria-label="Bonus dice"></div>
            </div>
            <div class="play-hearts" id="play-hearts" aria-label="Player hit points"></div>
          </div>
          <div class="play-actions" role="toolbar" aria-label="Action card slots">
            ${Array.from(
              { length: ACTION_SLOT_COUNT },
              (_, idx) => `<div class="play-action-slot" data-slot-index="${idx}" aria-label="Empty action slot"></div>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="play-card-modal-backdrop" id="play-card-modal-backdrop" hidden>
      <div class="play-card-modal" role="dialog" aria-modal="true" aria-labelledby="play-card-modal-title">
        <h2 class="play-card-modal-title" id="play-card-modal-title">Choose an action card</h2>
        <p class="play-card-modal-subtitle">Pick one reward card.</p>
        <div class="play-card-choice-list" id="play-card-choice-list"></div>
      </div>
    </div>
    <div class="play-game-over-backdrop" id="play-game-over-backdrop" hidden>
      <div class="play-game-over-message">
        <img src="${baseUrl}GameOver.svg" alt="Game Over" class="play-game-over-image" />
        <p class="play-game-over-subtitle">get good...</p>
      </div>
      <p class="play-game-over-level" id="play-game-over-level">YOU MADE IT TO LEVEL: 1</p>
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
  canvas.style.setProperty('--play-grid-aspect', `${GRID_COLS} / ${GRID_ROWS}`)
  const existingCanvas = canvasWrap.querySelector('canvas#play-canvas')
  if (existingCanvas) existingCanvas.replaceWith(canvas)
  else canvasWrap.prepend(canvas)
  const cardModalBackdrop = root.querySelector('#play-card-modal-backdrop')
  const cardChoiceList = root.querySelector('#play-card-choice-list')
  const gameOverBackdrop = root.querySelector('#play-game-over-backdrop')
  const gameOverSubtitleEl = root.querySelector('.play-game-over-subtitle')
  const actionSlotsWrap = root.querySelector('.play-actions')

  function initializeRandomActionCards() {
    selectedActionCards.length = 0
    const shuffled = shuffle(actionCardOptions)
    for (let i = 0; i < shuffled.length && selectedActionCards.length < ACTION_SLOT_COUNT; i++) {
      selectedActionCards.push({ ...shuffled[i] })
    }
    if (pendingRewardCard && selectedActionCards.length > 0) {
      const replaceIdx = randomInt(0, selectedActionCards.length - 1)
      selectedActionCards[replaceIdx] = { ...pendingRewardCard }
      pendingRewardCard = null
    }
    activeActionCardIndex = -1
    renderActionSlots()
    renderCanvas()
  }

  function hideGameOverModal() {
    if (gameOverBackdrop) gameOverBackdrop.hidden = true
  }

  function showGameOverModal() {
    if (gameOverSubtitleEl && GAME_OVER_SUBTITLES.length > 0) {
      const subtitleIndex = Math.floor(Math.random() * GAME_OVER_SUBTITLES.length)
      gameOverSubtitleEl.textContent = GAME_OVER_SUBTITLES[subtitleIndex]
    }
    const gameOverLevelEl = root.querySelector('#play-game-over-level')
    if (gameOverLevelEl) {
      const reachedLevel = Math.max(1, completedPuzzles + 1)
      gameOverLevelEl.textContent = `YOU MADE IT TO LEVEL: ${reachedLevel}`
    }
    if (gameOverBackdrop) gameOverBackdrop.hidden = false
  }

  function getActiveActionCard() {
    if (activeActionCardIndex < 0) return null
    return selectedActionCards[activeActionCardIndex] ?? null
  }

  function hasEnoughEnergyForCard(card) {
    return gameState.getActionPoints() >= (card?.cost ?? Number.MAX_SAFE_INTEGER)
  }

  function isKnightMove(fromRow, fromCol, toRow, toCol) {
    const rowDelta = Math.abs(toRow - fromRow)
    const colDelta = Math.abs(toCol - fromCol)
    return (rowDelta === 2 && colDelta === 1) || (rowDelta === 1 && colDelta === 2)
  }

  function isActionLandingCell(cell) {
    if (!cell || cell.base !== 'movement') return false
    return cell.entity == null || isAttackableEntity(cell.entity) || cell.entity === 'exit'
  }

  function getKnightActionTargets(state, playerPos) {
    if (!playerPos) return []
    const offsets = [
      { dr: -2, dc: -1 },
      { dr: -2, dc: 1 },
      { dr: -1, dc: -2 },
      { dr: -1, dc: 2 },
      { dr: 1, dc: -2 },
      { dr: 1, dc: 2 },
      { dr: 2, dc: -1 },
      { dr: 2, dc: 1 },
    ]
    const cells = []
    for (const { dr, dc } of offsets) {
      const row = playerPos.row + dr
      const col = playerPos.col + dc
      if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) continue
      const targetCell = state[row]?.[col]
      if (!isActionLandingCell(targetCell)) continue
      cells.push({
        row,
        col,
        path: getKnightPathCells(playerPos.row, playerPos.col, row, col),
      })
    }
    return cells
  }

  function getKnightPathCells(fromRow, fromCol, toRow, toCol) {
    if (!isKnightMove(fromRow, fromCol, toRow, toCol)) return []
    const rowDelta = toRow - fromRow
    const colDelta = toCol - fromCol
    if (Math.abs(rowDelta) === 2) {
      const stepRow = Math.sign(rowDelta)
      return [
        { row: fromRow + stepRow, col: fromCol },
        { row: fromRow + stepRow * 2, col: fromCol },
        { row: toRow, col: toCol },
      ]
    }
    const stepCol = Math.sign(colDelta)
    return [
      { row: fromRow, col: fromCol + stepCol },
      { row: fromRow, col: fromCol + stepCol * 2 },
      { row: toRow, col: toCol },
    ]
  }

  function getSlidingActionTargets(state, playerPos, directions) {
    if (!playerPos) return []
    const targets = []
    for (const [dr, dc] of directions) {
      const pathCells = []
      let row = playerPos.row + dr
      let col = playerPos.col + dc
      while (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        const cell = state[row]?.[col]
        if (!cell || cell.base !== 'movement') break
        pathCells.push({ row, col })
        if (cell.entity == null) {
          targets.push({ row, col, path: [...pathCells] })
          row += dr
          col += dc
          continue
        }
        if (isAttackableEntity(cell.entity) || cell.entity === 'exit') {
          targets.push({ row, col, path: [...pathCells] })
        }
        break
      }
    }
    return targets
  }

  function getLongbowActionTargets(state, playerPos) {
    if (!playerPos) return []
    const targets = []
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]
    for (const [dr, dc] of directions) {
      const pathCells = []
      for (let step = 1; step <= 5; step++) {
        const row = playerPos.row + dr * step
        const col = playerPos.col + dc * step
        if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) break
        const cell = state[row]?.[col]
        if (!cell || cell.base !== 'movement') break
        pathCells.push({ row, col })
        if (cell.entity == null) continue
        if (isAttackableEntity(cell.entity)) {
          targets.push({ row, col, path: [...pathCells] })
        }
        // Any entity blocks line of sight beyond this point.
        break
      }
    }
    return targets
  }

  function getActionTargetsByCard(cardId, state, playerPos) {
    if (cardId === 'knight') return getKnightActionTargets(state, playerPos)
    if (cardId === 'rook') {
      return getSlidingActionTargets(state, playerPos, [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
    }
    if (cardId === 'queen') {
      return getSlidingActionTargets(state, playerPos, [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ])
    }
    if (cardId === 'longbow') return getLongbowActionTargets(state, playerPos)
    return []
  }

  function getActionPreviewCells(cardId, state, playerPos) {
    const targets = getActionTargetsByCard(cardId, state, playerPos)
    const deduped = new Map()
    for (const target of targets) {
      for (const cell of target.path || []) {
        deduped.set(cellKey(cell.row, cell.col), cell)
      }
    }
    return [...deduped.values()]
  }

  function clearActiveActionCard() {
    if (activeActionCardIndex < 0) return
    activeActionCardIndex = -1
    renderActionSlots()
  }

  function consumeActiveActionCard() {
    if (activeActionCardIndex < 0) return
    consumeCardAtIndex(activeActionCardIndex)
  }

  function consumeCardAtIndex(slotIdx) {
    if (slotIdx < 0 || slotIdx >= selectedActionCards.length) return
    const consumedCard = selectedActionCards[slotIdx]
    const replacementPool = actionCardOptions.filter((card) => card?.id && card.id !== consumedCard?.id)
    const fallbackPool = actionCardOptions.filter((card) => card?.id)
    const pickFrom = replacementPool.length > 0 ? replacementPool : fallbackPool
    if (pickFrom.length > 0) {
      const picked = pickFrom[randomInt(0, pickFrom.length - 1)]
      selectedActionCards[slotIdx] = { ...picked }
    } else {
      selectedActionCards.splice(slotIdx, 1)
    }
    if (activeActionCardIndex === slotIdx) {
      activeActionCardIndex = -1
    }
    renderActionSlots()
  }

  function castInstantCard(slotIdx) {
    const card = selectedActionCards[slotIdx]
    if (!card || (card.id !== 'freeze' && card.id !== 'renew' && card.id !== 'shockwave' && card.id !== 'extraroll')) return false
    if (!hasEnoughEnergyForCard(card)) return false
    if (!gameState.spendPoints(card.cost)) return false
    if (card.id === 'freeze') {
      gameState.freezeOpponentsForTurns(1)
    } else if (card.id === 'renew') {
      gameState.healPlayer(gameState.getPlayerMaxHealth())
    } else if (card.id === 'shockwave') {
      applyShockwaveFromPlayer()
    } else if (card.id === 'extraroll') {
      gameState.addExtraRoll()
    }
    consumeCardAtIndex(slotIdx)
    startMoveAnimationsFromGameState()
    updateUI()
    renderCanvas()
    return true
  }

  function applyShockwaveFromPlayer() {
    const playerPos = gameState.getPlayerPosition()
    if (!playerPos) return
    const state = playState.getState()
    const units = []
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const entity = state[row]?.[col]?.entity
        if (entity === 'enemy' || entity === 'collectible') {
          const distance = Math.abs(row - playerPos.row) + Math.abs(col - playerPos.col)
          units.push({ row, col, entity, distance })
        }
      }
    }
    units.sort((a, b) => b.distance - a.distance)
    for (const unit of units) {
      pushUnitAwayFromPlayer(unit, playerPos)
    }
  }

  function pushUnitAwayFromPlayer(unit, playerPos) {
    const rowStep = Math.sign(unit.row - playerPos.row)
    const colStep = Math.sign(unit.col - playerPos.col)
    if (rowStep === 0 && colStep === 0) return

    let curRow = unit.row
    let curCol = unit.col
    for (let i = 0; i < 2; i++) {
      const nextRow = curRow + rowStep
      const nextCol = curCol + colStep
      if (nextRow < 0 || nextRow >= GRID_ROWS || nextCol < 0 || nextCol >= GRID_COLS) break
      const nextCell = playState.getState()[nextRow]?.[nextCol]
      if (!nextCell || nextCell.base !== 'movement' || nextCell.entity != null) break

      if (unit.entity === 'enemy') {
        if (!gameState.moveEnemy(curRow, curCol, nextRow, nextCol)) break
      } else {
        if (!gameState.moveCollectible(curRow, curCol, nextRow, nextCol)) break
      }
      curRow = nextRow
      curCol = nextCol
    }
  }

  function activateCard(slotIdx) {
    const card = selectedActionCards[slotIdx]
    if (!card || !gameActive || gameState.getTurn() !== 'player') return
    if (card.id === 'freeze' || card.id === 'renew' || card.id === 'shockwave' || card.id === 'extraroll') {
      castInstantCard(slotIdx)
      return
    }
    if (!['knight', 'rook', 'queen', 'longbow'].includes(card.id)) return
    if (slotIdx === activeActionCardIndex) {
      clearActiveActionCard()
      renderCanvas()
      return
    }
    if (!hasEnoughEnergyForCard(card)) return
    activeActionCardIndex = slotIdx
    renderActionSlots()
    updateUI()
    renderCanvas()
  }

  function renderActionSlots() {
    const slots = root.querySelectorAll('.play-action-slot')
    slots.forEach((slot, idx) => {
      const card = selectedActionCards[idx]
      slot.classList.toggle('play-action-slot-filled', Boolean(card))
      slot.classList.toggle('play-action-slot-active', idx === activeActionCardIndex)
      slot.classList.toggle('play-action-slot-available', Boolean(card) && hasEnoughEnergyForCard(card))
      if (!card) {
        slot.innerHTML = ''
        slot.setAttribute('aria-label', 'Empty action slot')
        return
      }
      const isActive = idx === activeActionCardIndex
      const energyState = hasEnoughEnergyForCard(card) ? 'ready' : 'not enough energy'
      slot.setAttribute(
        'aria-label',
        `${card.name} card, costs ${card.cost} energy, ${isActive ? 'active' : energyState}`
      )
      slot.innerHTML = `
        <div class="play-action-card">
          ${renderCardIconMarkup(card, 'slot')}
          <div class="play-action-card-name">${card.name}</div>
          <div class="play-action-card-cost">
            <span>${card.cost}</span>
          </div>
        </div>
      `
    })
  }

  if (actionSlotsWrap) {
    actionSlotsWrap.addEventListener('click', (e) => {
      const slot = e.target.closest('[data-slot-index]')
      if (!slot) return
      const slotIdx = Number.parseInt(slot.getAttribute('data-slot-index') || '', 10)
      if (!Number.isInteger(slotIdx)) return
      activateCard(slotIdx)
    })
  }
  if (gameOverBackdrop) {
    gameOverBackdrop.addEventListener('click', () => {
      if (!lastLevelData) {
        navigate('/')
        return
      }
      hideGameOverModal()
      playState.loadFromJson(lastLevelData)
      renderCanvas()
      startGame()
    })
  }

  function showCardChoiceModal() {
    if (!cardModalBackdrop || !cardChoiceList) return Promise.resolve()
    cardChoiceList.innerHTML = actionCardOptions.map(
      (card) => `
        <button type="button" class="play-card-choice-btn" data-card-id="${card.id}">
          ${renderCardIconMarkup(card, 'choice')}
          <div class="play-card-choice-name">${card.name}</div>
          <div class="play-card-choice-cost">
            <span>${card.cost}</span>
          </div>
        </button>
      `
    ).join('')
    cardModalBackdrop.hidden = false
    return new Promise((resolve) => {
      const onClick = (e) => {
        const btn = e.target.closest('[data-card-id]')
        if (!btn) return
        const picked = actionCardOptions.find((card) => card.id === btn.getAttribute('data-card-id'))
        if (picked) {
          pendingRewardCard = { ...picked }
        }
        cardChoiceList.removeEventListener('click', onClick)
        cardModalBackdrop.hidden = true
        resolve()
      }
      cardChoiceList.addEventListener('click', onClick)
    })
  }

  function renderCardIconMarkup(card, variant) {
    if (card.id !== 'extraroll') {
      const klass = variant === 'choice' ? 'play-card-choice-icon' : 'play-action-card-icon'
      return `<img src="${card.icon}" alt="" class="${klass}" aria-hidden="true" />`
    }
    const variantClass = variant === 'choice' ? 'play-card-dice-icon-choice' : 'play-card-dice-icon-slot'
    return `
      <div class="play-card-dice-icon play-card-dice-icon-extraroll ${variantClass} play-dice" data-value="6" aria-hidden="true">
        <span class="play-dice-pip pip-1 show" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-2" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-3 show" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-4 show" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-5" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-6 show" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-7 show" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-8" aria-hidden="true">●</span>
        <span class="play-dice-pip pip-9 show" aria-hidden="true">●</span>
      </div>
    `
  }

  async function maybeAwardCardAfterPuzzle() {
    if (completedPuzzles === 0 || completedPuzzles % CARD_REWARD_INTERVAL_WINS !== 0) return
    await showCardChoiceModal()
  }

  function randomInt(min, max, randomFn = Math.random) {
    return Math.floor(randomFn() * (max - min + 1)) + min
  }

  function shuffle(items, randomFn = Math.random) {
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1))
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
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue
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

  function getObstacleTargetCount(levelNumber) {
    const totalCells = GRID_ROWS * GRID_COLS
    const clampedLevel = Math.max(1, levelNumber)
    // Increase obstacle density as player progresses.
    const targetDensity = Math.min(0.52, 0.09 + (clampedLevel - 1) * 0.015)
    const minObstacles = 8
    const maxObstacles = totalCells - 26
    const desiredCount = Math.floor(totalCells * targetDensity)
    return Math.max(minObstacles, Math.min(maxObstacles, desiredCount))
  }

  function createEndlessLevel(levelNumber, sourceSeed) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const randomFn = createSeededRandom(`${sourceSeed}:${levelNumber}:${attempt}`)
      const gridData = Array.from({ length: GRID_ROWS }, () =>
        Array.from({ length: GRID_COLS }, () => ({ base: 'movement', entity: null }))
      )

      const allCells = []
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          allCells.push({ row, col })
        }
      }

      const borderPair = randomInt(0, 1, randomFn)
      let playerCell
      let exitCell
      if (borderPair === 0) {
        // Opposite vertical borders: top <-> bottom.
        const exitOnTop = randomInt(0, 1, randomFn) === 0
        const exitCol = randomInt(0, GRID_COLS - 1, randomFn)
        const playerCol = randomInt(0, GRID_COLS - 1, randomFn)
        exitCell = { row: exitOnTop ? 0 : GRID_ROWS - 1, col: exitCol }
        playerCell = { row: exitOnTop ? GRID_ROWS - 1 : 0, col: playerCol }
      } else {
        // Opposite horizontal borders: left <-> right.
        const exitOnLeft = randomInt(0, 1, randomFn) === 0
        const exitRow = randomInt(0, GRID_ROWS - 1, randomFn)
        const playerRow = randomInt(0, GRID_ROWS - 1, randomFn)
        exitCell = { row: exitRow, col: exitOnLeft ? 0 : GRID_COLS - 1 }
        playerCell = { row: playerRow, col: exitOnLeft ? GRID_COLS - 1 : 0 }
      }

      const reserved = new Set([cellKey(playerCell.row, playerCell.col), cellKey(exitCell.row, exitCell.col)])
      const obstacleCount = getObstacleTargetCount(levelNumber)
      let placedObstacles = 0
      for (const c of shuffle(allCells, randomFn)) {
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
          if (!(cell.base === 'movement' && cell.entity == null)) return false
          const distToPlayer = Math.abs(c.row - playerCell.row) + Math.abs(c.col - playerCell.col)
          // Never spawn enemies adjacent to the player.
          return distToPlayer > 1
        }),
        randomFn
      )

      const targetRedByLevel = 1 + Math.floor(Math.max(0, levelNumber - 1) / 4)
      const redCount = Math.min(3, Math.max(1, targetRedByLevel), Math.floor(freeCells.length / 3))
      const purpleCount = redCount * 2
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
        dimensions: { rows: GRID_ROWS, cols: GRID_COLS },
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
    const levelData = createEndlessLevel(levelNumber, seedKey)
    if (!levelData) return false
    return startLevelData(levelData)
  }

  function startTutorialLevel(index) {
    const selectedSeed = tutorialSeeds[index]
    if (!selectedSeed) return false
    tutorialSeedIndex = index
    seedKey = selectedSeed
    hashParams.set('mode', 'tutorial')
    hashParams.set('tutorialSeed', String(tutorialSeedIndex))
    hashParams.set('seed', seedKey)
    setHashParams(hashParams)
    const levelData = createEndlessLevel(1, seedKey)
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

  function advanceTutorialMode() {
    const nextIndex = tutorialSeedIndex + 1
    if (nextIndex >= tutorialSeeds.length) {
      gameActive = false
      updateUI()
      alert('Tutorial complete! You cleared all 5 puzzles.')
      navigate('/')
      return
    }
    const ok = startTutorialLevel(nextIndex)
    if (!ok) {
      gameActive = false
      updateUI()
      alert('Could not generate the next tutorial level.')
    }
  }

  function renderCanvas() {
    const state = playState.getState()
    let renderState = state
    let highlightCells = []
    if (gameActive && gameState.getTurn() === 'player') {
      const playerPos = gameState.getPlayerPosition()
      if (playerPos) {
        const activeCard = getActiveActionCard()
        if (activeCard?.id && hasEnoughEnergyForCard(activeCard)) {
          highlightCells = getActionPreviewCells(activeCard.id, state, playerPos)
        } else if (gameState.getActionPoints() >= 1) {
          highlightCells = getReachableCells(
            state,
            playerPos.row,
            playerPos.col,
            gameState.getActionPoints()
          )
        }
      }
    }
    if (moveAnimations.length > 0) {
      renderState = state.map((row) => row.map((cell) => ({ ...cell })))
      for (const anim of moveAnimations) {
        const destCell = renderState[anim.toRow]?.[anim.toCol]
        if (destCell) destCell.entity = null
      }
    }

    grid.render(canvas, renderState, {
      highlightCells,
      showExitLabel: !hasPlayerMovedThisPuzzle,
    })

    if (moveAnimations.length > 0) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      for (const anim of moveAnimations) {
        const t = moveAnimationProgress
        const x = (anim.fromCol + (anim.toCol - anim.fromCol) * t + 0.5) * CELL_SIZE
        const y = (anim.fromRow + (anim.toRow - anim.fromRow) * t + 0.5) * CELL_SIZE
        let color = '#8EFDB0'
        let radius = CELL_SIZE / 3
        if (anim.entity === 'enemy') {
          color = '#FF92AC'
          radius = CELL_SIZE / 3.2
        } else if (anim.entity === 'collectible') {
          color = '#CE8FFF'
          radius = CELL_SIZE / 3.2
        }
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (longbowBeamAnimation) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const t = Math.max(0, Math.min(1, longbowBeamAnimation.progress))
      const fromX = (longbowBeamAnimation.fromCol + 0.5) * CELL_SIZE
      const fromY = (longbowBeamAnimation.fromRow + 0.5) * CELL_SIZE
      const toX = (longbowBeamAnimation.toCol + 0.5) * CELL_SIZE
      const toY = (longbowBeamAnimation.toRow + 0.5) * CELL_SIZE
      const dx = toX - fromX
      const dy = toY - fromY
      const headT = t
      const tailT = Math.max(0, headT - LONGBOW_TRAIL_FRACTION)
      const x1 = fromX + dx * tailT
      const y1 = fromY + dy * tailT
      const x2 = fromX + dx * headT
      const y2 = fromY + dy * headT
      const alpha = Math.max(0.35, 1 - t * 0.6)
      ctx.save()
      ctx.strokeStyle = `rgba(142, 253, 176, ${0.85 * alpha})`
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.shadowColor = `rgba(142, 253, 176, ${0.7 * alpha})`
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.restore()
    }
  }

  function startLongbowBeamAnimation(fromRow, fromCol, toRow, toCol) {
    if (longbowBeamFrameId) {
      cancelAnimationFrame(longbowBeamFrameId)
      longbowBeamFrameId = 0
    }
    longbowBeamAnimation = {
      fromRow,
      fromCol,
      toRow,
      toCol,
      progress: 0,
    }
    const startTs = performance.now()
    const step = (now) => {
      const elapsed = now - startTs
      if (!longbowBeamAnimation) return
      longbowBeamAnimation.progress = Math.min(1, elapsed / LONGBOW_BEAM_MS)
      renderCanvas()
      if (longbowBeamAnimation.progress < 1) {
        longbowBeamFrameId = requestAnimationFrame(step)
      } else {
        longbowBeamAnimation = null
        longbowBeamFrameId = 0
        renderCanvas()
      }
    }
    longbowBeamFrameId = requestAnimationFrame(step)
  }

  function startMoveAnimationsFromGameState() {
    const events = gameState.consumeMoveEvents()
    if (events.length === 0) return
    if (moveAnimationFrameId) {
      cancelAnimationFrame(moveAnimationFrameId)
      moveAnimationFrameId = 0
    }
    moveAnimations = events
      .filter((e) => e.fromRow !== e.toRow || e.fromCol !== e.toCol)
      .map((e) => ({ ...e }))
    if (moveAnimations.length === 0) return
    moveAnimationProgress = 0
    const startTs = performance.now()
    const step = (now) => {
      const elapsed = now - startTs
      moveAnimationProgress = Math.min(1, elapsed / MOVE_ANIMATION_MS)
      renderCanvas()
      if (moveAnimationProgress < 1) {
        moveAnimationFrameId = requestAnimationFrame(step)
      } else {
        moveAnimations = []
        moveAnimationProgress = 1
        moveAnimationFrameId = 0
        renderCanvas()
      }
    }
    moveAnimationFrameId = requestAnimationFrame(step)
  }

  function triggerHaptic(type) {
    if (!supportsHaptics) return
    if (type === 'attack') {
      navigator.vibrate([14, 26, 18])
      return
    }
    if (type === 'move') {
      navigator.vibrate(12)
    }
  }

  function setDiePips(diceEl, rolledValue, remainingValue) {
    if (!diceEl) return
    const pipMap = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
    const clampedRoll = Math.max(0, Math.min(6, rolledValue))
    const rolledPips = pipMap[clampedRoll] || []
    const visiblePips = rolledPips.slice(0, Math.min(Math.max(0, remainingValue), rolledPips.length))
    diceEl.setAttribute('data-value', String(clampedRoll))
    for (let i = 1; i <= 9; i++) {
      const pip = diceEl.querySelector(`.pip-${i}`)
      if (pip) pip.classList.toggle('show', visiblePips.includes(i))
    }
  }

  function createBonusDieElement() {
    const die = document.createElement('div')
    die.className = 'play-dice play-dice-bonus'
    die.setAttribute('role', 'img')
    die.setAttribute('aria-hidden', 'true')
    die.innerHTML = `
      <span class="play-dice-pip pip-1" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-2" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-3" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-4" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-5" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-6" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-7" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-8" aria-hidden="true">●</span>
      <span class="play-dice-pip pip-9" aria-hidden="true">●</span>
    `
    return die
  }

  function showDamageIndicator(row, col, remaining, maxHealth) {
    const wrap = root.querySelector('.play-canvas-wrap')
    if (!wrap) return
    const el = document.createElement('div')
    el.className = 'play-damage-indicator'
    el.textContent = `${remaining}/${maxHealth}`
    const gridPx = GRID_ROWS * CELL_SIZE
    el.style.left = `${((col + 0.5) / GRID_COLS) * 100}%`
    el.style.top = `${((row * CELL_SIZE - 6) / gridPx) * 100}%`
    wrap.appendChild(el)
    setTimeout(() => {
      el.classList.add('play-damage-indicator-fade')
      setTimeout(() => el.remove(), 300)
    }, DAMAGE_INDICATOR_MS)
  }

  function updateUI() {
    const diceEl = root.querySelector('#play-dice')
    const extraDiceEl = root.querySelector('#play-extra-dice')
    const tapBtn = root.querySelector('#play-dice-tap')
    const puzzleCounterEl = root.querySelector('#play-puzzle-counter')
    if (puzzleCounterEl) {
      const puzzleNumber = Math.max(1, completedPuzzles + 1)
      puzzleCounterEl.textContent = `Puzzle ${puzzleNumber}`
      puzzleCounterEl.setAttribute('aria-label', `Current puzzle ${puzzleNumber}`)
    }

    if (!gameActive) {
      if (tapBtn) tapBtn.classList.remove('play-dice-tap-visible')
      if (diceEl) {
        const defaultRoll = 1 + Math.floor(Math.random() * 6)
        setDiePips(diceEl, defaultRoll, defaultRoll)
        diceEl.setAttribute('aria-label', `Dice showing ${defaultRoll}`)
      }
      if (extraDiceEl) extraDiceEl.innerHTML = ''
      const heartsEl = root.querySelector('#play-hearts')
      if (heartsEl) {
        const count = 3
        let html = ''
        for (let i = 0; i < count; i++) {
          html += `<img src="${baseUrl}heart-icon.svg" alt="" class="play-heart" aria-hidden="true" />`
        }
        heartsEl.innerHTML = html
        heartsEl.setAttribute('aria-label', `${count} of ${count} hit points`)
      }
      return
    }

    const turn = gameState.getTurn()
    const ap = gameState.getActionPoints()
    const hp = gameState.getPlayerHealth()
    const maxHp = gameState.getPlayerMaxHealth()

    const heartsEl = root.querySelector('#play-hearts')
    if (heartsEl) {
      const heartIconCount = Math.max(1, maxHp)
      let html = ''
      for (let i = 0; i < heartIconCount; i++) {
        const filled = i < hp
        const src = filled ? `${baseUrl}heart-icon.svg` : `${baseUrl}heart-icon-outline.svg`
        html += `<img src="${src}" alt="" class="play-heart" aria-hidden="true" />`
      }
      heartsEl.innerHTML = html
      heartsEl.setAttribute('aria-label', `${hp} of ${maxHp} hit points`)
    }
    const dicePools = gameState.getDicePools()
    if (diceEl) {
      const basePool = dicePools[0] || { roll: 0, remaining: 0 }
      diceEl.classList.toggle('play-dice-compact', dicePools.length > 1)
      setDiePips(diceEl, basePool.roll, basePool.remaining)
      diceEl.setAttribute('aria-label', `Dice showing ${ap} remaining action points`)
    }
    if (extraDiceEl) {
      extraDiceEl.innerHTML = ''
      for (const pool of dicePools.slice(1)) {
        const die = createBonusDieElement()
        setDiePips(die, pool.roll, pool.remaining)
        extraDiceEl.appendChild(die)
      }
    }
    if (turn === 'opponent') {
      if (tapBtn) tapBtn.classList.remove('play-dice-tap-visible')
    } else {
      const needsRoll = gameState.getActionPoints() === 0
      if (tapBtn) tapBtn.classList.toggle('play-dice-tap-visible', needsRoll)
    }
  }

  function startGame() {
    if (!gameState.initFromGrid(playState.getState())) {
      alert('Level has no player.')
      return
    }
    hideGameOverModal()
    initializeRandomActionCards()
    hasPlayerMovedThisPuzzle = false
    gameActive = true
    updateUI()
    renderCanvas()
  }

  function endPlayerTurnNow() {
    if (!gameActive || gameState.getTurn() !== 'player') return
    clearActiveActionCard()
    gameState.endPlayerTurn()
    runOpponentTurn()
    startMoveAnimationsFromGameState()
    updateUI()
    renderCanvas()
    if (gameState.getPlayerHealth() <= 0) {
      gameActive = false
      updateUI()
      showGameOverModal()
    }
  }

  function endTurnAfterPlayerAction() {
    if (!gameActive || gameState.getTurn() !== 'player') return
    clearActiveActionCard()
    setTimeout(endPlayerTurnNow, 150)
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
      triggerHaptic('attack')
      return true
    }
    if (entity === 'collectible') {
      // Purple-dot enemies are currently represented as collectible entities in level data.
      playState.setCell(row, col, { entity: null })
      showDamageIndicator(row, col, 0, 1)
      triggerHaptic('attack')
      return true
    }
    return false
  }

  function executeActionCardMove(row, col, cell, playerPos) {
    if (!isActionLandingCell(cell)) return false
    if (cell.entity === 'enemy') {
      const enemy = gameState.getEnemies().find((e) => e.row === row && e.col === col)
      const maxHp = enemy?.maxHealth ?? 1
      gameState.damageEnemy(row, col, Number.MAX_SAFE_INTEGER)
      gameState.movePlayer(playerPos.row, playerPos.col, row, col)
      startMoveAnimationsFromGameState()
      hasPlayerMovedThisPuzzle = true
      showDamageIndicator(row, col, 0, maxHp)
      triggerHaptic('attack')
      return 'action'
    }
    if (cell.entity === 'collectible') {
      playState.setCell(row, col, { entity: null })
      gameState.movePlayer(playerPos.row, playerPos.col, row, col)
      startMoveAnimationsFromGameState()
      hasPlayerMovedThisPuzzle = true
      showDamageIndicator(row, col, 0, 1)
      triggerHaptic('attack')
      return 'action'
    }
    if (cell.entity === 'exit') {
      gameState.movePlayer(playerPos.row, playerPos.col, row, col)
      startMoveAnimationsFromGameState()
      hasPlayerMovedThisPuzzle = true
      triggerHaptic('move')
      return 'exit'
    }
    if (cell.entity == null) {
      gameState.movePlayer(playerPos.row, playerPos.col, row, col)
      startMoveAnimationsFromGameState()
      hasPlayerMovedThisPuzzle = true
      triggerHaptic('move')
      return 'action'
    }
    return false
  }

  function executeLongbowAction(row, col, cell, playerPos) {
    if (!isAttackableEntity(cell?.entity)) return false
    startLongbowBeamAnimation(playerPos.row, playerPos.col, row, col)
    if (cell.entity === 'enemy') {
      const enemy = gameState.getEnemies().find((e) => e.row === row && e.col === col)
      const maxHp = enemy?.maxHealth ?? 1
      gameState.damageEnemy(row, col, Number.MAX_SAFE_INTEGER)
      showDamageIndicator(row, col, 0, maxHp)
      triggerHaptic('attack')
      return 'action'
    }
    if (cell.entity === 'collectible') {
      playState.setCell(row, col, { entity: null })
      showDamageIndicator(row, col, 0, 1)
      triggerHaptic('attack')
      return 'action'
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
    const activeCard = getActiveActionCard()

    if (activeCard?.id) {
      if (!hasEnoughEnergyForCard(activeCard)) return
      const targets = getActionTargetsByCard(activeCard.id, gridData, playerPos)
      const canReachTarget = targets.some((target) => target.row === row && target.col === col)
      if (!canReachTarget) return
      if (!gameState.spendPoints(activeCard.cost)) return
      const actionResult =
        activeCard.id === 'longbow'
          ? executeLongbowAction(row, col, cell, playerPos)
          : executeActionCardMove(row, col, cell, playerPos)
      if (!actionResult) return
      consumeActiveActionCard()
      updateUI()
      renderCanvas()
      if (actionResult === 'exit') {
        completedPuzzles += 1
        maybeAwardCardAfterPuzzle().then(() => {
          if (mode === 'tutorial') {
            advanceTutorialMode()
          } else {
            advanceEndlessMode()
          }
        })
        return
      }
      endTurnAfterPlayerAction()
      return
    }

    if (
      ap >= 1 &&
      gameState.isAdjacent(playerPos.row, playerPos.col, row, col) &&
      isAttackableEntity(cell.entity)
    ) {
      const attacked = attackTarget(row, col, cell.entity)
      if (!attacked) return
      updateUI()
      renderCanvas()
      endTurnAfterPlayerAction()
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
          startMoveAnimationsFromGameState()
          hasPlayerMovedThisPuzzle = true
          triggerHaptic('move')
          updateUI()
          renderCanvas()
          if (movedToExit) {
            completedPuzzles += 1
            maybeAwardCardAfterPuzzle().then(() => {
              if (mode === 'tutorial') {
                advanceTutorialMode()
              } else {
                advanceEndlessMode()
              }
            })
          } else {
            endTurnAfterPlayerAction()
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
        alert('Invalid level file: need a 16×9 grid with a player cell.')
        return
      }
      lastLevelData = data
      clearActiveActionCard()
      renderCanvas()
      startGame()
    }
    reader.onerror = () => alert('Could not read file.')
    reader.readAsText(file)
  }

  async function initializeMode() {
    try {
      const manifest = await loadActionCardManifest()
      actionCardOptions = manifest.cards
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load action cards.'
      alert(message)
      navigate('/')
      return
    }

    if (mode === 'tutorial') {
      try {
        tutorialSeeds = await loadTutorialSeeds()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load tutorial seeds.'
        alert(message)
        navigate('/')
        return
      }
      if (tutorialSeedIndex >= tutorialSeeds.length) tutorialSeedIndex = 0
      const ok = startTutorialLevel(tutorialSeedIndex)
      if (!ok) {
        alert('Could not generate tutorial level.')
        navigate('/')
      }
      return
    }
    if (!startEndlessLevel(endlessLevel)) {
      alert('Could not generate endless level.')
    }
  }

  root.querySelector('#play-dice-tap').addEventListener('click', () => {
    if (!gameActive || gameState.getTurn() !== 'player' || gameState.getActionPoints() > 0) return
    gameState.rollDice()
    root.querySelector('#play-dice-tap').classList.remove('play-dice-tap-visible')
    updateUI()
    renderCanvas()
  })

  renderCanvas()
  renderActionSlots()
  updateUI()
  initializeMode()
  return root
}
