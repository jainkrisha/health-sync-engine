import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { syncEngine } from './sync/syncEngine'
import { importLegacyPatients } from './db/legacyImport'
import { onSessionChange, getSession } from './lib/authStore'
import { registerSW } from 'virtual:pwa-register'

syncEngine.start()

// Offline app shell. A new build installs in the background and the page reloads
// onto it; open tabs also check for one every minute.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 60_000)
  },
})

// One-time import of records saved by the Phase A version of the app.
if (getSession()) void importLegacyPatients()
onSessionChange((s) => {
  if (s) void importLegacyPatients()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
