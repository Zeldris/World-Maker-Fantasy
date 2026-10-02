import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SessionProvider } from './context/SessionContext.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { AjustesProvider } from './context/AjustesProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AjustesProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </AjustesProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
