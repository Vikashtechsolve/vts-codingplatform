import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import InterviewerAvatar from '../../components/interview/InterviewerAvatar';
import { attachAudioLipSync, runSimulatedLipSync } from '../../utils/audioLipSync';
import { acquireInterviewMediaStream, isStreamActive, stopMediaStream } from '../../utils/interviewMedia';
import {
  getSupportedRecorderMimeType,
  createAnswerMediaRecorder,
  waitForRecorderInactive,
  startAnswerRecorder
} from '../../utils/interviewRecording';
import './MockInterviewRoom.css';

const MIN_TRANSCRIPT_LENGTH = 2;

const getQuestionSpeechText = (question) => {
  if (!question) return '';
  return (question.spokenText || question.questionText || '').trim();
};
const SILENCE_MS_BEFORE_AUTO_SUBMIT = 2600;
const MIN_RECORD_MS = 900;
const MAX_RECORD_MS = 180000;
const SPEECH_RMS_THRESHOLD = 0.022;
const MIN_AUDIO_BYTES = 1200;

function computeRms(analyser) {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const sample = (data[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / data.length);
}

const MockInterviewRoom = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const transcriptRef = useRef('');
  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordMimeTypeRef = useRef('');
  const recordChunksRef = useRef([]);
  const vadAudioContextRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const vadStreamTrackIdRef = useRef(null);
  const lipSyncStopRef = useRef(null);
  const vadFrameRef = useRef(null);
  const isCapturingRef = useRef(false);
  const hasSpeechRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const captureStartedAtRef = useRef(0);
  const transcribeInFlightRef = useRef(false);
  const finishCaptureRef = useRef(null);
  const submittedRef = useRef(false);
  const isListeningRef = useRef(false);
  const shouldListenRef = useRef(false);
  const lastSpokenQuestionRef = useRef('');
  const isAiSpeakingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const leaveSubmitHandledRef = useRef(false);
  const aiAudioRef = useRef(null);
  const aiAudioUrlRef = useRef(null);
  const aiVideoRef = useRef(null);
  const aiVideoUrlRef = useRef(null);
  const speechProgressUnbindRef = useRef(null);
  const speakAbortRef = useRef(null);
  const prefetchAbortRef = useRef(null);
  const prefetchedSpeechRef = useRef(null);
  const sessionIdRef = useRef(null);
  const joinSpeakPendingRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const [usesBrowserTts, setUsesBrowserTts] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [lipLevel, setLipLevel] = useState(0);
  const [viseme, setViseme] = useState(0);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [interviewerVideoUrl, setInterviewerVideoUrl] = useState('');

  const [interview, setInterview] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [answerCount, setAnswerCount] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastAcknowledgment, setLastAcknowledgment] = useState('');
  const [errorStarting, setErrorStarting] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [prepareLabel, setPrepareLabel] = useState('');
  const currentQuestionRef = useRef(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const loadInterview = async () => {
      try {
        setLoading(true);
        setErrorStarting(null);
        const interviewRes = await axiosInstance.get(`/interviews/${interviewId}`);
        if (cancelled) return;
        setInterview(interviewRes.data);
        setTotalQuestions(interviewRes.data.questionCount || 8);
      } catch (error) {
        if (cancelled) return;
        const msg = error.response?.data?.message || 'Failed to load interview';
        setErrorStarting(msg);
        setModal({ isOpen: true, title: 'Cannot load', message: msg, type: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadInterview();
    return () => { cancelled = true; };
  }, [interviewId]);

  const startInterviewSession = useCallback(async () => {
    const sessionRes = await axiosInstance.post(`/interview-sessions/start/${interviewId}`);
    const data = sessionRes.data;
    sessionIdRef.current = data.sessionId;
    setSessionId(data.sessionId);
    setCurrentQuestion(data.currentQuestion);
    setTotalQuestions(data.totalQuestions || interview?.questionCount || 8);
    setTimeRemaining((data.timeLimit || interview?.duration || 20) * 60);
    return data;
  }, [interviewId, interview?.questionCount, interview?.duration]);

  useEffect(() => {
    if (!timeRemaining || !isInterviewActive) return;
    const timer = setInterval(() => setTimeRemaining(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeRemaining, isInterviewActive]);

  useEffect(() => {
    if (timeRemaining !== 0 || !isInterviewActive || !sessionId || submittedRef.current) return;
    submittedRef.current = true;
    (async () => {
      stopListening();
      try {
        await axiosInstance.post(`/interview-sessions/${sessionId}/submit`);
      } catch (e) {
        showModal('Error', e.response?.data?.message || 'Failed to submit', 'error');
      }
      navigate(`/student/interviews/feedback/${sessionId}`);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- showModal/stopListening are stable; intentional deps
  }, [timeRemaining, isInterviewActive, sessionId, navigate]);

  const showModal = useCallback((title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  }, []);
  const closeModal = useCallback(() => setModal({ isOpen: false, title: '', message: '', type: 'info' }), []);

  const stopVadLoop = useCallback(() => {
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
  }, []);

  const attachCameraPreview = useCallback((stream) => {
    const video = cameraVideoRef.current;
    if (!video || !stream) return;
    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) {
      setCameraReady(false);
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    const markReady = () => setCameraReady(true);
    video.onloadedmetadata = markReady;
    video.play().then(markReady).catch(() => {
      setTimeout(markReady, 300);
    });
  }, []);

  useEffect(() => {
    if (!isInterviewActive || !micStreamRef.current) return;
    attachCameraPreview(micStreamRef.current);
  }, [isInterviewActive, attachCameraPreview]);

  const releaseMediaStream = useCallback(() => {
    stopVadLoop();
    lipSyncStopRef.current?.();
    lipSyncStopRef.current = null;
    setLipLevel(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    mediaRecorderRef.current = null;
    recordChunksRef.current = [];
    isCapturingRef.current = false;
    if (vadAudioContextRef.current) {
      vadAudioContextRef.current.close().catch(() => {});
      vadAudioContextRef.current = null;
    }
    vadAnalyserRef.current = null;
    vadStreamTrackIdRef.current = null;
    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setHasVideo(true);
    setIsListening(false);
    isListeningRef.current = false;
  }, [stopVadLoop]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    isCapturingRef.current = false;
    hasSpeechRef.current = false;
    stopVadLoop();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (e) {}
    }
    setIsListening(false);
  }, [stopVadLoop]);

  const handleSpeechFrame = useCallback(({ level, viseme: v }) => {
    setLipLevel(level);
    setViseme(v);
  }, []);

  const bindSpeechProgress = useCallback((mediaEl) => {
    speechProgressUnbindRef.current?.();
    if (!mediaEl) {
      speechProgressUnbindRef.current = null;
      return;
    }
    const onTime = () => {
      if (mediaEl.duration && Number.isFinite(mediaEl.duration)) {
        setSpeechProgress(mediaEl.currentTime / mediaEl.duration);
      }
    };
    mediaEl.addEventListener('timeupdate', onTime);
    speechProgressUnbindRef.current = () => mediaEl.removeEventListener('timeupdate', onTime);
  }, []);

  const stopAiAudio = useCallback(() => {
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    speechProgressUnbindRef.current?.();
    speechProgressUnbindRef.current = null;
    if (aiAudioRef.current) {
      aiAudioRef.current.onended = null;
      aiAudioRef.current.onerror = null;
      aiAudioRef.current.onplay = null;
      aiAudioRef.current.pause();
      aiAudioRef.current.src = '';
      aiAudioRef.current = null;
    }
    if (aiAudioUrlRef.current) {
      URL.revokeObjectURL(aiAudioUrlRef.current);
      aiAudioUrlRef.current = null;
    }
    if (aiVideoRef.current) {
      aiVideoRef.current.onended = null;
      aiVideoRef.current.onerror = null;
      aiVideoRef.current.onplay = null;
      aiVideoRef.current.pause();
      aiVideoRef.current.removeAttribute('src');
      aiVideoRef.current.load();
    }
    if (aiVideoUrlRef.current) {
      URL.revokeObjectURL(aiVideoUrlRef.current);
      aiVideoUrlRef.current = null;
    }
    setInterviewerVideoUrl('');
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    lipSyncStopRef.current?.();
    lipSyncStopRef.current = null;
    setLipLevel(0);
    setViseme(0);
    setSpeechProgress(0);
  }, []);

  useEffect(() => () => {
    stopAiAudio();
    releaseMediaStream();
  }, [stopAiAudio, releaseMediaStream]);

  const transcribeRecording = useCallback(async (blob) => {
    if (!sessionId || transcribeInFlightRef.current) return '';
    transcribeInFlightRef.current = true;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const ext = (recordMimeTypeRef.current || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
      formData.append('audio', blob, `answer.${ext}`);
      const prompt = currentQuestionRef.current?.questionText?.trim();
      if (prompt) formData.append('prompt', prompt.slice(0, 500));

      const response = await axiosInstance.post(
        `/interview-sessions/${sessionId}/transcribe`,
        formData
      );
      const text = (response.data?.transcript || '').trim();
      setTranscript(text);
      transcriptRef.current = text;
      return text;
    } catch (error) {
      showModal('Transcription', error.response?.data?.message || 'Could not transcribe your answer. Please try speaking again.', 'error');
      return '';
    } finally {
      transcribeInFlightRef.current = false;
      setIsTranscribing(false);
    }
  }, [sessionId, showModal]);

  const autoSubmitAnswer = useCallback(async (textOverride, allowEmpty = false) => {
    if (isSubmitting || !isInterviewActive || submittedRef.current) return;
    if (isAiSpeakingRef.current) return;
    const raw = textOverride != null ? String(textOverride).trim() : (transcriptRef.current || '').trim();
    const finalAnswer = raw;
    if (!allowEmpty && (!finalAnswer || finalAnswer.length < MIN_TRANSCRIPT_LENGTH)) return;
    stopListening();
    try {
      setIsSubmitting(true);
      const response = await axiosInstance.post(`/interview-sessions/${sessionId}/answer`, { transcript: finalAnswer });
      setTranscript('');
      transcriptRef.current = '';
      if (response.data.acknowledgment) {
        setLastAcknowledgment(response.data.acknowledgment);
      }
      lastSpokenQuestionRef.current = '';
      prefetchedSpeechRef.current = null;
      setAnswerCount(prev => prev + 1);
      if (response.data.completed) {
        submittedRef.current = true;
        await axiosInstance.post(`/interview-sessions/${sessionId}/submit`);
        navigate(`/student/interviews/feedback/${sessionId}`);
        return;
      }
      setCurrentQuestion(response.data.nextQuestion);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to submit answer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, isInterviewActive, isSubmitting, navigate, showModal, stopListening]);

  const ensureMediaStream = useCallback(async () => {
    if (isStreamActive(micStreamRef.current)) {
      attachCameraPreview(micStreamRef.current);
      return micStreamRef.current;
    }

    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    vadAudioContextRef.current?.close().catch(() => {});
    vadAudioContextRef.current = null;
    vadAnalyserRef.current = null;
    vadStreamTrackIdRef.current = null;

    const mimeType = getSupportedRecorderMimeType();
    if (!mimeType && typeof MediaRecorder === 'undefined') {
      showModal('Unsupported', 'Audio recording is not supported in this browser. Please use Chrome or Edge.', 'error');
      return null;
    }
    recordMimeTypeRef.current = mimeType || 'audio/webm';

    try {
      const { stream, hasVideo: withVideo } = await acquireInterviewMediaStream();
      micStreamRef.current = stream;
      setHasVideo(withVideo);
      if (withVideo && stream.getVideoTracks().length > 0) {
        attachCameraPreview(stream);
      } else {
        setCameraReady(false);
      }
      return stream;
    } catch (err) {
      showModal('Microphone', err.message || 'Could not access microphone.', 'error');
      return null;
    }
  }, [showModal, attachCameraPreview]);

  const finishCapture = useCallback(async () => {
    if (!isCapturingRef.current || transcribeInFlightRef.current || isSubmittingRef.current) return;
    if (isAiSpeakingRef.current) return;

    isCapturingRef.current = false;
    stopVadLoop();
    setIsListening(false);
    isListeningRef.current = false;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      const empty = (transcriptRef.current || '').trim();
      if (empty.length >= MIN_TRANSCRIPT_LENGTH) {
        await autoSubmitAnswer(empty);
      } else {
        await autoSubmitAnswer('', true);
      }
      return;
    }

    await new Promise((resolve) => {
      let settled = false;
      const handleStop = async () => {
        if (settled) return;
        settled = true;
        recorder.removeEventListener('stop', handleStop);
        const blobType = recorder._usedMimeType || recordMimeTypeRef.current || 'audio/webm';
        const blob = new Blob(recordChunksRef.current, { type: blobType });
        recordChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (blob.size < MIN_AUDIO_BYTES || !hasSpeechRef.current) {
          await autoSubmitAnswer('', true);
          resolve();
          return;
        }

        const text = await transcribeRecording(blob);
        if (text.length >= MIN_TRANSCRIPT_LENGTH) {
          await autoSubmitAnswer(text);
        } else {
          await autoSubmitAnswer(text, true);
        }
        resolve();
      };
      recorder.addEventListener('stop', handleStop);
      try {
        recorder.stop();
      } catch (e) {
        recorder.removeEventListener('stop', handleStop);
        void handleStop();
      }
    });
  }, [stopVadLoop, autoSubmitAnswer, transcribeRecording]);

  useEffect(() => {
    finishCaptureRef.current = finishCapture;
  }, [finishCapture]);

  const setupVadAnalyser = useCallback((stream) => {
    const audioTrack = stream.getAudioTracks()[0];
    const trackId = audioTrack?.id || '';
    if (vadAnalyserRef.current && vadStreamTrackIdRef.current === trackId) {
      return;
    }
    if (vadAudioContextRef.current) {
      vadAudioContextRef.current.close().catch(() => {});
    }
    const vadCtx = new AudioContext();
    const source = vadCtx.createMediaStreamSource(stream);
    const analyser = vadCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    vadAudioContextRef.current = vadCtx;
    vadAnalyserRef.current = analyser;
    vadStreamTrackIdRef.current = trackId;
  }, []);

  const runVadLoop = useCallback(() => {
    const analyser = vadAnalyserRef.current;
    if (!analyser || !isCapturingRef.current) return;

    const rms = computeRms(analyser);
    const now = Date.now();

    if (rms >= SPEECH_RMS_THRESHOLD) {
      hasSpeechRef.current = true;
      lastSpeechAtRef.current = now;
      setIsUserSpeaking(true);
    } else {
      setIsUserSpeaking(false);
    }

    const recordDuration = now - captureStartedAtRef.current;
    if (recordDuration >= MAX_RECORD_MS) {
      finishCaptureRef.current?.();
      return;
    }

    if (
      hasSpeechRef.current
      && recordDuration >= MIN_RECORD_MS
      && now - lastSpeechAtRef.current >= SILENCE_MS_BEFORE_AUTO_SUBMIT
    ) {
      finishCaptureRef.current?.();
      return;
    }

    vadFrameRef.current = requestAnimationFrame(runVadLoop);
  }, []);

  const startListening = useCallback(async () => {
    if (isCapturingRef.current || isAiSpeakingRef.current || isSubmittingRef.current) return;
    if (!sessionId) return;

    try {
      const stream = await ensureMediaStream();
      if (!stream) return;

      setTranscript('');
      transcriptRef.current = '';
      hasSpeechRef.current = false;
      lastSpeechAtRef.current = Date.now();
      captureStartedAtRef.current = Date.now();
      recordChunksRef.current = [];

      if (!stream.getAudioTracks().length) {
        throw new Error('Microphone track is missing. Allow microphone access and try again.');
      }

      if (mediaRecorderRef.current) {
        await waitForRecorderInactive(mediaRecorderRef.current);
        mediaRecorderRef.current = null;
      }

      setupVadAnalyser(stream);
      if (vadAudioContextRef.current?.state === 'suspended') {
        await vadAudioContextRef.current.resume();
      }

      const recorder = createAnswerMediaRecorder(stream);
      recordMimeTypeRef.current = recorder._usedMimeType || recordMimeTypeRef.current;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onerror = (event) => {
        const errMsg = event?.error?.message || 'Recording error';
        showModal('Microphone', `${errMsg}. Refresh the page and try again.`, 'error');
        stopListening();
      };

      mediaRecorderRef.current = recorder;
      isCapturingRef.current = true;
      isListeningRef.current = true;
      setIsListening(true);

      startAnswerRecorder(recorder, 500);
      runVadLoop();
    } catch (e) {
      mediaRecorderRef.current = null;
      isCapturingRef.current = false;
      const msg = e?.message || 'Could not start microphone. Check permissions and try again.';
      showModal('Microphone', msg, 'error');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [sessionId, ensureMediaStream, runVadLoop, showModal, stopListening, setupVadAnalyser]);

  const onAiSpeechFinished = useCallback(() => {
    isAiSpeakingRef.current = false;
    setIsAiSpeaking(false);
    setIsPreparingSpeech(false);
    if (shouldListenRef.current && !isSubmittingRef.current) {
      startListening();
    }
  }, [startListening]);

  const speakWithBrowserFallback = useCallback((text) => {
    setUsesBrowserTts(true);
    setIsPreparingSpeech(false);
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    if (!window.speechSynthesis) {
      onAiSpeechFinished();
      return;
    }
    const voices = window.speechSynthesis.getVoices() || [];
    const preferred = ['Samantha', 'Karen', 'Victoria', 'Google UK English Female', 'Microsoft Zira', 'Fiona'];
    const en = voices.filter(v => v.lang?.startsWith('en'));
    const voice = en.find(v => preferred.some(n => v.name.includes(n)))
      || en.find(v => /female/i.test(v.name))
      || en.find(v => /en-us|en-gb/i.test(v.lang))
      || voices[0];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || 'en-US';
    if (voice) utterance.voice = voice;
    utterance.rate = 1.08;
    utterance.onend = onAiSpeechFinished;
    utterance.onerror = onAiSpeechFinished;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [onAiSpeechFinished]);

  useEffect(() => {
    if (!usesBrowserTts) return undefined;
    return () => setUsesBrowserTts(false);
  }, [usesBrowserTts, currentQuestion?.spokenText, currentQuestion?.questionText]);

  const parseSpeakResponse = useCallback(async (response) => {
    let blob = response.data;
    if (blob?.type?.includes('json')) {
      const errText = await blob.text();
      let message = 'Could not load interviewer voice';
      try {
        message = JSON.parse(errText).message || message;
      } catch (e) {}
      throw new Error(message);
    }
    if (!(blob instanceof Blob) || blob.size < 64) {
      throw new Error('Interviewer audio was empty. Check OpenAI API key on server.');
    }
    const mediaKind = response.headers?.['x-interview-media']
      || (blob.type?.includes('video') ? 'talking-video' : 'audio');
    return { blob, mediaKind };
  }, []);

  const prefetchSpeech = useCallback(async (text, activeSessionId) => {
    const trimmed = text?.trim();
    const sid = activeSessionId || sessionId;
    if (!trimmed || !sid) return false;

    if (prefetchedSpeechRef.current?.text === trimmed) {
      return true;
    }

    prefetchAbortRef.current?.abort();
    const controller = new AbortController();
    prefetchAbortRef.current = controller;

    try {
      const response = await axiosInstance.post(
        `/interview-sessions/${sid}/speak`,
        { text: trimmed, video: true },
        { responseType: 'blob', signal: controller.signal }
      );
      if (controller.signal.aborted) return false;
      const { blob, mediaKind } = await parseSpeakResponse(response);
      prefetchedSpeechRef.current = { text: trimmed, blob, mediaKind };
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      prefetchedSpeechRef.current = null;
      return false;
    }
  }, [sessionId, parseSpeakResponse]);

  const playInterviewerAudio = useCallback(async (audio) => {
    audio.volume = 1;
    try {
      await audio.play();
      return true;
    } catch (playErr) {
      try {
        await new Promise((resolve) => {
          const unlock = () => {
            document.removeEventListener('click', unlock);
            document.removeEventListener('keydown', unlock);
            resolve();
          };
          showModal(
            'Enable sound',
            'Click OK or tap anywhere on the page to hear your interviewer.',
            'info'
          );
          document.addEventListener('click', unlock, { once: true });
          document.addEventListener('keydown', unlock, { once: true });
        });
        await audio.play();
        return true;
      } catch (e2) {
        return false;
      }
    }
  }, [showModal]);

  const waitForVideoElement = useCallback(async (maxMs = 4000) => {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      if (aiVideoRef.current) return aiVideoRef.current;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return null;
  }, []);

  const playSpeechFromBlob = useCallback(async (blob, mediaKind, text) => {
    if (mediaKind === 'talking-video') {
      let videoBlob = blob;
      if (!videoBlob.type || videoBlob.type === 'application/octet-stream') {
        videoBlob = new Blob([videoBlob], { type: 'video/mp4' });
      }
      const url = URL.createObjectURL(videoBlob);
      aiVideoUrlRef.current = url;
      setIsPreparingSpeech(true);
      setInterviewerVideoUrl(url);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      const video = await waitForVideoElement();
      if (!video) throw new Error('Video player not ready');

      video.src = url;
      video.onplay = () => {
        setIsPreparingSpeech(false);
        setIsAiSpeaking(true);
        lipSyncStopRef.current?.();
        lipSyncStopRef.current = attachAudioLipSync(video, handleSpeechFrame);
        bindSpeechProgress(video);
      };
      video.onended = () => {
        lipSyncStopRef.current?.();
        lipSyncStopRef.current = null;
        speechProgressUnbindRef.current?.();
        setLipLevel(0);
        setViseme(0);
        setSpeechProgress(0);
        onAiSpeechFinished();
      };
      video.onerror = () => {
        stopAiAudio();
        speakWithBrowserFallback(text);
      };

      try {
        await video.play();
      } catch (playErr) {
        stopAiAudio();
        speakWithBrowserFallback(text);
      }
      return;
    }

    let audioBlob = blob;
    if (!audioBlob.type || audioBlob.type === 'application/octet-stream') {
      audioBlob = new Blob([audioBlob], { type: 'audio/mpeg' });
    }
    setInterviewerVideoUrl('');

    const url = URL.createObjectURL(audioBlob);
    aiAudioUrlRef.current = url;
    const audio = new Audio(url);
    aiAudioRef.current = audio;

    audio.onplay = () => {
      setIsPreparingSpeech(false);
      setIsAiSpeaking(true);
      setSpeechProgress(0);
      lipSyncStopRef.current?.();
      lipSyncStopRef.current = attachAudioLipSync(audio, handleSpeechFrame);
      bindSpeechProgress(audio);
    };
    audio.onended = () => {
      lipSyncStopRef.current?.();
      lipSyncStopRef.current = null;
      speechProgressUnbindRef.current?.();
      setLipLevel(0);
      setViseme(0);
      setSpeechProgress(0);
      onAiSpeechFinished();
    };
    audio.onerror = () => {
      stopAiAudio();
      speakWithBrowserFallback(text);
    };

    const played = await playInterviewerAudio(audio);
    if (!played) {
      stopAiAudio();
      speakWithBrowserFallback(text);
    }
  }, [
    stopAiAudio,
    onAiSpeechFinished,
    speakWithBrowserFallback,
    playInterviewerAudio,
    handleSpeechFrame,
    bindSpeechProgress,
    waitForVideoElement
  ]);

  const speakQuestion = useCallback(async (text, activeSessionId) => {
    const trimmed = text?.trim();
    const sid = activeSessionId || sessionIdRef.current || sessionId;
    if (!trimmed || !sid) return;

    stopAiAudio();
    setUsesBrowserTts(false);
    isAiSpeakingRef.current = true;
    setIsAiSpeaking(false);
    setLipLevel(0);
    setViseme(0);
    setSpeechProgress(0);
    stopListening();

    const cached = prefetchedSpeechRef.current;
    if (cached?.text === trimmed && cached.blob) {
      prefetchedSpeechRef.current = null;
      setIsPreparingSpeech(false);
      try {
        await playSpeechFromBlob(cached.blob, cached.mediaKind, trimmed);
      } catch (error) {
        isAiSpeakingRef.current = false;
        stopAiAudio();
        speakWithBrowserFallback(trimmed);
      }
      return;
    }

    setIsPreparingSpeech(true);
    const controller = new AbortController();
    speakAbortRef.current = controller;

    try {
      const response = await axiosInstance.post(
        `/interview-sessions/${sid}/speak`,
        { text: trimmed, video: true },
        { responseType: 'blob', signal: controller.signal }
      );
      if (controller.signal.aborted) {
        isAiSpeakingRef.current = false;
        return;
      }
      const { blob, mediaKind } = await parseSpeakResponse(response);
      await playSpeechFromBlob(blob, mediaKind, trimmed);
    } catch (error) {
      if (controller.signal.aborted) {
        isAiSpeakingRef.current = false;
        return;
      }
      const msg = error.response?.data?.message || error.message || 'Voice playback failed';
      if (error.response?.status) {
        showModal('Interviewer voice', msg, 'error');
      }
      isAiSpeakingRef.current = false;
      stopAiAudio();
      speakWithBrowserFallback(trimmed);
    }
  }, [
    sessionId,
    stopListening,
    stopAiAudio,
    speakWithBrowserFallback,
    playSpeechFromBlob,
    parseSpeakResponse,
    showModal
  ]);

  useEffect(() => {
    if (!isInterviewActive) return;
    const sid = sessionIdRef.current || sessionId;
    if (!sid) return;

    const pendingJoin = joinSpeakPendingRef.current;
    if (pendingJoin) {
      joinSpeakPendingRef.current = null;
      lastSpokenQuestionRef.current = pendingJoin;
      speakQuestion(pendingJoin, sid);
      return;
    }

    const speechText = getQuestionSpeechText(currentQuestion);
    if (!speechText) return;
    if (lastSpokenQuestionRef.current === speechText) return;
    lastSpokenQuestionRef.current = speechText;
    speakQuestion(speechText, sid);
  }, [currentQuestion, isInterviewActive, sessionId, speakQuestion]);

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {});
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen().catch(() => {});
      else if (el.msRequestFullscreen) el.msRequestFullscreen().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!isInterviewActive || !sessionId || submittedRef.current) return;
    const submitAndLeave = () => {
      if (leaveSubmitHandledRef.current) return;
      leaveSubmitHandledRef.current = true;
      submittedRef.current = true;
      stopListening();
      (async () => {
        try {
          await axiosInstance.post(`/interview-sessions/${sessionId}/submit`);
        } catch (e) {}
        navigate(`/student/interviews/feedback/${sessionId}`);
      })();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      submitAndLeave();
    };
    const handleBlur = () => {
      setTimeout(() => {
        if (document.hidden && !leaveSubmitHandledRef.current) submitAndLeave();
      }, 300);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isInterviewActive, sessionId, navigate, stopListening]);

  useEffect(() => {
    if (usesBrowserTts && isAiSpeaking) {
      lipSyncStopRef.current?.();
      lipSyncStopRef.current = runSimulatedLipSync(true, handleSpeechFrame);
      const started = Date.now();
      const estMs = Math.max(3000, (getQuestionSpeechText(currentQuestion)?.length || 40) * 48);
      const tick = setInterval(() => {
        setSpeechProgress(Math.min(1, (Date.now() - started) / estMs));
      }, 80);
      return () => {
        clearInterval(tick);
        lipSyncStopRef.current?.();
        lipSyncStopRef.current = null;
        setLipLevel(0);
        setViseme(0);
        setSpeechProgress(0);
      };
    }
    return undefined;
  }, [usesBrowserTts, isAiSpeaking, handleSpeechFrame, currentQuestion]);

  const handleStartInterview = useCallback(async () => {
    if (isJoining || !interview) return;
    setIsJoining(true);
    setErrorStarting(null);
    prefetchedSpeechRef.current = null;
    lastSpokenQuestionRef.current = '';

    try {
      setPrepareLabel('Creating your interview session…');
      let sessionData;
      try {
        sessionData = await startInterviewSession();
      } catch (error) {
        if (error.response?.status === 403 && error.response?.data?.alreadyAttempted && error.response?.data?.lastSessionId) {
          window.location.href = `/student/interviews/feedback/${error.response.data.lastSessionId}`;
          return;
        }
        const msg = error.response?.data?.message || 'Failed to start interview';
        setErrorStarting(msg);
        showModal('Cannot start', msg, 'error');
        return;
      }

      const question = sessionData.currentQuestion;
      const speechText = getQuestionSpeechText(question);

      setPrepareLabel('Setting up camera and microphone…');
      const stream = await ensureMediaStream();
      if (!stream) return;

      if (speechText) {
        setPrepareLabel('Preparing interviewer voice…');
        await prefetchSpeech(speechText, sessionData.sessionId);
      }

      requestFullscreen();
      shouldListenRef.current = true;

      sessionIdRef.current = sessionData.sessionId;
      joinSpeakPendingRef.current = speechText || null;

      flushSync(() => {
        setIsInterviewActive(true);
      });

      if (!speechText && !question?.questionText) {
        startListening();
      }
    } finally {
      setIsJoining(false);
      setPrepareLabel('');
    }
  }, [
    isJoining,
    interview,
    startInterviewSession,
    ensureMediaStream,
    requestFullscreen,
    startListening,
    prefetchSpeech,
    showModal
  ]);

  const canJoinRoom = Boolean(interview) && !isJoining && !loading;

  const interviewerStatus = useMemo(() => {
    if (isPreparingSpeech) return 'Preparing to speak...';
    if (isAiSpeaking) return 'Speaking';
    if (isTranscribing) return 'Processing your answer...';
    if (isSubmitting) return 'Thinking of next question...';
    if (isListening) return 'Listening to you';
    if (isInterviewActive) return 'Connected';
    return 'Waiting to start';
  }, [isPreparingSpeech, isAiSpeaking, isTranscribing, isSubmitting, isListening, isInterviewActive]);

  const handleEndInterview = useCallback(async () => {
    shouldListenRef.current = false;
    if (isCapturingRef.current) {
      await finishCapture();
    } else {
      stopListening();
    }
    const finalText = (transcriptRef.current || '').trim();
    if (finalText.length >= MIN_TRANSCRIPT_LENGTH && sessionId && !submittedRef.current) {
      try {
        setIsSubmitting(true);
        const response = await axiosInstance.post(`/interview-sessions/${sessionId}/answer`, { transcript: finalText });
        if (response.data.completed) {
          submittedRef.current = true;
          await axiosInstance.post(`/interview-sessions/${sessionId}/submit`);
          navigate(`/student/interviews/feedback/${sessionId}`);
          return;
        }
      } catch (e) {
        showModal('Error', e.response?.data?.message || 'Failed to submit', 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
    if (sessionId && !submittedRef.current) {
      try {
        await axiosInstance.post(`/interview-sessions/${sessionId}/submit`);
      } catch (e) {}
      navigate(`/student/interviews/feedback/${sessionId}`);
    }
  }, [sessionId, stopListening, navigate, showModal, finishCapture]);

  const handleManualSubmit = useCallback(async () => {
    if (isCapturingRef.current) {
      await finishCapture();
      return;
    }
    const finalAnswer = (transcriptRef.current || '').trim();
    if (finalAnswer.length >= MIN_TRANSCRIPT_LENGTH) {
      autoSubmitAnswer(finalAnswer);
    } else {
      showModal('Add your answer', 'Speak your answer first. When you pause, we transcribe and submit automatically, or click Submit.', 'info');
    }
  }, [autoSubmitAnswer, showModal, finishCapture]);

  if (loading && !interview) {
    return (
      <div className="interview-room interview-room-loading">
        <div className="loading-spinner" />
        <p>Loading interview…</p>
      </div>
    );
  }

  if (errorStarting && !isInterviewActive) {
    return (
      <div className="interview-room">
        <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
          <p>{modal.message}</p>
        </Modal>
        <div className="interview-room-error-state">
          <h2>Could not start interview</h2>
          <p>{errorStarting}</p>
          <button className="btn btn-primary" onClick={() => navigate('/student/tests/interview')}>
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  const currentQuestionNum = answerCount + 1;
  const displayTotal = Math.max(totalQuestions, currentQuestionNum);
  const isAiTalking = isAiSpeaking || isPreparingSpeech;
  const interviewerSpeechText = isAiSpeaking ? getQuestionSpeechText(currentQuestion) : '';

  return (
    <div className={`interview-room ${isInterviewActive ? 'interview-room--live' : ''}`}>
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <header className="interview-room-header">
        <div className="interview-header-info">
          <h1>{interview?.title || 'Interview'}</h1>
          <p>{interview?.interviewType} · {interview?.topic} · {interview?.difficulty}</p>
        </div>
        <div className="interview-header-actions">
          {isInterviewActive && <span className="interview-live-badge">Live</span>}
          {isInterviewActive && (
            <div className="interview-timer">
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          )}
          {isInterviewActive && currentQuestion?.questionText && (
            <span className="interview-progress-badge">Q {currentQuestionNum} of {displayTotal}</span>
          )}
          {!isInterviewActive ? (
            <button
              type="button"
              className="btn btn-primary btn-start"
              onClick={handleStartInterview}
              disabled={!canJoinRoom}
            >
              {isJoining ? 'Joining…' : 'Join interview'}
            </button>
          ) : (
            <button type="button" className="btn btn-danger btn-end" onClick={handleEndInterview} disabled={isSubmitting}>
              Leave interview
            </button>
          )}
        </div>
      </header>

      {!isInterviewActive ? (
        <div className="interview-pre-start">
          <div className="interview-pre-start-card">
          <span className="interview-pre-start-badge">Live mock interview</span>
          <h2>Join your video interview</h2>
          <p>
            Meet your AI interviewer on the main screen with your camera beside it — the same layout as Zoom or Google Meet.
            Allow camera and microphone when prompted.
          </p>
          <ul className="interview-pre-start-checklist">
            <li>Quiet room and stable internet</li>
            <li>Look at the camera when you answer</li>
            <li>Pause when finished — your answer is submitted automatically</li>
          </ul>
          <div className={`interview-prepare-status ${isJoining ? 'is-busy' : 'is-idle'}`}>
            {isJoining ? (
              <>
                <span className="interview-prepare-spinner" aria-hidden="true" />
                {prepareLabel || 'Setting up your interview…'}
              </>
            ) : (
              <>
                <span className="interview-prepare-dot idle" />
                Click Join when ready — we only start the session, camera, and voice after you click.
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-start interview-pre-start-cta"
            onClick={handleStartInterview}
            disabled={!canJoinRoom}
          >
            {isJoining ? 'Setting up…' : 'Join interview room'}
          </button>
          </div>
        </div>
      ) : (
        <div className="interview-live-body">
          <div className="interview-call-stage">
            <section className="interview-call-main" aria-label="Interviewer">
              <div className="interview-panel-tag interview-panel-tag--ai">
                <span className="interview-panel-tag-dot" />
                Sarah Chen
              </div>
              <div className="interview-call-main-inner">
                <InterviewerAvatar
                  compact
                  lipLevel={lipLevel}
                  viseme={viseme}
                  speechProgress={speechProgress}
                  isSpeaking={isAiSpeaking}
                  isLoadingVoice={isPreparingSpeech}
                  isListening={isListening && !isAiTalking}
                  speakingText={interviewerSpeechText}
                  showSpeechBubble={false}
                  videoSrc={interviewerVideoUrl}
                  videoRef={aiVideoRef}
                  statusLabel={interviewerStatus}
                  name="Sarah Chen"
                  role={`${interview?.interviewType || 'Technical'} Interviewer`}
                />
              </div>
            </section>

            <aside className="interview-pip" aria-label="Your camera">
              <div className="interview-panel-tag interview-panel-tag--you">
                <span className="interview-panel-tag-dot" />
                You
              </div>
              <div className={`interview-pip-frame ${isListening ? 'is-live' : ''}`}>
                <div className="interview-pip-video-wrap">
                  <video
                    ref={cameraVideoRef}
                    className={`interview-pip-video ${cameraReady ? 'is-ready' : ''}`}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!cameraReady && (
                    <div className="interview-pip-placeholder">
                      <div className="interview-pip-placeholder-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span>{hasVideo ? 'Starting camera...' : 'Mic only'}</span>
                    </div>
                  )}
                  <div className="interview-pip-video-shade" aria-hidden="true" />
                  <div className="interview-rec-badge" aria-label="Recording in progress">
                    <svg className="interview-rec-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="5" fill="currentColor" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                    </svg>
                    <span className="interview-rec-dot" />
                    REC
                  </div>
                  <div className={`interview-pip-speaking-ring ${isUserSpeaking && isListening ? 'active' : ''}`} />
                  <div className={`interview-pip-waveform ${isUserSpeaking && isListening ? 'visible' : ''}`}>
                    {[...Array(5)].map((_, i) => <span key={i} />)}
                  </div>
                  <div className="interview-pip-bar">
                    <span className="interview-pip-name">Your video</span>
                    <span className={`interview-pip-mic ${isListening ? 'is-live' : ''}`}>
                      <span className="interview-pip-mic-icon" aria-hidden="true" />
                      {isListening ? 'Mic on' : 'Waiting'}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <section
            className={`interview-question-bar ${isAiTalking ? 'is-speaking' : ''}`}
            aria-label="Current question"
          >
            {lastAcknowledgment && !isAiTalking && (
              <p className="interview-ack-strip">{lastAcknowledgment}</p>
            )}
            <div className="interview-question-meta">
              <span className="question-label">
                {currentQuestion?.isFollowUp ? 'Follow-up' : `Question ${currentQuestionNum}`}
              </span>
              <span className="interview-question-counter">
                {currentQuestionNum} / {displayTotal}
              </span>
            </div>
            <p className="question-text">
              {currentQuestion?.questionText || 'Preparing your next question...'}
            </p>
          </section>

          <div className="interview-call-controls">
            <div className="interview-dock">
            <p className="interview-call-hint">
              {isListening
                ? 'Speak naturally. When you finish, pause briefly or tap the button below.'
                : isAiTalking
                  ? 'Listen to your interviewer...'
                  : isTranscribing || isSubmitting
                    ? 'Please wait...'
                    : 'Get ready for the next question.'}
            </p>
            <button
              type="button"
              className="btn-done-speaking"
              onClick={handleManualSubmit}
              disabled={!isListening || isSubmitting || isTranscribing || isAiTalking}
            >
              {isTranscribing ? 'Processing...' : isSubmitting ? 'Please wait...' : "I'm done speaking"}
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockInterviewRoom;
