import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { syncEngine } from './sync/syncEngine'
import { importLegacyPatients } from './db/legacyImport'
import { onSessionChange, getSession } from './lib/authStore'

syncEngine.start()

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
