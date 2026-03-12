import * as puzzleState from '../editor/puzzleState.js'
import * as grid from '../editor/grid.js'

const TOOLS = [
  { id: 'movement', label: 'Movement' },
  { id: 'obstacle', label: 'Obstacle' },
  { id: 'player', label: 'Player start' },
  { id: 'enemy', label: 'Enemy start' },
  { id: 'exit', label: 'Exit' },
  { id: 'collectible', label: 'Collectible' },
  { id: 'eraser', label: 'Eraser' },
]

export function renderEditor(navigate) {
  let currentTool = 'movement'
  const root = document.createElement('div')
  root.className = 'view view-editor'

  root.innerHTML = `
    <header class="editor-header">
      <a href="/" class="nav-link back-link" data-path="/">← Back</a>
      <h1 class="editor-title">DUNGEON RUNNER</h1>
    </header>
    <div class="tool-palette" role="toolbar">
      ${TOOLS.map(
        (t) =>
          `<button type="button" class="tool-btn" data-tool="${t.id}" title="${t.label}">${t.label}</button>`
      ).join('')}
    </div>
    <div class="editor-actions">
      <button type="button" class="action-btn" id="export-level">Export level</button>
      <label class="action-btn action-btn-import">
        Import level
        <input type="file" accept=".json,application/json" id="import-level-input" hidden />
      </label>
    </div>
    <div class="canvas-wrap"></div>
  `

  const backLink = root.querySelector('[data-path="/"]')
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault()
      navigate('/')
    })
  }

  const canvasWrap = root.querySelector('.canvas-wrap')
  const canvas = grid.createCanvas()
  canvasWrap.appendChild(canvas)
  grid.render(canvas, puzzleState.getState())

  function setActiveTool(toolId) {
    currentTool = toolId
    root.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolId)
    })
  }

  function applyTool(row, col) {
    const cell = puzzleState.getState()[row][col]
    if (currentTool === 'movement') {
      puzzleState.setCell(row, col, { base: 'movement', entity: cell.entity })
    } else if (currentTool === 'obstacle') {
      puzzleState.setCell(row, col, { base: 'obstacle', entity: null })
    } else if (currentTool === 'player') {
      puzzleState.clearEntity('player')
      puzzleState.setCell(row, col, { base: 'movement', entity: 'player' })
    } else if (currentTool === 'exit') {
      puzzleState.clearEntity('exit')
      puzzleState.setCell(row, col, { base: 'movement', entity: 'exit' })
    } else if (currentTool === 'enemy') {
      puzzleState.setCell(row, col, { base: 'movement', entity: 'enemy' })
    } else if (currentTool === 'collectible') {
      puzzleState.setCell(row, col, { base: 'movement', entity: 'collectible' })
    } else if (currentTool === 'eraser') {
      puzzleState.setCell(row, col, { base: 'movement', entity: null })
    }
    grid.render(canvas, puzzleState.getState())
  }

  root.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool))
  })

  canvas.addEventListener('click', (e) => {
    const cell = grid.getCellFromPoint(canvas, e.clientX, e.clientY)
    if (cell) applyTool(cell.row, cell.col)
  })

  function exportLevel() {
    const state = puzzleState.getState()
    const payload = {
      version: 1,
      name: 'Untitled level',
      dimensions: { rows: 8, cols: 8 },
      createdAt: new Date().toISOString(),
      grid: state.map((row) =>
        row.map((cell) => ({ base: cell.base, entity: cell.entity }))
      ),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dungeon-level-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function importLevel(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const rows = data?.dimensions?.rows ?? data?.grid?.length
        const cols = data?.dimensions?.cols ?? data?.grid?.[0]?.length
        const gridData = data?.grid
        if (!gridData || !puzzleState.loadState(rows, cols, gridData)) {
          alert('Invalid level file.')
          return
        }
        grid.render(canvas, puzzleState.getState())
      } catch (_) {
        alert('Invalid level file.')
      }
    }
    reader.readAsText(file)
  }

  root.querySelector('#export-level').addEventListener('click', exportLevel)
  root.querySelector('#import-level-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    if (file) {
      importLevel(file)
      e.target.value = ''
    }
  })

  setActiveTool(currentTool)
  return root
}
