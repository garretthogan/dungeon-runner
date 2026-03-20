const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

export function renderHome(navigate) {
  const root = document.createElement('div')
  root.className = 'view view-home'
  root.innerHTML = `
    <h1 class="app-logo-wrap"><img src="${baseUrl}DR-Logo.png" alt="Dungeon Runner" class="app-logo" /></h1>
    <div class="home-links">
      <a href="/play" class="nav-link" data-path="/play">Play</a>
      <a href="/play#mode=tutorial" class="nav-link" data-path="/play" data-hash="mode=tutorial">Tutorial</a>
      <a href="/editor" class="nav-link" data-path="/editor">Editor</a>
    </div>
  `
  root.querySelectorAll('[data-path]').forEach((link) => {
    const path = link.getAttribute('data-path')
    const hash = link.getAttribute('data-hash')
    if (path) {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        navigate(path, { hash })
      })
    }
  })
  return root
}
