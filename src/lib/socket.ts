'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/lib/auth-store'

let socketRef: Socket | null = null

export function getSocket(): Socket | null {
  return socketRef
}

export function useSocket(events: Record<string, (payload: any) => void> = {}) {
  const { token, user } = useAuth()
  const eventsRef = useRef(events)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    if (!token) return
    // Per gateway rules: ALWAYS use relative path + XTransformPort query
    const s = io('/?XTransformPort=3003', {
      auth: { userId: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socketRef = s
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    // Register events
    Object.entries(eventsRef.current).forEach(([name, handler]) => {
      s.on(name, handler)
    })

    // Cleanup
    return () => {
      Object.keys(eventsRef.current).forEach((name) => s.off(name))
      s.disconnect()
      socketRef = null
      setConnected(false)
    }
  }, [token])

  return { socket: socketRef, connected }
}
