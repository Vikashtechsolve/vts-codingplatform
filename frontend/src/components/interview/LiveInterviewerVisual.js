import React, { useId, useMemo } from 'react';
import './LiveInterviewerVisual.css';

const LiveInterviewerVisual = ({
  lipLevel = 0,
  viseme = 0,
  isSpeaking = false,
  isListening = false,
  speechProgress = 0
}) => {
  const uid = useId().replace(/:/g, '');
  const energy = isSpeaking ? lipLevel : 0;
  const mouthOpen = isSpeaking
    ? Math.min(1, Math.pow(lipLevel, 0.55) * 0.85 + (viseme >= 2 ? 0.12 : 0.04))
    : 0;

  const lowerLipY = useMemo(() => 4 + mouthOpen * 14, [mouthOpen]);
  const teethH = useMemo(() => 3 + mouthOpen * 9, [mouthOpen]);

  return (
    <div
      className={`live-interviewer-visual ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''} happy`}
      style={{ '--energy': energy, '--mouth-open': mouthOpen, '--progress': speechProgress }}
    >
      <svg viewBox="0 0 400 480" className="live-interviewer-svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d4f6f" />
            <stop offset="55%" stopColor="#2a3548" />
            <stop offset="100%" stopColor="#1a2230" />
          </linearGradient>
          <radialGradient id={`${uid}-halo`} cx="50%" cy="38%" r="42%">
            <stop offset="0%" stopColor="#8faee0" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8faee0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-blazer`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b7eb8" />
            <stop offset="100%" stopColor="#3d5a82" />
          </linearGradient>
          <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe8d8" />
            <stop offset="100%" stopColor="#f0cdb8" />
          </linearGradient>
          <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c4030" />
            <stop offset="100%" stopColor="#3d2a22" />
          </linearGradient>
          <linearGradient id={`${uid}-lip`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4a0a8" />
            <stop offset="100%" stopColor="#e07080" />
          </linearGradient>
        </defs>

        <rect width="400" height="480" fill={`url(#${uid}-bg)`} />
        <ellipse cx="200" cy="175" rx="130" ry="120" fill={`url(#${uid}-halo)`} />
        <circle className="liv-orb liv-orb-a" cx="60" cy="90" r="42" fill="#a8c4f0" />
        <circle className="liv-orb liv-orb-b" cx="340" cy="110" r="32" fill="#c4b5fd" />

        <g className="liv-body">
          <path
            d="M 32 480 L 32 358 Q 42 298 128 278 L 200 266 L 272 278 Q 358 298 368 358 L 368 480 Z"
            fill={`url(#${uid}-blazer)`}
          />
          <path d="M 128 278 L 200 262 L 272 278 L 200 292 Z" fill="#e8c4ae" opacity="0.9" />
          <path d="M 155 278 L 200 268 L 245 278" stroke="#6b8fc4" strokeWidth="1.5" fill="none" opacity="0.5" />
          <ellipse cx="200" cy="318" rx="38" ry="12" fill="#2d4563" opacity="0.25" />
        </g>

        <rect x="168" y="272" width="64" height="44" rx="12" fill={`url(#${uid}-skin)`} />

        <g className="liv-head-group">
          <path
            d="M 108 205 Q 108 82 200 64 Q 292 82 292 205 L 278 242 Q 200 232 122 242 Z"
            fill={`url(#${uid}-hair)`}
          />
          <ellipse cx="200" cy="188" rx="88" ry="96" fill={`url(#${uid}-skin)`} />
          <path
            d="M 118 162 Q 128 108 200 98 Q 272 108 282 162 Q 268 138 200 128 Q 132 138 118 162 Z"
            fill={`url(#${uid}-hair)`}
          />
          <path
            d="M 128 140 Q 160 118 200 114 Q 240 118 272 140"
            stroke="#7a5a48"
            strokeWidth="2"
            fill="none"
            opacity="0.35"
            strokeLinecap="round"
          />

          <ellipse cx="114" cy="196" rx="10" ry="14" fill="#f0cdb8" />
          <ellipse cx="286" cy="196" rx="10" ry="14" fill="#f0cdb8" />

          <path
            className="liv-brow"
            d="M 138 168 Q 166 152 194 160"
            stroke="#6b4a3a"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            className="liv-brow"
            d="M 206 160 Q 234 152 262 168"
            stroke="#6b4a3a"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          <ellipse className="liv-cheek" cx="132" cy="214" rx="22" ry="14" />
          <ellipse className="liv-cheek" cx="268" cy="214" rx="22" ry="14" />

          <g className="liv-eyes">
            <ellipse cx="164" cy="182" rx="27" ry="17" fill="#fff" />
            <ellipse cx="236" cy="182" rx="27" ry="17" fill="#fff" />
            <path d="M 140 178 Q 164 170 188 178" stroke="#8b6b5a" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5" />
            <path d="M 212 178 Q 236 170 260 178" stroke="#8b6b5a" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5" />
            <circle className="liv-pupil" cx="166" cy="182" r="11" fill="#6b8cae" />
            <circle className="liv-pupil" cx="238" cy="182" r="11" fill="#6b8cae" />
            <circle cx="168" cy="180" r="5" fill="#2a2a2a" />
            <circle cx="240" cy="180" r="5" fill="#2a2a2a" />
            <circle cx="171" cy="177" r="2.5" fill="#fff" />
            <circle cx="243" cy="177" r="2.5" fill="#fff" />
            <path
              className="liv-eye-smile"
              d="M 146 194 Q 164 202 182 194"
              stroke="#d4a890"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              className="liv-eye-smile"
              d="M 218 194 Q 236 202 254 194"
              stroke="#d4a890"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <path className="liv-blink" d="M 137 182 Q 164 168 191 182 Q 164 196 137 182 Z" fill={`url(#${uid}-skin)`} />
            <path className="liv-blink" d="M 209 182 Q 236 168 263 182 Q 236 196 209 182 Z" fill={`url(#${uid}-skin)`} />
          </g>

          <path d="M 200 196 L 197 218 Q 200 221 203 218 Z" fill="#e0b8a0" opacity="0.4" />

          <g className="liv-mouth">
            <path
              className="liv-upper-lip"
              d="M 168 250 Q 200 262 232 250 Q 200 256 168 250 Z"
              fill={`url(#${uid}-lip)`}
            />
            {mouthOpen > 0.06 && (
              <ellipse
                className="liv-teeth"
                cx="200"
                cy={256 + mouthOpen * 4}
                rx={16 + mouthOpen * 4}
                ry={teethH}
                fill="#fffef8"
              />
            )}
            <path
              className="liv-lower-lip"
              d={`M 172 ${254 + lowerLipY} Q 200 ${272 + lowerLipY + mouthOpen * 6} 228 ${254 + lowerLipY} Q 200 ${268 + lowerLipY} 172 ${254 + lowerLipY} Z`}
              fill="#e87888"
            />
            <path
              className="liv-smile-shine"
              d="M 178 252 Q 200 258 222 252"
              fill="none"
              stroke="#ffd4d8"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>

          <path d="M 152 272 L 200 286 L 248 272 L 200 300 Z" fill="#3d5a82" />
        </g>

        {isSpeaking && (
          <ellipse
            className="liv-speak-ring"
            cx="200"
            cy="188"
            rx={92 + energy * 10}
            ry={102 + energy * 12}
            fill="none"
            stroke="var(--primary-color, #7c8ef8)"
            strokeWidth="2"
            opacity={0.25 + energy * 0.35}
          />
        )}
      </svg>

      {isSpeaking && (
        <div className="liv-energy-rings" aria-hidden="true">
          <span className="liv-ring" />
          <span className="liv-ring liv-ring-2" />
        </div>
      )}
    </div>
  );
};

export default LiveInterviewerVisual;
