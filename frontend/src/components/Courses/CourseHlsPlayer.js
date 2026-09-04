import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import axiosInstance from '../../utils/axios';
import { getPublicApiOrigin } from '../../config/apiBase';
import { samplePlaybackDelta } from '../../utils/courseWatchClient';

/**
 * HLS player with watch heartbeats for course lectures.
 * playlistUrl may be absolute, /api/..., or /courses-media... (joined to axios /api base).
 */
const CourseHlsPlayer = ({
  playlistUrl,
  courseId,
  lectureId,
  resumePosition = 0,
  onProgress,
  enableHeartbeat = true,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const sampleRef = useRef(null);
  const pendingRef = useRef(0);
  const lastSentRef = useRef(0);
  const flushingRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playlistUrl) return undefined;

    let src = playlistUrl;
    if (!playlistUrl.startsWith('http')) {
      if (playlistUrl.startsWith('/api/')) {
        src = `${getPublicApiOrigin()}${playlistUrl}`;
      } else {
        const base = (axiosInstance.defaults.baseURL || '').replace(/\/$/, '');
        src = `${base}${playlistUrl.startsWith('/') ? '' : '/'}${playlistUrl}`;
      }
    }

    setStatus('loading');
    setError('');
    let resumeApplied = false;

    const applyResume = () => {
      if (!resumeApplied && resumePosition > 0 && Number.isFinite(resumePosition)) {
        resumeApplied = true;
        video.currentTime = resumePosition;
        sampleRef.current = resumePosition;
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        xhrSetup(xhr) {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyResume();
        setStatus('ready');
        video.play().catch(() => {
          /* autoplay may be blocked; controls remain */
        });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        setStatus('error');
        setError('Video failed to load. Refresh and try again.');
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      const onMeta = () => {
        applyResume();
        setStatus('ready');
      };
      video.addEventListener('loadedmetadata', onMeta);
      return () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeAttribute('src');
        video.load();
      };
    } else {
      setStatus('error');
      setError('This browser cannot play HLS video.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playlistUrl, resumePosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !courseId || !lectureId || !enableHeartbeat) return undefined;

    sampleRef.current = null;
    pendingRef.current = 0;
    lastSentRef.current = 0;
    flushingRef.current = false;

    const mediaDuration = () => {
      const d = Number(video.duration);
      return Number.isFinite(d) && d > 0 ? d : 0;
    };

    const sample = ({ evenIfPaused = false } = {}) => {
      if (video.paused && !video.ended && !evenIfPaused) return;
      const pos = Number(video.currentTime) || 0;
      const prev = sampleRef.current;
      const { delta, next } = samplePlaybackDelta(prev, pos);
      pendingRef.current += delta;
      sampleRef.current = next;
    };

    const flush = async ({ force = false, ended = false } = {}) => {
      sample({ evenIfPaused: true });
      let delta = pendingRef.current;
      const duration = mediaDuration();
      let pos = Number(video.currentTime) || 0;
      if (ended && duration > 0) {
        pos = duration;
        if (delta < 1) delta = Math.max(delta, 1);
      }
      if (delta < 0.5 && !ended) return;
      if (flushingRef.current) return;
      pendingRef.current = 0;
      lastSentRef.current = Date.now();
      flushingRef.current = true;
      try {
        const { data } = await axiosInstance.post(
          `/student/courses/${courseId}/lectures/${lectureId}/heartbeat`,
          {
            positionSec: pos,
            deltaWatchedSec: Math.min(20, Math.max(0, delta)),
            durationSec: duration,
          }
        );
        onProgressRef.current?.(data);
      } catch (err) {
        pendingRef.current += delta;
        console.warn('Heartbeat failed', err?.response?.data?.message || err.message);
      } finally {
        flushingRef.current = false;
      }
    };

    const onTimeUpdate = () => {
      sample();
      if (pendingRef.current >= 8 || Date.now() - lastSentRef.current >= 10000) {
        flush();
      }
    };
    const onPlay = () => {
      sampleRef.current = Number(video.currentTime) || 0;
    };
    const onPause = () => {
      flush({ force: true });
    };
    const onEnded = () => {
      flush({ force: true, ended: true });
    };
    const onSeeking = () => {
      sampleRef.current = null;
    };
    const onSeeked = () => {
      sampleRef.current = Number(video.currentTime) || 0;
    };
    const onHidden = () => {
      if (document.hidden) flush({ force: true });
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onHidden);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onHidden);
      if (pendingRef.current >= 0.5) {
        flush({ force: true });
      }
    };
  }, [courseId, lectureId, enableHeartbeat, playlistUrl]);

  return (
    <div className={`course-video-wrap ${status === 'loading' ? 'is-loading' : ''}`}>
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        controlsList="nodownload"
      />
      {status === 'loading' && (
        <div className="clw-switch-overlay" aria-live="polite">
          <span className="clw-switch-spinner" />
          Loading video…
        </div>
      )}
      {status === 'error' && error && (
        <div className="clw-switch-overlay" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default CourseHlsPlayer;
