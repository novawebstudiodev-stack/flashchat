import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// userId (string) → socketId (string)
export const onlineUsers = new Map();

// Set after initSocket — used by controllers to emit
export let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId   = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection ────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    onlineUsers.set(userId, socket.id);

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      socketId: socket.id,
    });

    // Tell everyone this user is online
    socket.broadcast.emit('user:online', { userId });

    // Send the caller the current online users list
    socket.emit('online:list', { userIds: [...onlineUsers.keys()] });

    // ── Typing ──────────────────────────────────────────────
    socket.on('typing:start', ({ receiverId }) => {
      const sid = onlineUsers.get(receiverId);
      if (sid) io.to(sid).emit('typing:start', { senderId: userId });
    });

    socket.on('typing:stop', ({ receiverId }) => {
      const sid = onlineUsers.get(receiverId);
      if (sid) io.to(sid).emit('typing:stop', { senderId: userId });
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        socketId: null,
        lastSeen,
      });
      socket.broadcast.emit('user:offline', { userId, lastSeen });
    });
  });

  return io;
};

// Helper — emit to a specific user by their userId
export const emitToUser = (userId, event, data) => {
  const sid = onlineUsers.get(userId.toString());
  if (sid && io) io.to(sid).emit(event, data);
};
