const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { router: authRoutes, verifyToken } = require('./routes/auth');
const channelsRoutes = require('./routes/channels');
const messagesRoutes = require('./routes/messages');
const serversRoutes = require('./routes/servers');
const usersRoutes = require('./routes/users');
const directMessageRoutes = require('./routes/directMessages');
const socketHandlers = require('./socketHandlers');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CLIENT_URL 
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Protected routes - require authentication
app.use('/api/channels', verifyToken, channelsRoutes);
app.use('/api/messages', verifyToken, messagesRoutes);
app.use('/api/servers', verifyToken, serversRoutes);
app.use('/api/users', verifyToken, usersRoutes);
app.use('/api/direct-messages', verifyToken, directMessageRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Socket handlers
socketHandlers(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
