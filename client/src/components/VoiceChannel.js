import React, { useEffect, useRef } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import '../styles/VoiceChannel.css';

const DEFAULT_AVATAR = '/images/avatar1.svg';

const VoiceChannel = ({ channelId }) => {
  const { 
    remoteStreams,
    connectedUsers,
    localStream, 
    isMuted, 
    isVideoOff, 
    toggleMute, 
    toggleVideo,
    joinVoiceChannel,
    leaveVoiceChannel
  } = useVoice();
  
  const videoRefs = useRef({});

  useEffect(() => {
    if (channelId) {
      joinVoiceChannel(channelId);
      return () => leaveVoiceChannel();
    }
  }, [channelId, joinVoiceChannel, leaveVoiceChannel]);

  useEffect(() => {
    // Обновляем видео элементы при изменении стримов
    Object.entries(remoteStreams).forEach(([userId, { stream }]) => {
      if (stream && videoRefs.current[userId]) {
        videoRefs.current[userId].srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const getAvatarUrl = (userId) => {
    // Если userId не определен, возвращаем дефолтный аватар
    if (!userId) return DEFAULT_AVATAR;
    
    // Здесь можно добавить логику получения аватара по userId
    // Пока возвращаем дефолтный аватар
    return DEFAULT_AVATAR;
  };

  const renderParticipant = (user) => {
    if (!user || !user.userId) return null;

    const remoteStream = remoteStreams[user.userId];
    const hasVideo = remoteStream && remoteStream.stream && remoteStream.stream.getVideoTracks().length > 0;
    const isSpeaking = false; // TODO: Добавить определение говорящего
  
  return (
      <div key={user.userId} className={`participant ${isSpeaking ? 'speaking' : ''}`}>
        <div className="video-container">
          {hasVideo ? (
              <video
              ref={el => { videoRefs.current[user.userId] = el; }}
                autoPlay
                playsInline
              muted={user.isMuted}
              />
            ) : (
            <img
              src={getAvatarUrl(user.userId)}
              alt={user.username}
              className="avatar"
            />
          )}
              </div>
        <div className="participant-info">
          <span className="username">{user.username}</span>
          <div className="controls">
            {user.isMuted && (
              <img src="/images/mute-icon.svg" alt="Muted" className="control-icon" />
            )}
            {!hasVideo && (
              <img src="/images/video-off-icon.svg" alt="Video Off" className="control-icon" />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLocalParticipant = () => {
    if (!localStream) return null;

    return (
      <div className="participant local">
        <div className="video-container">
          {!isVideoOff && localStream.getVideoTracks().length > 0 ? (
            <video
              ref={el => {
                if (el) el.srcObject = localStream;
              }}
              autoPlay
              playsInline
              muted
            />
          ) : (
            <img
              src={DEFAULT_AVATAR}
              alt="You"
              className="avatar"
            />
          )}
            </div>
        <div className="participant-info">
          <span className="username">You</span>
          <div className="controls">
            <button 
              onClick={toggleMute} 
              className="control-button"
              data-active={isMuted}
            >
              <img
                src={isMuted ? '/images/mute-icon.svg' : '/images/unmute-icon.svg'}
                alt={isMuted ? 'Unmute' : 'Mute'}
                className="control-icon"
              />
            </button>
            <button 
              onClick={toggleVideo} 
              className="control-button"
              data-active={isVideoOff}
            >
              <img
                src={isVideoOff ? '/images/video-off-icon.svg' : '/images/video-on-icon.svg'}
                alt={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                className="control-icon"
              />
            </button>
            <button onClick={leaveVoiceChannel} className="control-button leave-button">
              <img
                src="/images/leave-call-icon.svg"
                alt="Leave Channel"
                className="control-icon"
              />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="voice-channel">
      <div className="participants-grid">
        {renderLocalParticipant()}
        {connectedUsers.map(user => renderParticipant(user))}
      </div>
    </div>
  );
};

export default VoiceChannel;
