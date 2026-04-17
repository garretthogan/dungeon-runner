import './style.css'
import { initRouter } from './router.js'

function detectWebShell() {
  const ua = navigator.userAgent || ''
  const standalone = navigator.standalone === true
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches)
  const androidWebView = / wv\)/.test(ua)
  const iosWebKitBridge = !!(window.webkit && window.webkit.messageHandlers)
  const androidJSBridge =
    typeof window.AndroidInterface !== 'undefined' ||
    typeof window.Android !== 'undefined'
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const iosInAppBrowser =
    isIOS && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)

  return (
    standalone ||
    displayModeStandalone ||
    androidWebView ||
    iosWebKitBridge ||
    androidJSBridge ||
    iosInAppBrowser
  )
}

function applyShellClass() {
  document.documentElement.classList.add(
    detectWebShell() ? 'is-webshell' : 'is-browser'
  )
}

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

applyShellClass()
installMobileZoomGuard()
initRouter()
