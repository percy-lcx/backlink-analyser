import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Dashboard from './App.tsx'
import { ProfileProvider } from './components/ProfileContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProfileProvider>
      <Dashboard />
    </ProfileProvider>
  </StrictMode>,
)
