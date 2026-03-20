import { renderHome } from './views/home.js'
import { renderEditor } from './views/editor.js'
import { renderPlay } from './views/play.js'

const ROUTES = ['/', '/editor', '/play']

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
const BASE_PREFIX = BASE === '/' ? '' : BASE.replace(/\/$/, '')

function getPath() {
  let path = location.pathname
  if (BASE_PREFIX && path.startsWith(BASE_PREFIX)) {
    path = path.slice(BASE_PREFIX.length) || '/'
  }
  path = path.replace(/\/$/, '') || '/'
  if (!ROUTES.includes(path)) path = '/'
  return path
}

function fullPath(path) {
  return BASE_PREFIX + (path === '/' ? '' : path)
}

function render(path) {
  const app = document.querySelector('#app')
  if (!app) return
  app.innerHTML = ''
  if (path === '/') {
    const el = renderHome(navigate)
    if (el) app.appendChild(el)
  } else if (path === '/editor') {
    const el = renderEditor(navigate)
    if (el) app.appendChild(el)
  } else if (path === '/play') {
    const el = renderPlay(navigate)
    if (el) app.appendChild(el)
  }
}

export function navigate(path, options = {}) {
  const normalized = path === '' || path === '/' ? '/' : path.replace(/\/$/, '')
  const hash = options.hash ? `#${options.hash}` : ''
  const url = `${fullPath(normalized)}${hash}`
  history.pushState({ path: normalized }, '', url)
  render(normalized)
}

export function initRouter() {
  window.addEventListener('popstate', (e) => {
    render(e.state?.path ?? getPath())
  })
  render(getPath())
}
