import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/iron.css'   // visual identity; must load after index.css

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
