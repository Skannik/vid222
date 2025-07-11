// API URL
const DEFAULT_API_URL = 'http://localhost:5000';
export const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://vidtalk-server.onrender.com'
  : DEFAULT_API_URL;

export const SOCKET_EVENTS = {
  JOIN_VOICE: 'join-voice',
  LEAVE_VOICE: 'leave-voice',
  USER_JOINED_VOICE: 'user-joined-voice',
  USER_LEFT_VOICE: 'user-left-voice',
  VOICE_SIGNAL: 'voice-signal',
  VOICE_STATE_UPDATE: 'voice-state-update'
};

export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  FAILED: 'failed'
};

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

export const TURN_SERVERS = [
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302'
    ]
  }
]; 