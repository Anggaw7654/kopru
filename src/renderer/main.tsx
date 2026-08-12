import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './index.css'
import { dilBaslat } from './stores/dil.js'

// Dil, ilk render'dan ÖNCE uygulanır: <html lang> ve main süreci
// doğru dille başlasın.
dilBaslat()

const container = document.getElementById('root')
if (!container) throw new Error('#root bulunamadı')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
