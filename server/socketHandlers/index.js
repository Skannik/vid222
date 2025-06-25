const { db } = require('../database');
const jwt = require('jsonwebtoken');

// Store active connections
const activeConnections = new Map();
const socketToUser = new Map();
const userToSocket = new Map();
const channelConnections = new Map();

const handleVoiceEvents = (io, socket) => {
  // Присоединение к голосовому каналу
  socket.on('join-voice', async ({ channelId, hasAudio = true, hasVideo = false }) => {
    try {
      const { id: userId, username } = socket.user;
      console.log(`User ${username} (${userId}) joining voice channel ${channelId}`);
      
      // Добавляем пользователя в комнату голосового канала
      socket.join(`voice:${channelId}`);
      
      // Сохраняем информацию о медиа-состоянии пользователя
      socket.voiceState = {
        channelId,
        userId,
        username,
        hasAudio,
        hasVideo
      };
      
      // Получаем список текущих пользователей в канале
      const clients = await io.in(`voice:${channelId}`).allSockets();
      const connectedUsers = [];
      
      for (const clientId of clients) {
        const client = io.sockets.sockets.get(clientId);
        if (client && client.voiceState && client.voiceState.userId !== userId) {
          connectedUsers.push({
            userId: client.voiceState.userId,
            username: client.voiceState.username,
            hasAudio: client.voiceState.hasAudio,
            hasVideo: client.voiceState.hasVideo
          });
        }
      }
      
      // Отправляем новому участнику список текущих пользователей
      socket.emit('voice:users_list', connectedUsers);
      
      // Оповещаем всех в канале о новом участнике
      socket.to(`voice:${channelId}`).emit('voice:user_joined', {
        userId,
        username,
        hasAudio,
        hasVideo
      });
      
      console.log(`Sent users list to ${username}:`, connectedUsers);
      console.log(`Notified others about ${username} joining`);
      
    } catch (err) {
      console.error('Error in join-voice:', err);
      socket.emit('error', { message: 'Failed to join voice channel' });
    }
  });

  // Выход из голосового канала
  socket.on('leave-voice', () => {
    try {
      if (socket.voiceState) {
        const { channelId, userId, username } = socket.voiceState;
        console.log(`User ${username} (${userId}) leaving voice channel ${channelId}`);
        
        // Оповещаем всех в канале об уходе участника
        socket.to(`voice:${channelId}`).emit('voice:user_left', { userId });
        
        // Покидаем комнату
        socket.leave(`voice:${channelId}`);
        delete socket.voiceState;
      }
    } catch (err) {
      console.error('Error in leave-voice:', err);
    }
  });

  // WebRTC сигналинг
  socket.on('voice-signal', ({ userId, signal }) => {
    try {
      if (!socket.voiceState) {
        console.error('No voice state for signal from:', socket.user.username);
        return;
      }

      const { channelId } = socket.voiceState;
      console.log(`Signal from ${socket.user.username} to ${userId} in channel ${channelId}`);
      
      // Находим сокет целевого пользователя в том же канале
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.voiceState && 
              s.voiceState.channelId === channelId && 
              s.voiceState.userId === userId);
      
      if (targetSocket) {
        // Пересылаем сигнал
        targetSocket.emit('voice:signal', {
          userId: socket.voiceState.userId,
          signal
        });
        console.log('Signal forwarded successfully');
      } else {
        console.error('Target user not found in channel:', userId);
      }
    } catch (err) {
      console.error('Error in voice-signal:', err);
    }
  });

  // Изменение состояния микрофона/видео
  socket.on('voice-state-update', ({ hasAudio, hasVideo }) => {
    try {
      if (socket.voiceState) {
        const { channelId, userId } = socket.voiceState;
        socket.voiceState.hasAudio = hasAudio;
        socket.voiceState.hasVideo = hasVideo;
        
        // Оповещаем всех в канале
        socket.to(`voice:${channelId}`).emit('voice:state_update', {
          userId,
          hasAudio,
          hasVideo
        });
      }
    } catch (err) {
      console.error('Error in voice-state-update:', err);
    }
  });

  // Очистка при отключении
  socket.on('disconnect', () => {
    try {
      if (socket.voiceState) {
        const { channelId, userId } = socket.voiceState;
        
        // Оповещаем всех в канале об уходе участника
        socket.to(`voice:${channelId}`).emit('voice:user_left', { userId });
        
        delete socket.voiceState;
      }
    } catch (err) {
      console.error('Error in disconnect handler:', err);
    }
  });
};

