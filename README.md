# VidTalk - Discord Clone

VidTalk is a functional Discord clone with real-time chat, voice communication, and server management capabilities. It's built as a local application that doesn't require any third-party services or internet connectivity.

## Features

### User Authentication
- Registration and login with secure password hashing
- Session management using localStorage
- User profiles with avatars and status indicators

### Servers (Guilds)
- Create and delete servers
- Invite users via unique invite codes
- User role management (owner, member)

### Channels
- Text and voice channels
- Channel creation, deletion, and renaming
- Server structure sidebar

### Chat
- Real-time messaging using Socket.IO
- Message history with user info and timestamps
- Stored message history

### Voice Communication
- WebRTC-based audio chat
- Voice channel joining/leaving
- Microphone muting
- Connected users display

### Direct Messages
- Private messaging between users
- Unread message notifications
- Direct message history

## Technology Stack

### Frontend
- React.js
- HTML5 & CSS3 (no frameworks)
- React Router
- WebRTC (for audio)
- Socket.IO (for real-time communication)

### Backend
- Node.js with Express
- Socket.IO server
- WebRTC signaling
- JWT authentication

### Database
- SQLite (local database)

## Installation

1. Make sure you have Node.js (v14 or higher) installed on your system.



2. Install dependencies for the root project, server, and client:
   ```
   npm run install-deps
   ```

## Running the Application

To start both the client and server with a single command:

```
npm run dev
```

This will start:
- The backend server on http://localhost:5000
- The React frontend on http://localhost:3000

## Usage Instructions

1. Register a new account or login with existing credentials
2. Create a new server or join an existing one with an invite code
3. Create text and voice channels in your server
4. Start chatting in text channels or join voice channels for audio communication
5. Send direct messages to other users

## Development

- Server code is in the `/server` directory
- Client code is in the `/client` directory
- The application uses a local SQLite database stored in `/server/database`

Ы
#   v i d t a l k  
 #   v i d  
 