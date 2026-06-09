import React, { useState } from 'react';
import './LiveInterviewerVisual.css';

const PORTRAIT_SRC = `${process.env.PUBLIC_URL || ''}/interviewer-portrait.jpg`;

/**
 * Professional interviewer — real portrait photo (9:11) sized like a video-call feed.
 * Lip energy drives a subtle live indicator only (no cartoon mouth on photo).
 */
const LiveInterviewerVisual = ({
  lipLevel = 0,
  isSpeaking = false,
  isListening = false
}) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const speakGlow = isSpeaking ? 0.35 + Math.min(1, lipLevel) * 0.45 : 0;

  if (photoFailed) {
    return (
      <div
        className={`live-interviewer-visual live-interviewer-fallback ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}
        role="img"
        aria-label="Interviewer"
      >
        <div className="live-interviewer-fallback-inner">
          <span className="live-interviewer-fallback-initial">S</span>
          <p>Sarah Chen</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`live-interviewer-visual ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}
      style={{ '--speak-glow': speakGlow }}
    >
      <img
        src={PORTRAIT_SRC}
        alt=""
        className="live-interviewer-photo"
        draggable={false}
        decoding="async"
        onError={() => setPhotoFailed(true)}
      />
      {isSpeaking && <div className="live-interviewer-speak-shade" aria-hidden="true" />}
      <div className="live-interviewer-frame-edge" aria-hidden="true" />
    </div>
  );
};

export default LiveInterviewerVisual;
