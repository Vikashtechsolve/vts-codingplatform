import React, { useEffect, useRef } from 'react';
import './AnimatedInterviewer.css';

/**
 * Animated interviewer ("Sarah Chen").
 *
 * Driven by a speech-frame store (level 0..1 + viseme 0..4) sampled inside a
 * requestAnimationFrame loop — no React re-render per audio frame.
 *
 * Modes: idle | speaking | listening | thinking
 */

const SKIN = '#f0c6a3';
const SKIN_SHADE = '#d9a07c';
const SKIN_DEEP = '#bf8160';
const HAIR = '#38281f';
const HAIR_HI = '#6f4f3a';
const IRIS = '#5b3a27';
const IRIS_RIM = '#331e14';
const LIP = '#c0606b';
const LIP_DARK = '#95414d';
const MOUTH_IN = '#48171f';
const TEETH = '#fbf8f4';
const TONGUE = '#c85a69';
const BLAZER_DARK = '#1c2740';
const BLOUSE = '#f7f4f0';

// Character is authored in a 600x720 space, then placed into the 800x640 scene.
const CHAR_TRANSFORM = 'translate(160 42) scale(0.8)';
const HEAD_CX = 300;
const HEAD_PIVOT_Y = 330;
const MOUTH_Y = 400;
const EYE_TOP = 287;
const EYE_BOTTOM = 319;

// viseme → mouth target: open (0..1), width (-1..1), round (0..1)
const VISEME_TARGETS = [
  { open: 0.0, width: 0.0, round: 0.0 }, // 0 rest
  { open: 0.22, width: 0.1, round: 0.15 }, // 1 soft consonant
  { open: 1.0, width: 0.1, round: 0.3 }, // 2 "ah"
  { open: 0.6, width: -0.3, round: 0.85 }, // 3 "oh"
  { open: 0.28, width: 0.95, round: 0.0 }, // 4 "ee"
];

