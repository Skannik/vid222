import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { SOCKET_EVENTS, CONNECTION_STATES, STUN_SERVERS, TURN_SERVERS } from '../constants';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const MEDIA_CONSTRAINTS = {
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

const VoiceContext = createContext();

export const useVoice = () => {
  return useContext(VoiceContext);
};

export const VoiceProvider = ({ children }) => {
  const socket = useSocket();
  const { currentUser } = useAuth();
  const [isSocketReady, setIsSocketReady] = useState(false);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.DISCONNECTED);
  const [error, setError] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [currentChannelId, setCurrentChannelId] = useState(null);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
  }, []);

  const cleanupPeerConnections = useCallback(() => {
    Object.values(peersRef.current).forEach(peer => {
      if (peer && peer.destroy) {
        peer.destroy();
      }
    });
    peersRef.current = {};
    setRemoteStreams({});
  }, []);

  const getLocalStream = useCallback(async () => {
    try {
      stopLocalStream();
      
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      localStreamRef.current = stream;
      
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOff;
      }
      
      return stream;
    } catch (err) {
      console.error('Error getting media stream:', err);
      
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: MEDIA_CONSTRAINTS.audio,
          video: false
        });
        
        localStreamRef.current = audioStream;
        setIsVideoOff(true);
        return audioStream;
      } catch (audioErr) {
        console.error('Error getting audio stream:', audioErr);
        setError('Не удалось получить доступ к микрофону');
        return null;
      }
    }
  }, [isMuted, isVideoOff, stopLocalStream]);

  const createPeer = useCallback((userId, initiator = false, stream) => {
    try {
      console.log('Creating peer connection with:', userId, 'initiator:', initiator);
      
      if (peersRef.current[userId] && peersRef.current[userId].connected) {
        console.log('Active peer connection already exists for:', userId);
        return peersRef.current[userId];
      }
      
      if (peersRef.current[userId]) {
        console.log('Cleaning up existing peer for:', userId);
        peersRef.current[userId].destroy();
        delete peersRef.current[userId];
        
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      }

      const peer = new SimplePeer({
        initiator,
        stream,
        config: {
          iceServers: [...STUN_SERVERS, ...TURN_SERVERS],
          sdpSemantics: 'unified-plan',
          iceTransportPolicy: 'all'
        },
        trickle: true,
        objectMode: true
      });

      peer.on('stream', (remoteStream) => {
        console.log('Received stream from:', userId);
        setRemoteStreams(prev => ({
          ...prev,
          [userId]: {
            stream: remoteStream,
            isMuted: false,
            isVideoOff: false
          }
        }));
      });

      peer.on('signal', (signal) => {
        console.log('Sending signal to:', userId, 'type:', signal.type);
        socket.emit('voice-signal', {
          userId,
          signal,
          isMuted,
          isVideoOff
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (peersRef.current[userId]) {
          peersRef.current[userId].destroy();
          delete peersRef.current[userId];
        }
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      });

      peer.on('close', () => {
        console.log('Peer connection closed with:', userId);
        if (peersRef.current[userId]) {
          delete peersRef.current[userId];
        }
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      });

      peer.on('connect', () => {
        console.log('Peer connection established with:', userId);
        setConnectionState(CONNECTION_STATES.CONNECTED);
      });

      peersRef.current[userId] = peer;
      return peer;
    } catch (err) {
      console.error('Error creating peer:', err);
      setError('Ошибка создания peer-соединения');
      return null;
    }
  }, [socket, isMuted, isVideoOff]);

  const handleUserJoined = useCallback(({ userId, username }) => {
    console.log('User joined voice:', username, userId);
    
    if (connectedUsers.some(user => user.userId === userId)) {
      console.log('User already connected:', username);
      return;
    }
    
    setConnectedUsers(prev => [...prev, { userId, username }]);
    
    if (localStreamRef.current) {
      const peer = createPeer(userId, true, localStreamRef.current);
      if (peer) {
        socket.emit('voice-state-update', {
          userId,
          isMuted,
          isVideoOff
        });
      }
    }
  }, [connectedUsers, createPeer, isMuted, isVideoOff, socket]);

  const handleUserLeft = useCallback(({ userId }) => {
    console.log('User left voice:', userId);
    
    if (peersRef.current[userId]) {
      peersRef.current[userId].destroy();
      delete peersRef.current[userId];
    }
    
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
    
    setConnectedUsers(prev => prev.filter(user => user.userId !== userId));
  }, []);

  const handleSignal = useCallback(async ({ userId, signal }) => {
    console.log('Received signal from:', userId, 'type:', signal.type);
    
    let peer = peersRef.current[userId];
    
    if (!peer) {
      if (localStreamRef.current) {
        peer = createPeer(userId, false, localStreamRef.current);
      } else {
        console.error('No local stream available for peer connection');
        return;
      }
    }
    
    if (peer) {
      try {
        peer.signal(signal);
      } catch (err) {
        console.error('Error handling signal:', err);
        if (localStreamRef.current) {
          peer = createPeer(userId, false, localStreamRef.current);
          peer.signal(signal);
        }
      }
    }
  }, [createPeer]);

  const joinVoiceChannel = useCallback(async (channelId) => {
    try {
      if (!socket) {
        throw new Error('Нет подключения к серверу');
      }

      if (!isSocketReady) {
        throw new Error('Подключение к серверу не готово');
      }

      if (!currentUser) {
        throw new Error('Пользователь не авторизован');
      }

      setConnectionState(CONNECTION_STATES.CONNECTING);
      setError(null);

      const stream = await getLocalStream();
      if (!stream) {
        throw new Error('Не удалось получить доступ к микрофону/камере');
      }

      socket.emit('join-voice', { 
        channelId,
        userId: currentUser.id,
        username: currentUser.username,
        hasAudio: !isMuted,
        hasVideo: !isVideoOff
      });

      setInVoiceChannel(true);
      setCurrentChannelId(channelId);
      setConnectionState(CONNECTION_STATES.CONNECTED);
      
    } catch (err) {
      console.error('Error joining voice channel:', err);
      setError(err.message || 'Ошибка подключения к голосовому каналу');
      setConnectionState(CONNECTION_STATES.FAILED);
      setInVoiceChannel(false);
      setCurrentChannelId(null);
    }
  }, [socket, isSocketReady, currentUser, getLocalStream, isMuted, isVideoOff]);

  const leaveVoiceChannel = useCallback(() => {
    if (socket && isSocketReady) {
      socket.emit('leave-voice');
    }
    stopLocalStream();
    cleanupPeerConnections();
    setInVoiceChannel(false);
    setCurrentChannelId(null);
    setConnectedUsers([]);
    setConnectionState(CONNECTION_STATES.DISCONNECTED);
  }, [socket, isSocketReady, stopLocalStream, cleanupPeerConnections]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsSocketReady(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsSocketReady(false);
      setConnectionState(CONNECTION_STATES.DISCONNECTED);
      setError('Соединение с сервером потеряно');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsSocketReady(false);
      setError('Ошибка подключения к серверу: ' + err.message);
      setConnectionState(CONNECTION_STATES.FAILED);
    });

    socket.on('voice:user_joined', handleUserJoined);
    socket.on('voice:user_left', handleUserLeft);
    socket.on('voice:signal', handleSignal);
    socket.on('voice:users_list', (users) => {
      console.log('Received users list:', users);
      setConnectedUsers(users);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('voice:user_joined');
      socket.off('voice:user_left');
      socket.off('voice:signal');
      socket.off('voice:users_list');
    };
  }, [socket, handleUserJoined, handleUserLeft, handleSignal]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuted = !isMuted;
        audioTrack.enabled = !newMuted;
        setIsMuted(newMuted);
        
        if (socket && currentChannelId) {
          socket.emit('voice-state-update', {
            hasAudio: !newMuted,
            hasVideo: !isVideoOff
          });
        }
      }
    }
  }, [isMuted, isVideoOff, socket, currentChannelId]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const newVideoOff = !isVideoOff;
        videoTrack.enabled = !newVideoOff;
        setIsVideoOff(newVideoOff);
        
        if (socket && currentChannelId) {
          socket.emit('voice-state-update', {
            hasAudio: !isMuted,
            hasVideo: !newVideoOff
          });
        }
      }
    }
  }, [isMuted, isVideoOff, socket, currentChannelId]);

  return (
    <VoiceContext.Provider value={{
      remoteStreams,
      isMuted,
      isVideoOff,
      connectionState,
      error,
      inVoiceChannel,
      connectedUsers,
      localStream: localStreamRef.current,
      isSocketReady,
      toggleMute,
      toggleVideo,
      joinVoiceChannel,
      leaveVoiceChannel
    }}>
      {children}
    </VoiceContext.Provider>
  );
};
