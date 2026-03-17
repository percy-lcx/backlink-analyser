import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import Dashboard from './App.tsx'
import { ProfileProvider } from './components/ProfileContext.tsx'
import { BlocklistProvider } from './components/BlocklistContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <BlocklistProvider>
          <Dashboard />
        </BlocklistProvider>
      </ProfileProvider>
    </BrowserRouter>
  </StrictMode>,
)
