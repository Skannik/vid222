// API URLs
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8080';

// WebRTC Configuration
export const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
];

export const TURN_SERVERS = [
    {
        urls: process.env.REACT_APP_TURN_URL || 'turn:your-turn-server.com:3478',
        username: process.env.REACT_APP_TURN_USERNAME || 'your_username',
        credential: process.env.REACT_APP_TURN_PASSWORD || 'your_password'
    }
];

// Socket Events
export const SOCKET_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    JOIN_VOICE: 'join-voice',
    LEAVE_VOICE: 'leave-voice',
    USER_JOINED: 'voice:user_joined',
    USER_LEFT: 'voice:user_left',
    SIGNAL: 'voice-signal',
    USERS_LIST: 'voice:users_list',
    STATE_UPDATE: 'voice-state-update'
};

// Connection States
export const CONNECTION_STATES = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    FAILED: 'failed'
};

// Local Storage Keys
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    USER_DATA: 'user_data'
};

// Media Constraints
export const MEDIA_CONSTRAINTS = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
    },
    video: {
        width: { min: 320, ideal: 640, max: 1280 },
        height: { min: 240, ideal: 480, max: 720 },
        frameRate: { min: 15, ideal: 24, max: 30 },
        facingMode: 'user'
    }
}; 