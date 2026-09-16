// Server-side helper to emit real-time socket events to the TalyChat
// realtime service (mini-services/chat-service on port 3003).
// Uses dynamic import of socket.io-client to avoid Turbopack compilation issues.

let socketRef: any = null
let connecting: Promise<any> | null = null

function getChatServiceUrl(): string {
  const explicit = process.env.CHAT_SERVICE_URL
  if (explicit) return explicit
  return 'http://localhost:3003'
}

export async function getRealtimeSocket(): Promise<any> {
  if (socketRef && socketRef.connected) return socketRef
  if (socketRef) return socketRef
  if (connecting) return connecting
  connecting = new Promise(async (resolve) => {
    try {
      const { io } = await import('socket.io-client')
      const s = io(getChatServiceUrl(), {
        auth: { userId: 'scheduled-bot' },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        timeout: 4000,
      })
      const openTimeout = setTimeout(() => resolve(s), 4000)
      s.on('connect', () => {
        clearTimeout(openTimeout)
        resolve(s)
      })
      s.on('connect_error', () => {
        clearTimeout(openTimeout)
        resolve(null)
      })
      socketRef = s
    } catch {
      connecting = null
      resolve(null)
    }
  })
  const result = await connecting
  connecting = null
  return result
}

export async function emitScheduledMessage(
  conversationId: string,
  message: any
): Promise<boolean> {
  try {
    const s = await getRealtimeSocket()
    if (!s) return false
    s.emit('message:send', { conversationId, message })
    return true
  } catch {
    return false
  }
}