const MODE_POSE = {
  idle: { smile: 0.5, tilt: 0, dx: 0, dy: 0, brow: 0, browAsym: 0 },
  speaking: { smile: 0.3, tilt: 0.4, dx: 0, dy: 0, brow: 0.2, browAsym: 0 },
  listening: { smile: 0.62, tilt: 2.6, dx: 1.5, dy: 1, brow: 0.9, browAsym: 0 },
  thinking: { smile: 0.28, tilt: -2.2, dx: -3, dy: -1.5, brow: 1.4, browAsym: 2.4 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const rand = (min, max) => min + Math.random() * (max - min);

function mouthGeometry(open, widthMod, round, smile) {
  const w = 33 + widthMod * 9 - round * 8;
  const iw = w * 0.9;
  // corners sit above the seam centre at rest (gentle smile); opening relaxes them
  const corner = -smile * 5.2 - open * 0.08;
  const yT = -open * 0.36 + smile * 1.6;
  const yB = open * 0.64 + 0.6 + smile * 1.6;
  const upT = 6 + round * 2;
  const loT = 8.5 + round * 3;
  const yU = yT - upT;
  const yL = yB + loT;
  const bow = 2.2;

  const outer =
    `M ${-w} ${corner} ` +
    `C ${-w * 0.55} ${yU - 1} ${-w * 0.2} ${yU} 0 ${yU + bow} ` +
    `C ${w * 0.2} ${yU} ${w * 0.55} ${yU - 1} ${w} ${corner} ` +
    `C ${w * 0.62} ${yL} ${-w * 0.62} ${yL} ${-w} ${corner} Z`;

  const inner =
    `M ${-iw} ${corner * 0.8} ` +
    `C ${-iw * 0.5} ${yT} ${iw * 0.5} ${yT} ${iw} ${corner * 0.8} ` +
    `C ${iw * 0.55} ${yB} ${-iw * 0.55} ${yB} ${-iw} ${corner * 0.8} Z`;

  const seam =
    `M ${-iw} ${corner * 0.8} ` +
    `C ${-iw * 0.5} ${yT + 0.8} ${iw * 0.5} ${yT + 0.8} ${iw} ${corner * 0.8}`;

  const upperLipShade =
    `M ${-w} ${corner} ` +
    `C ${-w * 0.55} ${yU - 1} ${-w * 0.2} ${yU} 0 ${yU + bow} ` +
    `C ${w * 0.2} ${yU} ${w * 0.55} ${yU - 1} ${w} ${corner} ` +
    `C ${w * 0.5} ${corner * 0.8 + 1} ${-w * 0.5} ${corner * 0.8 + 1} ${-w} ${corner} Z`;

  return { outer, inner, seam, upperLipShade, w, iw, yT, yB, yL, loT };
}

const AnimatedInterviewer = ({ frameStore, mode = 'idle', className = '' }) => {
  const refs = useRef({});
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const setRef = (name) => (el) => {
    refs.current[name] = el;
  };

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const now0 = performance.now();
    const s = {
      open: 0,
      width: 0,
      round: 0,
      level: 0,
      smile: 0.5,
      heldViseme: 0,
      heldAt: now0,
      blinkStart: -1000,
      nextBlinkAt: now0 + rand(1200, 2600),
      blink: 0,
      gazeX: 0,
      gazeY: 0,
      gazeTX: 0,
      gazeTY: 0,
      nextGazeAt: now0 + 1500,
      nodStart: -5000,
      nextNodAt: now0 + rand(2500, 4500),
      hx: 0,
      hy: 0,
      rot: 0,
      brow: 0,
      browAsym: 0,
      light: 0,
      lastMode: mode,
      lastTs: now0,
    };

    let raf = 0;

    const tick = (ts) => {
      const r = refs.current;
      if (!r.head) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(64, ts - s.lastTs) / 16.67; // normalized to 60fps
      s.lastTs = ts;
      const t = ts / 1000;
      const currentMode = modeRef.current;
      const pose = MODE_POSE[currentMode] || MODE_POSE.idle;

      if (currentMode !== s.lastMode) {
        s.lastMode = currentMode;
        if (ts - s.blinkStart > 400) s.blinkStart = ts;
        s.nextGazeAt = ts + 200;
      }

      // ---- speech frame ----
      const frame = frameStore?.get?.() || { level: 0, viseme: 0 };
      const speaking = currentMode === 'speaking';
      const live = speaking ? clamp01(frame.level) : 0;

      if (speaking) {
        if (frame.viseme !== s.heldViseme && ts - s.heldAt > 70) {
          s.heldViseme = frame.viseme;
          s.heldAt = ts;
        }
        if (live < 0.05) s.heldViseme = 0;
      } else {
        s.heldViseme = 0;
      }

      const target = VISEME_TARGETS[s.heldViseme] || VISEME_TARGETS[0];
      const tOpen = target.open * (0.45 + 0.55 * live);
      const openK = tOpen > s.open ? 0.5 : 0.28;
      s.open = lerp(s.open, tOpen, openK * dt);
      s.width = lerp(s.width, target.width * (0.6 + 0.4 * live), 0.3 * dt);
      s.round = lerp(s.round, target.round, 0.3 * dt);
      s.level = lerp(s.level, live, 0.3 * dt);
      s.smile = lerp(s.smile, pose.smile, 0.05 * dt);

      // ---- blink ----
      if (ts >= s.nextBlinkAt) {
        s.blinkStart = ts;
        const base = currentMode === 'thinking' ? rand(1600, 3200) : rand(2400, 5600);
        s.nextBlinkAt = ts + (Math.random() < 0.14 ? 260 : base);
      }
      const be = ts - s.blinkStart;
      s.blink = be < 90 ? be / 90 : be < 240 ? 1 - (be - 90) / 150 : 0;

      // ---- gaze ----
      if (ts >= s.nextGazeAt) {
        if (currentMode === 'thinking') {
          s.gazeTX = rand(4, 6.5);
          s.gazeTY = rand(-6, -4);
          s.nextGazeAt = ts + rand(700, 1500);
        } else if (currentMode === 'listening') {
          s.gazeTX = rand(-1.2, 1.2);
          s.gazeTY = rand(-0.6, 0.8);
          s.nextGazeAt = ts + rand(1400, 3200);
        } else if (speaking) {
          s.gazeTX = rand(-2.6, 2.6);
          s.gazeTY = rand(-1.6, 1.4);
          s.nextGazeAt = ts + rand(900, 2400);
        } else {
          s.gazeTX = rand(-2, 2);
          s.gazeTY = rand(-1, 1);
          s.nextGazeAt = ts + rand(1500, 3500);
        }
      }
      s.gazeX = lerp(s.gazeX, s.gazeTX, 0.14 * dt);
      s.gazeY = lerp(s.gazeY, s.gazeTY, 0.14 * dt);

      // ---- head motion ----
      let hx = pose.dx;
      let hy = pose.dy;
      let rot = pose.tilt;
      if (!reduceMotion) {
        hx += Math.sin(t * 0.45) * 2.2 + Math.sin(t * 0.13) * 1.4;
        hy += Math.sin(t * 0.8) * 1.5;
        rot += Math.sin(t * 0.31) * 1.2;
        if (speaking) {
          hy += s.level * 3.6;
          rot += Math.sin(t * 2.3) * 1.1 * s.level;
          hx += Math.sin(t * 1.7) * 1.4 * s.level;
        }
        if (currentMode === 'listening') {
          if (ts >= s.nextNodAt) {
            s.nodStart = ts;
            s.nextNodAt = ts + rand(2800, 5200);
          }
          const ne = ts - s.nodStart;
          if (ne < 620) hy += Math.sin((ne / 620) * Math.PI) * 5.5;
        }
      }
      s.hx = lerp(s.hx, hx, 0.08 * dt);
      s.hy = lerp(s.hy, hy, 0.08 * dt);
      s.rot = lerp(s.rot, rot, 0.08 * dt);

      // ---- brows ----
      const browTarget = pose.brow + (speaking ? live * 2.6 : 0);
      s.brow = lerp(s.brow, browTarget, 0.15 * dt);
      s.browAsym = lerp(s.browAsym, pose.browAsym, 0.08 * dt);

      // ---- light ----
      s.light = lerp(s.light, speaking ? 0.1 + s.level * 0.28 : 0.05, 0.2 * dt);

      // ---- apply ----
      const headT = `translate(${s.hx.toFixed(2)} ${s.hy.toFixed(2)}) rotate(${s.rot.toFixed(2)} ${HEAD_CX} ${HEAD_PIVOT_Y})`;
      r.head.setAttribute('transform', headT);
      r.hairBack.setAttribute('transform', headT);
      r.body.setAttribute(
        'transform',
        `translate(${(s.hx * 0.3).toFixed(2)} ${(s.hy * 0.35).toFixed(2)})`
      );

      const m = mouthGeometry(s.open * 28, s.width, s.round, s.smile);
      r.lipOuter.setAttribute('d', m.outer);
      r.lipUpperShade.setAttribute('d', m.upperLipShade);
      r.mouthInner.setAttribute('d', m.inner);
      r.mouthClip.setAttribute('d', m.inner);
      r.lipSeam.setAttribute('d', m.seam);
      r.lipSeam.setAttribute('opacity', String(clamp01(1 - s.open * 2.2)));
      r.teeth.setAttribute('x', String(-m.iw + 2));
      r.teeth.setAttribute('y', String(m.yT - 1.5));
      r.teeth.setAttribute('width', String(Math.max(0, m.iw * 2 - 4)));
      r.tongue.setAttribute('cy', String(m.yB + 3));
      r.tongue.setAttribute('rx', String(m.iw * 0.55));
      r.lowerLipHi.setAttribute('cy', String(m.yB + m.loT * 0.55));
      r.lowerLipHi.setAttribute('rx', String(m.w * 0.3));

      const b = s.blink;
      const lidT = `translate(0 ${(EYE_TOP * (1 - b)).toFixed(2)}) scale(1 ${b.toFixed(3)})`;
      r.lidL.setAttribute('transform', lidT);
      r.lidR.setAttribute('transform', lidT);
      const squint = clamp01(s.smile * 0.2 + s.level * 0.08);
      const lowLidT = `translate(0 ${(EYE_BOTTOM * (1 - squint)).toFixed(2)}) scale(1 ${squint.toFixed(3)})`;
      r.lowLidL.setAttribute('transform', lowLidT);
      r.lowLidR.setAttribute('transform', lowLidT);

      const gaze = `translate(${s.gazeX.toFixed(2)} ${s.gazeY.toFixed(2)})`;
      r.irisL.setAttribute('transform', gaze);
      r.irisR.setAttribute('transform', gaze);

      r.browL.setAttribute('transform', `translate(0 ${(-s.brow - s.browAsym).toFixed(2)})`);
      r.browR.setAttribute('transform', `translate(0 ${(-s.brow + s.browAsym * 0.2).toFixed(2)})`);

      r.light.setAttribute('opacity', s.light.toFixed(3));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // frameStore identity is stable for the room's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameStore]);

  return (
    <div className={`animated-interviewer mode-${mode} ${className}`} aria-hidden="true">
      <svg
        className="animated-interviewer-svg"
        viewBox="0 0 800 640"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Interviewer"
      >
        <defs>
          <linearGradient id="ai-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9e3da" />
            <stop offset="1" stopColor="#c4bbae" />
          </linearGradient>
          <linearGradient id="ai-window" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fdf9f2" />
            <stop offset="1" stopColor="#efe3d0" />
          </linearGradient>
          <radialGradient id="ai-skin" cx="0.5" cy="0.36" r="0.72">
            <stop offset="0" stopColor="#f8d8bb" />
            <stop offset="0.7" stopColor={SKIN} />
            <stop offset="1" stopColor={SKIN_SHADE} />
          </radialGradient>
          <linearGradient id="ai-hair" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={HAIR_HI} />
            <stop offset="0.45" stopColor={HAIR} />
            <stop offset="1" stopColor="#261913" />
          </linearGradient>
          <linearGradient id="ai-blazer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#36476c" />
            <stop offset="1" stopColor={BLAZER_DARK} />
          </linearGradient>
          <linearGradient id="ai-lip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cf7580" />
            <stop offset="1" stopColor={LIP} />
          </linearGradient>
          <radialGradient id="ai-keylight" cx="0.5" cy="0.42" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ai-vignette" cx="0.5" cy="0.5" r="0.72">
            <stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.34" />
          </radialGradient>
          <radialGradient id="ai-iris" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#7c5438" />
            <stop offset="0.7" stopColor={IRIS} />
            <stop offset="1" stopColor={IRIS_RIM} />
          </radialGradient>
          <filter id="ai-blur-bg" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="ai-blur-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="ai-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" />
          </filter>

          <clipPath id="ai-eye-l">
            <path d="M 237 304 C 246 289 280 288 287 304 C 280 318 246 319 237 304 Z" />
          </clipPath>
          <clipPath id="ai-eye-r">
            <path d="M 313 304 C 320 288 354 289 363 304 C 354 319 320 318 313 304 Z" />
          </clipPath>
          <clipPath id="ai-mouth-clip">
            <path ref={setRef('mouthClip')} d="M -30 0 L 30 0 Z" />
          </clipPath>
        </defs>

        {/* ---------- background: soft office ---------- */}
        <rect width="800" height="640" fill="url(#ai-wall)" />
        <g filter="url(#ai-blur-bg)" opacity="0.95">
          <rect x="556" y="16" width="260" height="430" rx="6" fill="url(#ai-window)" />
          <rect x="682" y="16" width="7" height="430" fill="#d8ccb7" />
          <rect x="556" y="228" width="260" height="7" fill="#d8ccb7" />
          <ellipse cx="640" cy="300" rx="200" ry="260" fill="#fff" opacity="0.22" />
          <rect x="0" y="188" width="210" height="8" rx="3" fill="#b2a797" />
          <rect x="22" y="146" width="16" height="42" rx="2" fill="#8794a5" />
          <rect x="42" y="136" width="13" height="52" rx="2" fill="#b86b5a" />
          <rect x="60" y="150" width="18" height="38" rx="2" fill="#6f8a73" />
          <rect x="82" y="140" width="11" height="48" rx="2" fill="#d0b07a" />
          <rect x="98" y="156" width="14" height="32" rx="2" fill="#5c6b7f" />
          <ellipse cx="96" cy="430" rx="52" ry="66" fill="#6c8d60" />
          <ellipse cx="56" cy="466" rx="42" ry="56" fill="#5b7c52" />
          <ellipse cx="132" cy="472" rx="38" ry="50" fill="#79996a" />
          <rect x="58" y="512" width="78" height="90" rx="10" fill="#b58b6a" />
        </g>
        <rect width="800" height="640" fill="url(#ai-vignette)" />

        {/* soft shadow behind figure */}
        <ellipse cx="400" cy="520" rx="210" ry="150" fill="#4f3f33" opacity="0.26" filter="url(#ai-shadow)" />

        <g transform={CHAR_TRANSFORM}>
          {/* ---------- hair (back) ---------- */}
          <g ref={setRef('hairBack')}>
            <path
              d="M 176 330 C 150 200 220 108 300 108 C 380 108 450 200 424 330 L 446 620 L 154 620 Z"
              fill="url(#ai-hair)"
            />
          </g>

          {/* ---------- body ---------- */}
          <g ref={setRef('body')}>
            <path d="M 274 420 L 326 420 L 330 505 L 270 505 Z" fill={SKIN_SHADE} />
            <path d="M 274 420 L 326 420 L 324 470 C 310 486 290 486 276 470 Z" fill={SKIN_DEEP} opacity="0.5" />
            <path
              d="M 100 720 L 100 612 C 100 548 170 508 246 490 L 300 540 L 354 490 C 430 508 500 548 500 612 L 500 720 Z"
              fill="url(#ai-blazer)"
            />
            <path d="M 246 490 L 300 574 L 354 490 L 334 484 L 300 528 L 266 484 Z" fill={BLOUSE} />
            <path d="M 246 490 L 300 574 L 282 600 L 212 520 Z" fill={BLAZER_DARK} opacity="0.92" />
            <path d="M 354 490 L 300 574 L 318 600 L 388 520 Z" fill={BLAZER_DARK} opacity="0.92" />
            <path d="M 246 490 L 212 520" stroke="#4b5d84" strokeWidth="1.5" opacity="0.5" />
            <path d="M 354 490 L 388 520" stroke="#4b5d84" strokeWidth="1.5" opacity="0.5" />
            <path d="M 300 574 L 300 720" stroke="#141d30" strokeWidth="2" opacity="0.5" />
            <circle cx="300" cy="612" r="4" fill="#c9b27f" />
            {/* front hair strands over shoulders */}
            <path
              d="M 188 300 C 170 380 176 470 194 560 C 210 580 236 574 236 556 C 224 470 220 392 218 318 Z"
              fill="url(#ai-hair)"
            />
            <path
              d="M 412 300 C 430 380 424 470 406 560 C 390 580 364 574 364 556 C 376 470 380 392 382 318 Z"
              fill="url(#ai-hair)"
            />
            <path d="M 204 340 C 198 420 202 490 214 548" fill="none" stroke={HAIR_HI} strokeWidth="2" opacity="0.35" strokeLinecap="round" />
            <path d="M 396 340 C 402 420 398 490 386 548" fill="none" stroke={HAIR_HI} strokeWidth="2" opacity="0.35" strokeLinecap="round" />
          </g>

          {/* ---------- head ---------- */}
          <g ref={setRef('head')}>
            <ellipse cx="190" cy="306" rx="11" ry="17" fill={SKIN_SHADE} />
            <ellipse cx="410" cy="306" rx="11" ry="17" fill={SKIN_SHADE} />
            <circle cx="190" cy="325" r="3" fill="#d9b86a" />
            <circle cx="410" cy="325" r="3" fill="#d9b86a" />

            <path
              d="M 300 148 C 362 148 412 200 412 284 C 412 356 388 420 346 450 C 326 464 274 464 254 450 C 212 420 188 356 188 284 C 188 200 238 148 300 148 Z"
              fill="url(#ai-skin)"
            />
            {/* cheekbone / temple shading */}
            <ellipse cx="234" cy="342" rx="14" ry="28" fill={SKIN_SHADE} opacity="0.2" filter="url(#ai-blur-soft)" />
            <ellipse cx="366" cy="342" rx="14" ry="28" fill={SKIN_SHADE} opacity="0.2" filter="url(#ai-blur-soft)" />
            <ellipse cx="246" cy="358" rx="20" ry="10" fill="#e4846e" opacity="0.14" filter="url(#ai-blur-soft)" />
            <ellipse cx="354" cy="358" rx="20" ry="10" fill="#e4846e" opacity="0.14" filter="url(#ai-blur-soft)" />
            {/* hairline shadow */}
            <path
              d="M 200 262 C 230 214 262 198 300 200 C 338 198 370 214 400 262 C 372 236 338 224 300 226 C 262 224 228 236 200 262 Z"
              fill={SKIN_SHADE}
              opacity="0.3"
              filter="url(#ai-blur-soft)"
            />
            {/* jaw shadow */}
            <path d="M 256 446 C 280 462 320 462 344 446 C 330 452 270 452 256 446 Z" fill={SKIN_DEEP} opacity="0.35" />

            {/* nose */}
            <path
              d="M 296 318 C 292 338 289 350 293 358"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.26"
            />
            <path
              d="M 290 360 C 294 365 306 365 310 360"
              fill="none"
              stroke={SKIN_DEEP}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.4"
            />
            <ellipse cx="292" cy="360" rx="2.6" ry="1.6" fill={SKIN_DEEP} opacity="0.4" />
            <ellipse cx="308" cy="360" rx="2.6" ry="1.6" fill={SKIN_DEEP} opacity="0.4" />
            <ellipse cx="300" cy="352" rx="5" ry="3" fill="#fff" opacity="0.16" />

            {/* eyes */}
            <g clipPath="url(#ai-eye-l)">
              <rect x="232" y="284" width="60" height="40" fill="#fdfbf9" />
              <g ref={setRef('irisL')}>
                <circle cx="262" cy="305" r="10.5" fill="url(#ai-iris)" />
                <circle cx="262" cy="305" r="4.8" fill="#100806" />
                <circle cx="265.5" cy="301.5" r="2.4" fill="#fff" opacity="0.95" />
                <circle cx="258.5" cy="308.5" r="1.1" fill="#fff" opacity="0.6" />
              </g>
              <rect ref={setRef('lowLidL')} x="232" y="300" width="60" height="22" fill={SKIN} />
              <rect ref={setRef('lidL')} x="232" y="284" width="60" height="40" fill="#e6b592" />
            </g>
            <g clipPath="url(#ai-eye-r)">
              <rect x="308" y="284" width="60" height="40" fill="#fdfbf9" />
              <g ref={setRef('irisR')}>
                <circle cx="338" cy="305" r="10.5" fill="url(#ai-iris)" />
                <circle cx="338" cy="305" r="4.8" fill="#100806" />
                <circle cx="341.5" cy="301.5" r="2.4" fill="#fff" opacity="0.95" />
                <circle cx="334.5" cy="308.5" r="1.1" fill="#fff" opacity="0.6" />
              </g>
              <rect ref={setRef('lowLidR')} x="308" y="300" width="60" height="22" fill={SKIN} />
              <rect ref={setRef('lidR')} x="308" y="284" width="60" height="40" fill="#e6b592" />
            </g>
            {/* lash lines + creases */}
            <path d="M 237 304 C 246 289 280 288 287 304" fill="none" stroke="#24150f" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 313 304 C 320 288 354 289 363 304" fill="none" stroke="#24150f" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 237 304 L 232.5 300.5" stroke="#24150f" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 363 304 L 367.5 300.5" stroke="#24150f" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 239 305 C 248 317 278 318 286 305" fill="none" stroke="#6b4a3a" strokeWidth="1" opacity="0.45" />
            <path d="M 314 305 C 322 318 352 317 361 305" fill="none" stroke="#6b4a3a" strokeWidth="1" opacity="0.45" />
            <path d="M 241 295 C 251 285 275 285 285 293" fill="none" stroke={SKIN_DEEP} strokeWidth="1.3" opacity="0.3" />
            <path d="M 315 293 C 325 285 349 285 359 295" fill="none" stroke={SKIN_DEEP} strokeWidth="1.3" opacity="0.3" />

            {/* brows */}
            <g ref={setRef('browL')}>
              <path d="M 236 284 C 248 276 270 275 288 281" fill="none" stroke={HAIR} strokeWidth="4.2" strokeLinecap="round" />
            </g>
            <g ref={setRef('browR')}>
              <path d="M 312 281 C 330 275 352 276 364 284" fill="none" stroke={HAIR} strokeWidth="4.2" strokeLinecap="round" />
            </g>

            {/* mouth */}
            <g transform={`translate(${HEAD_CX} ${MOUTH_Y})`}>
              <path ref={setRef('lipOuter')} d="M -31 0 L 31 0 Z" fill="url(#ai-lip)" />
              <path ref={setRef('lipUpperShade')} d="M -31 0 L 31 0 Z" fill={LIP_DARK} opacity="0.45" />
              <g clipPath="url(#ai-mouth-clip)">
                <path ref={setRef('mouthInner')} d="M -28 0 L 28 0 Z" fill={MOUTH_IN} />
                <ellipse ref={setRef('tongue')} cx="0" cy="8" rx="16" ry="7" fill={TONGUE} />
                <rect ref={setRef('teeth')} x="-28" y="-2" width="56" height="9" rx="3" fill={TEETH} />
              </g>
              <path ref={setRef('lipSeam')} d="M -28 0 L 28 0" fill="none" stroke={LIP_DARK} strokeWidth="1.3" strokeLinecap="round" />
              <ellipse ref={setRef('lowerLipHi')} cx="0" cy="7" rx="10" ry="1.8" fill="#fff" opacity="0.22" />
            </g>

            {/* hair (front) */}
            <path
              d="M 188 296 C 184 196 236 134 300 134 C 364 134 418 196 412 296 C 408 236 392 204 366 196 C 342 190 318 212 296 208 C 270 204 232 216 212 250 C 200 266 192 282 188 296 Z"
              fill="url(#ai-hair)"
            />
            <path d="M 266 140 C 300 128 350 140 380 176" fill="none" stroke={HAIR_HI} strokeWidth="4" strokeLinecap="round" opacity="0.32" />
            <path d="M 236 162 C 262 148 290 146 318 152" fill="none" stroke={HAIR_HI} strokeWidth="3" strokeLinecap="round" opacity="0.28" />
            <path d="M 214 226 C 236 200 268 190 296 196" fill="none" stroke={HAIR_HI} strokeWidth="2" strokeLinecap="round" opacity="0.22" />
          </g>
        </g>

        {/* key light that breathes with the voice */}
        <rect ref={setRef('light')} width="800" height="640" fill="url(#ai-keylight)" opacity="0.05" />
      </svg>
    </div>
  );
};

export default AnimatedInterviewer;
