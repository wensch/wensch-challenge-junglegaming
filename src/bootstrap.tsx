import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpikeApp } from './SpikeApp'

export function bootstrap(el: HTMLElement) {
  createRoot(el).render(
    <StrictMode>
      <SpikeApp />
    </StrictMode>,
  )
}
