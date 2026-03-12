export function renderHome(navigate) {
  const root = document.createElement('div')
  root.className = 'view view-home'
  root.innerHTML = `
    <h1>DUNGEON RUNNER</h1>
    <p class="home-blurb">Design and play puzzle dungeons.</p>
    <div class="home-links">
      <a href="/play" class="nav-link" data-path="/play">Play</a>
      <a href="/editor" class="nav-link" data-path="/editor">Editor</a>
    </div>
  `
  root.querySelectorAll('[data-path]').forEach((link) => {
    const path = link.getAttribute('data-path')
    if (path) {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        navigate(path)
      })
    }
  })
  return root
}
