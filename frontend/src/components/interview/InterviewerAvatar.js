import React, { useMemo } from 'react';
import LiveInterviewerVisual from './LiveInterviewerVisual';
import './InterviewerAvatar.css';

const BUBBLE_MAX = 140;

const InterviewerAvatar = ({
  lipLevel = 0,
  isSpeaking = false,
  isListening = false,
  isLoadingVoice = false,
  speakingText = '',
  speechProgress = 0,
  showSpeechBubble = false,
  compact = false,
  videoSrc = '',
  videoRef = null,
  statusLabel = '',
  name = 'Sarah Chen',
  role = 'Senior Interviewer'
}) => {
  const bubbleText = useMemo(() => {
    const t = (speakingText || '').trim();
    if (!t) return '';
    if (t.length <= BUBBLE_MAX) return t;
    return `${t.slice(0, BUBBLE_MAX).trim()}…`;
  }, [speakingText]);

  const visibleWords = useMemo(() => {
    if (!bubbleText || !isSpeaking) return [];
    const words = bubbleText.split(/\s+/).filter(Boolean);
    const count = Math.max(1, Math.ceil(words.length * Math.min(1, speechProgress + 0.06)));
    return words.slice(0, count);
  }, [bubbleText, isSpeaking, speechProgress]);

  const showVideo = Boolean(videoSrc);

  return (
    <div
      className={`interviewer-call ${compact ? 'is-compact' : ''} ${isSpeaking ? 'is-speaking' : ''} ${isListening ? 'is-listening' : ''} ${isLoadingVoice ? 'is-loading' : ''}`}
    >
      <div className="interviewer-call-feed">
        {showVideo ? (
          <video
            ref={videoRef}
            className="interviewer-call-video"
            src={videoSrc}
            playsInline
          />
        ) : (
          <LiveInterviewerVisual
            lipLevel={lipLevel}
            isSpeaking={isSpeaking}
            isListening={isListening && !isSpeaking}
          />
        )}

        <div className="interviewer-call-vignette" aria-hidden="true" />

        {showSpeechBubble && isSpeaking && visibleWords.length > 0 && (
          <div className="interviewer-speech-bubble" role="status" aria-live="polite">
            <span className="interviewer-speech-label">Sarah asks</span>
            <p className="interviewer-speech-text">
              {visibleWords.map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className="interviewer-speech-word"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {word}
                </span>
              ))}
              <span className="interviewer-speech-caret" />
            </p>
            <div className="interviewer-speech-progress">
              <span style={{ width: `${Math.min(100, speechProgress * 100)}%` }} />
            </div>
          </div>
        )}

        {isLoadingVoice && (
          <div className="interviewer-call-loading" aria-hidden="true">
            <span className="interviewer-call-spinner" />
            <span>Preparing question...</span>
          </div>
        )}

        <div className="interviewer-call-overlay">
          <span className={`interviewer-call-live-pill ${isSpeaking ? 'on-air' : ''}`}>
            <span className="interviewer-call-live-dot" />
            {isSpeaking ? 'Asking question' : isListening ? 'Listening to you' : 'In session'}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="interviewer-call-info">
          <h3 className="interviewer-call-name">{name}</h3>
          <p className="interviewer-call-role">{role}</p>
          {statusLabel && (
            <p className={`interviewer-call-status ${isSpeaking ? 'speaking' : isListening ? 'listening' : ''}`}>
              {statusLabel}
            </p>
          )}
        </div>
      )}
      {compact && statusLabel && (
        <p className={`interviewer-call-status-compact ${isSpeaking ? 'speaking' : isListening ? 'listening' : ''}`}>
          {statusLabel}
        </p>
      )}
    </div>
  );
};

export default InterviewerAvatar;
