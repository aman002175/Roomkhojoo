import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './analytics'

initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  let refreshing = false
  const authFlowOpen = () => {
    try {
      return window.location.pathname.startsWith('/verify-signup')
        || Boolean(sessionStorage.getItem('roomkhojo_signup_pending'))
    } catch {
      return window.location.pathname.startsWith('/verify-signup')
    }
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // OTP screen reload na ho — warna email app se wapas aate hi code screen band ho sakti hai.
    if (!hadController || refreshing || authFlowOpen()) return
    refreshing = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .catch((error) => console.error('Service worker registration failed', error))
  })
}
