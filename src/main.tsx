import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import App from './App.tsx'
// Punto de entrada principal de la aplicación React; renderiza el componente App dentro del StrictMode.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