module.exports = (io) => {
  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SECRET_KEY');
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Ensure direct_message_contacts table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS direct_message_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, contact_id)
    )
  `);
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.user.id})`);
    
    // Store the connection
    socketToUser.set(socket.id, socket.user.id);
    userToSocket.set(socket.user.id, socket.id);
    
    // Update user status to online
    db.run('UPDATE users SET status = ? WHERE id = ?', ['online', socket.user.id]);
    
    // Emit to all clients that user is online
    socket.broadcast.emit('user:status', { userId: socket.user.id, status: 'online' });
    
    // Join user to their private room for direct messages
    socket.join(`user:${socket.user.id}`);
    
    // Handle joining server rooms
    socket.on('server:join', (serverId) => {
      socket.join(`server:${serverId}`);
      console.log(`${socket.user.username} joined server room: ${serverId}`);
    });
    
    // Handle leaving server rooms
    socket.on('server:leave', (serverId) => {
      socket.leave(`server:${serverId}`);
      console.log(`${socket.user.username} left server room: ${serverId}`);
    });
    
    // Handle joining channel rooms
    socket.on('channel:join', (channelId) => {
      socket.join(`channel:${channelId}`);
      console.log(`${socket.user.username} joined channel: ${channelId}`);
      
      // For voice channels, track connection for WebRTC signaling
      db.get('SELECT * FROM channels WHERE id = ?', [channelId], (err, channel) => {
        if (err || !channel) return;
        
        if (channel.type === 'voice') {
          // Add to voice channel connections
          if (!channelConnections.has(channelId)) {
            channelConnections.set(channelId, new Set());
          }
          
          channelConnections.get(channelId).add(socket.user.id);
          
          // Notify others in the voice channel
          socket.to(`channel:${channelId}`).emit('voice:user_joined', {
            userId: socket.user.id,
            username: socket.user.username
          });
          
          // Send already connected users to the newly joined user
          const connectedUsers = Array.from(channelConnections.get(channelId))
            .filter(id => id !== socket.user.id);
          
          if (connectedUsers.length > 0) {
            // Get user details for each connected user
            const userIds = connectedUsers.join('","');
            db.all(`SELECT id, username, avatar FROM users WHERE id IN ("${userIds}")`, (err, users) => {
              if (err) return;
              
              socket.emit('voice:connected_users', users);
            });
          }
          
          // Store voice connection in database
          db.run(
            'INSERT OR REPLACE INTO voice_connections (id, channel_id, user_id, muted) VALUES (?, ?, ?, ?)',
            [`${socket.user.id}-${channelId}`, channelId, socket.user.id, false]
          );
        }
      });
    });
    
    handleVoiceEvents(io, socket);
    
    // Handle leaving channel rooms
    socket.on('channel:leave', (channelId) => {
      socket.leave(`channel:${channelId}`);
      console.log(`${socket.user.username} left channel: ${channelId}`);
      
      // For voice channels, update connections
      db.get('SELECT * FROM channels WHERE id = ?', [channelId], (err, channel) => {
        if (err || !channel) return;
        
        if (channel.type === 'voice') {
          if (channelConnections.has(channelId)) {
            channelConnections.get(channelId).delete(socket.user.id);
            
            if (channelConnections.get(channelId).size === 0) {
              channelConnections.delete(channelId);
            }
          }
          
          // Notify others that user left voice channel
          socket.to(`channel:${channelId}`).emit('voice:user_left', {
            userId: socket.user.id,
            username: socket.user.username
          });
          
          // Remove voice connection from database
          db.run('DELETE FROM voice_connections WHERE channel_id = ? AND user_id = ?', [channelId, socket.user.id]);
        }
      });
    });
    
    // Handle new channel messages
    socket.on('message:channel', (data) => {
      const { channelId, content } = data;
      
      if (!channelId || !content) return;
      
      // Broadcast the message to the channel
      socket.to(`channel:${channelId}`).emit('message:channel', {
        id: data.id,
        channelId,
        senderId: socket.user.id,
        senderName: socket.user.username,
        content,
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle direct messages
    socket.on('message:direct', (data) => {
      const { receiverId, content } = data;
      
      if (!receiverId || !content) return;
      
      // Create a message object
      const message = {
        id: data.id,
        sender_id: socket.user.id,
        receiver_id: receiverId,
        content,
        username: socket.user.username,
        created_at: new Date().toISOString(),
        read: 0
      };
      
      // Send to the specific user's room
      io.to(`user:${receiverId}`).emit('direct_message', message);
      
      // Also send back to the sender to keep UI in sync
      socket.emit('direct_message', message);
    });
    
    // Handle direct message typing indicators
    socket.on('direct:typing:start', (data) => {
      const { userId } = data;
      
      if (!userId) return;
      
      io.to(`user:${userId}`).emit('direct:typing:start', {
        userId: socket.user.id,
        username: socket.user.username
      });
    });
    
    socket.on('direct:typing:stop', (data) => {
      const { userId } = data;
      
      if (!userId) return;
      
      io.to(`user:${userId}`).emit('direct:typing:stop', {
        userId: socket.user.id
      });
    });
    
    // Handle direct chat join
    socket.on('direct:join', (userId) => {
      console.log(`${socket.user.username} started direct chat with user ID: ${userId}`);
      // Update last interaction with this user for better contacts sorting
      db.run(
        'INSERT OR IGNORE INTO direct_message_contacts (user_id, contact_id, last_interaction) VALUES (?, ?, ?)',
        [socket.user.id, userId, new Date().toISOString()],
        (err) => {
          if (err) console.error('Error updating contact interaction:', err);
        }
      );
    });
    
    // WebRTC signaling
    socket.on('signal', (data) => {
      const { userId, signal } = data;
      
      if (!userId || !signal) return;
      
      // Forward the signal to the specific user
      if (userToSocket.has(userId)) {
        const targetSocket = userToSocket.get(userId);
        io.to(targetSocket).emit('signal', {
          userId: socket.user.id,
          signal
        });
      }
    });
    
    // Handle mute status change
    socket.on('voice:mute', (data) => {
      const { channelId, muted } = data;
      
      if (!channelId) return;
      
      // Update mute status in database
      db.run(
        'UPDATE voice_connections SET muted = ? WHERE channel_id = ? AND user_id = ?',
        [muted ? 1 : 0, channelId, socket.user.id]
      );
      
      // Broadcast mute status change to channel
      socket.to(`channel:${channelId}`).emit('voice:mute', {
        userId: socket.user.id,
        muted
      });
    });
    
    // Handle typing indicator
    socket.on('typing:start', (data) => {
      const { channelId } = data;
      
      if (!channelId) return;
      
      socket.to(`channel:${channelId}`).emit('typing:start', {
        userId: socket.user.id,
        username: socket.user.username
      });
    });
    
    socket.on('typing:stop', (data) => {
      const { channelId } = data;
      
      if (!channelId) return;
      
      socket.to(`channel:${channelId}`).emit('typing:stop', {
        userId: socket.user.id
      });
    });
  });
};
