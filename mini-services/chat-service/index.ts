// TalyChat Realtime Service — Socket.io mini-service
// Port: 3003
// Caddy gateway forwards /?XTransformPort=3003 to here

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, service: 'talychat-realtime', port: PORT }))
})

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io',
})

// In-memory presence + rooms
const userSockets = new Map<string, Set<string>>() // userId -> socket ids
const conversationRooms = new Map<string, Set<string>>() // conversationId -> userIds

io.use((socket, next) => {
  // Auth via handshake — userId passed in auth payload
  const userId = socket.handshake.auth?.userId as string | undefined
  if (!userId) {
    return next(new Error('userId required'))
  }
  ;(socket as any).userId = userId
  next()
})

io.on('connection', (socket) => {
  const userId = (socket as any).userId as string

  // Track socket by user
  if (!userSockets.has(userId)) userSockets.set(userId, new Set())
  userSockets.get(userId)!.add(socket.id)

  // Notify user's friends that they're online
  io.emit('presence', { userId, isOnline: true })

  // ---------- Join conversation room ----------
  socket.on('join:conversation', ({ conversationId }: { conversationId: string }) => {
    socket.join(`conv:${conversationId}`)
    if (!conversationRooms.has(conversationId)) {
      conversationRooms.set(conversationId, new Set())
    }
    conversationRooms.get(conversationId)!.add(userId)
    // Broadcast presence update within conversation
    socket.to(`conv:${conversationId}`).emit('presence', { userId, isOnline: true })
  })

  // ---------- Leave conversation room ----------
  socket.on('leave:conversation', ({ conversationId }: { conversationId: string }) => {
    socket.leave(`conv:${conversationId}`)
    const room = conversationRooms.get(conversationId)
    if (room) {
      room.delete(userId)
      if (room.size === 0) conversationRooms.delete(conversationId)
    }
    socket.to(`conv:${conversationId}`).emit('presence', { userId, isOnline: false })
  })

  // ---------- New message relay ----------
  socket.on(
    'message:send',
    (payload: {
      conversationId: string
      message: any
    }) => {
      // Broadcast to all conversation members (including sender for confirmation)
      io.to(`conv:${payload.conversationId}`).emit('message:new', {
        conversationId: payload.conversationId,
        message: payload.message,
      })
    }
  )

  // ---------- Typing indicator ----------
  socket.on(
    'typing',
    (payload: { conversationId: string; isTyping: boolean; username?: string }) => {
      socket.to(`conv:${payload.conversationId}`).emit('typing', {
        userId,
        isTyping: payload.isTyping,
        username: payload.username,
      })
    }
  )

  // ---------- Reaction broadcast ----------
  socket.on(
    'reaction',
    (payload: { conversationId: string; messageId: string; emoji: string; userId: string }) => {
      socket.to(`conv:${payload.conversationId}`).emit('reaction', payload)
    }
  )

  // ---------- Read receipt ----------
  socket.on(
    'message:status',
    (payload: { conversationId: string; messageId: string; userId: string; seen: boolean }) => {
      socket.to(`conv:${payload.conversationId}`).emit('message:status', payload)
    }
  )

  // ---------- Message edit / delete ----------
  socket.on(
    'message:edit',
    (payload: { conversationId: string; messageId: string; content: string }) => {
      socket.to(`conv:${payload.conversationId}`).emit('message:edit', payload)
    }
  )

  socket.on(
    'message:delete',
    (payload: { conversationId: string; messageId: string }) => {
      socket.to(`conv:${payload.conversationId}`).emit('message:delete', payload)
    }
  )

  // ---------- Disconnect ----------
  socket.on('disconnect', () => {
    const set = userSockets.get(userId)
    if (set) {
      set.delete(socket.id)
      if (set.size === 0) {
        userSockets.delete(userId)
        io.emit('presence', { userId, isOnline: false })
      }
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`[TalyChat Realtime] listening on port ${PORT}`)
})
