import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { queryClient } from './shared/query/queryClient'
import { router } from './shared/router/router'

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pickme:pwa-update-ready'))
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pickme:pwa-offline-ready'))
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
