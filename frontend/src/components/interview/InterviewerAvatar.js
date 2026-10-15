import React, { useMemo } from 'react';
import AnimatedInterviewer from './AnimatedInterviewer';
import './InterviewerAvatar.css';

const BUBBLE_MAX = 140;

const InterviewerAvatar = ({
  frameStore = null,
  isSpeaking = false,
  isListening = false,
  isLoadingVoice = false,
  isThinking = false,
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
  const thinking = !isSpeaking && (isLoadingVoice || isThinking);
  const mode = isSpeaking
    ? 'speaking'
    : thinking
      ? 'thinking'
      : isListening
        ? 'listening'
        : 'idle';

  const pillLabel = isSpeaking
    ? 'Speaking'
    : isLoadingVoice
      ? 'Preparing question'
      : isThinking
        ? 'Thinking'
        : isListening
          ? 'Listening to you'
          : 'In session';

  const firstName = (name || '').split(' ')[0] || 'Interviewer';

  return (
    <div
      className={`interviewer-call ${compact ? 'is-compact' : ''} is-${mode} ${isSpeaking ? 'is-speaking' : ''} ${isListening && !isSpeaking ? 'is-listening' : ''} ${thinking ? 'is-thinking' : ''}`}
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
          <AnimatedInterviewer frameStore={frameStore} mode={mode} />
        )}

        <div className="interviewer-call-vignette" aria-hidden="true" />

        {showSpeechBubble && isSpeaking && visibleWords.length > 0 && (
          <div className="interviewer-speech-bubble" role="status" aria-live="polite">
            <span className="interviewer-speech-label">{firstName} asks</span>
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

        <div className="interviewer-call-overlay">
          <span
            className={`interviewer-call-live-pill ${isSpeaking ? 'on-air' : ''} ${thinking ? 'is-thinking' : ''} ${isListening && !isSpeaking && !thinking ? 'is-listening' : ''}`}
            role="status"
            aria-live="polite"
          >
            {isSpeaking ? (
              <span className="interviewer-call-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : thinking ? (
              <span className="interviewer-call-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <span className="interviewer-call-live-dot" aria-hidden="true" />
            )}
            {pillLabel}
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
