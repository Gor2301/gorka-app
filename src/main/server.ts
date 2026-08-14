import { Server } from 'socket.io';
import http from 'http';
import { getPool } from './db';

let io: Server | null = null;
let server: http.Server | null = null;

export function startServer(port: number = 3001) {
  if (server) return server;

  server = http.createServer();
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('🟢 Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('🔴 Client disconnected:', socket.id);
    });

    // Handle real-time updates
    socket.on('debtor-updated', async (data) => {
      console.log('📝 Debtor updated:', data);
      // Broadcast to all other clients
      socket.broadcast.emit('debtor-changed', data);
    });

    socket.on('action-updated', async (data) => {
      console.log('📝 Action updated:', data);
      socket.broadcast.emit('action-changed', data);
    });
  });

  server.listen(port, () => {
    console.log(`✅ WebSocket server running on port ${port}`);
  });

  return server;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call startServer() first.');
  }
  return io;
}

export function stopServer() {
  if (io) {
    io.close();
    io = null;
  }
  if (server) {
    server.close();
    server = null;
  }
}