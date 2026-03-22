import './style.css'
import { initRouter } from './router.js'

function installMobileZoomGuard() {
  let lastTouchEnd = 0

  // iOS/WebKit gesture events used by some native webview shells.
  const preventGesture = (e) => e.preventDefault()
  document.addEventListener('gesturestart', preventGesture, { passive: false })
  document.addEventListener('gesturechange', preventGesture, { passive: false })
  document.addEventListener('gestureend', preventGesture, { passive: false })

  // Prevent pinch zoom.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false }
  )

  // Prevent double-tap zoom.
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    },
    { passive: false }
  )
}

installMobileZoomGuard()
initRouter()
