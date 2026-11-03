import { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'

export function SpikeApp() {
  const [health, setHealth] = useState('pending')
  const [status, setStatus] = useState('disconnected')
  const [events, setEvents] = useState<string[]>([])
  const path = window.location.pathname

  useEffect(() => {
    const ac = new AbortController()
    axios.get('/api/health', { signal: ac.signal }).then((r) => setHealth(JSON.stringify(r.data)))
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL, { transports: ['websocket'], auth: { token: 'tok-alice' } })
    const log = (e: string) => setEvents((xs) => [...xs, e])
    socket.on('connect', () => { setStatus('connected'); socket.emit('ping.app') })
    socket.on('disconnect', (reason) => setStatus(`disconnected:${reason}`))
    socket.on('pong.app', () => log('pong.app'))
    socket.on('nft.updated', (p: unknown) => log(`nft.updated ${JSON.stringify(p)}`))
    return () => { socket.removeAllListeners(); socket.disconnect() }
  }, [])

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold">Spike</h1>
      <p>path: <span data-testid="path">{path}</span></p>
      <p>health: <span data-testid="health">{health}</span></p>
      <p>socket: <span data-testid="socket">{status}</span></p>
      <button className="border px-2" onClick={() => axios.post('/api/spike/price-change')}>trigger</button>
      <ul data-testid="events">{events.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </main>
  )
}
