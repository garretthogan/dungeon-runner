import { renderHome } from './views/home.js'
import { renderEditor } from './views/editor.js'
import { renderPlay } from './views/play.js'

const ROUTES = ['/', '/editor', '/play']

function getPath() {
  let path = location.pathname.replace(/\/$/, '') || '/'
  if (!ROUTES.includes(path)) path = '/'
  return path
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

export function navigate(path) {
  const normalized = path === '' || path === '/' ? '/' : path.replace(/\/$/, '')
  history.pushState({ path: normalized }, '', normalized)
  render(normalized)
}

export function initRouter() {
  window.addEventListener('popstate', (e) => {
    render(e.state?.path ?? getPath())
  })
  render(getPath())
}
