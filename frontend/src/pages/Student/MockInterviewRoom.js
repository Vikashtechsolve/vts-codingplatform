import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './MockInterviewRoom.css';

const MIN_TRANSCRIPT_LENGTH = 2;
const SILENCE_MS_BEFORE_AUTO_SUBMIT = 2200;

function getBestTranscript(result) {
  if (!result || !result.length) return '';
  let best = result[0]?.transcript || '';
  let bestConf = result[0]?.confidence ?? 0;
  for (let j = 1; j < result.length; j++) {
    const c = result[j]?.confidence ?? 0;
    if (c > bestConf) {
      bestConf = c;
      best = result[j]?.transcript || '';
    }
  }
  return best;
}

const MockInterviewRoom = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const silenceTimerRef = useRef(null);
  const submittedRef = useRef(false);
  const isListeningRef = useRef(false);
  const shouldListenRef = useRef(false);
  const lastSpokenQuestionRef = useRef('');
  const isAiSpeakingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const leaveSubmitHandledRef = useRef(false);

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
  const [availableVoices, setAvailableVoices] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorStarting, setErrorStarting] = useState(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  useEffect(() => {
    interimRef.current = interimTranscript;
  }, [interimTranscript]);
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
    let cancelled = false;
    const init = async () => {
      try {
        setLoading(true);
        setErrorStarting(null);
        const interviewRes = await axiosInstance.get(`/interviews/${interviewId}`);
        if (cancelled) return;
        setInterview(interviewRes.data);
        const sessionRes = await axiosInstance.post(`/interview-sessions/start/${interviewId}`);
        if (cancelled) return;
        setSessionId(sessionRes.data.sessionId);
        setCurrentQuestion(sessionRes.data.currentQuestion);
        setTotalQuestions(sessionRes.data.totalQuestions || interviewRes.data.questionCount || 8);
        setTimeRemaining((sessionRes.data.timeLimit || interviewRes.data.duration || 20) * 60);
      } catch (error) {
        if (cancelled) return;
        if (error.response?.status === 403 && error.response?.data?.alreadyAttempted && error.response?.data?.lastSessionId) {
          window.location.href = `/student/interviews/feedback/${error.response.data.lastSessionId}`;
          return;
        }
        const msg = error.response?.data?.message || 'Failed to start interview';
        setErrorStarting(msg);
        setModal({ isOpen: true, title: 'Cannot start', message: msg, type: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [interviewId]);

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

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices() || []);
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const autoSubmitAnswer = useCallback(async (textOverride, allowEmpty = false) => {
    if (isSubmitting || !isInterviewActive || submittedRef.current) return;
    if (isAiSpeakingRef.current) return;
    const raw = textOverride != null ? String(textOverride).trim() : ((transcriptRef.current || '').trim() + ' ' + (interimRef.current || '').trim()).trim();
    const finalAnswer = raw;
    if (!allowEmpty && (!finalAnswer || finalAnswer.length < MIN_TRANSCRIPT_LENGTH)) return;
    stopListening();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try {
      setIsSubmitting(true);
      const response = await axiosInstance.post(`/interview-sessions/${sessionId}/answer`, { transcript: finalAnswer });
      setTranscript('');
      setInterimTranscript('');
      transcriptRef.current = '';
      interimRef.current = '';
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

  const scheduleAutoSubmit = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (isAiSpeakingRef.current || isSubmittingRef.current) {
        silenceTimerRef.current = null;
        return;
      }
      const combined = (transcriptRef.current || '').trim() + ' ' + (interimRef.current || '').trim();
      const trimmed = combined.trim();
      if (trimmed.length >= MIN_TRANSCRIPT_LENGTH) {
        autoSubmitAnswer(trimmed);
      } else {
        autoSubmitAnswer(trimmed, true);
      }
      silenceTimerRef.current = null;
    }, SILENCE_MS_BEFORE_AUTO_SUBMIT);
  }, [autoSubmitAnswer]);

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showModal('Unsupported', 'Speech recognition is not supported in this browser.', 'error');
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const best = getBestTranscript(result);
        if (result.isFinal) {
          finalText += best;
        } else {
          interimText += best;
        }
      }
      if (finalText) {
        setTranscript(prev => (prev + ' ' + finalText).trim());
        transcriptRef.current = (transcriptRef.current + ' ' + finalText).trim();
        setIsUserSpeaking(true);
        setTimeout(() => setIsUserSpeaking(false), 1200);
        scheduleAutoSubmit();
      }
      if (interimText) {
        setInterimTranscript(interimText.trim());
        interimRef.current = interimText.trim();
        setIsUserSpeaking(true);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isAiSpeakingRef.current || isSubmittingRef.current) return;
      const combined = (transcriptRef.current || '').trim() + ' ' + (interimRef.current || '').trim();
      const trimmed = combined.trim();
      if (trimmed.length >= MIN_TRANSCRIPT_LENGTH) {
        autoSubmitAnswer(trimmed);
      } else {
        autoSubmitAnswer(trimmed, true);
      }
      setInterimTranscript('');
      interimRef.current = '';
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        showModal('Microphone', 'Microphone access was denied. Please allow mic and refresh.', 'error');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onstart = () => setIsListening(true);

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
      showModal('Microphone', 'Could not start microphone. Please allow access and try again.', 'error');
    }
  }, [scheduleAutoSubmit, autoSubmitAnswer, showModal]);

  const pickBestVoice = () => {
    if (!availableVoices.length) return null;
    const preferred = ['Google UK English Male', 'Google US English', 'Microsoft David', 'Microsoft Mark', 'David', 'Mark', 'Male'];
    const en = availableVoices.filter(v => v.lang?.startsWith('en'));
    return en.find(v => preferred.some(n => v.name.toLowerCase().includes(n.toLowerCase())) || v.name.toLowerCase().includes('male'))
      || en.find(v => /en-us|en-gb/i.test(v.lang)) || availableVoices[0];
  };

  const speakQuestion = useCallback((text) => {
    if (!window.speechSynthesis || !text?.trim()) return;
    isAiSpeakingRef.current = true;
    setIsAiSpeaking(true);
    stopListening();
    const voice = pickBestVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || 'en-US';
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => {
      setIsAiSpeaking(false);
      if (shouldListenRef.current && !isSubmittingRef.current) startRecognition();
    };
    utterance.onerror = () => setIsAiSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pickBestVoice is stable
  }, [availableVoices, startRecognition, stopListening]);

  useEffect(() => {
    if (!currentQuestion?.questionText || !isInterviewActive) return;
    const text = currentQuestion.questionText.trim();
    if (lastSpokenQuestionRef.current === text) return;
    lastSpokenQuestionRef.current = text;
    speakQuestion(text);
  }, [currentQuestion?.questionText, isInterviewActive, speakQuestion]);

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

  const handleStartInterview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      showModal('Microphone', 'Please allow microphone access to start the interview.', 'error');
      return;
    }
    requestFullscreen();
    shouldListenRef.current = true;
    setIsInterviewActive(true);
    if (!currentQuestion?.questionText) {
      startRecognition();
    }
  }, [currentQuestion?.questionText, startRecognition, showModal, requestFullscreen]);

  const handleEndInterview = useCallback(async () => {
    shouldListenRef.current = false;
    stopListening();
    const finalText = (transcriptRef.current || '').trim() || (interimRef.current || '').trim();
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
  }, [sessionId, stopListening, navigate, showModal]);

  const handleManualSubmit = useCallback(() => {
    const finalAnswer = (transcriptRef.current || '').trim() || (interimRef.current || '').trim();
    if (finalAnswer.length >= MIN_TRANSCRIPT_LENGTH) {
      autoSubmitAnswer(finalAnswer);
    } else {
      showModal('Add your answer', 'Speak your answer first. When you stop speaking, it will be submitted automatically, or click Submit.', 'info');
    }
  }, [autoSubmitAnswer, showModal]);

  if (loading && !interview && !errorStarting) {
    return (
      <div className="interview-room interview-room-loading">
        <div className="loading-spinner" />
        <p>Starting your interview...</p>
      </div>
    );
  }

  if (errorStarting && !sessionId) {
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
  const displayTranscript = (transcript || '').trim() || interimTranscript;

  return (
    <div className="interview-room">
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <header className="interview-room-header">
        <div className="interview-header-info">
          <h1>{interview?.title || 'Interview'}</h1>
          <p>{interview?.interviewType} · {interview?.topic} · {interview?.difficulty}</p>
        </div>
        <div className="interview-header-actions">
          <div className="interview-timer">
            {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
          </div>
          {currentQuestion?.questionText && (
            <span className="interview-progress-badge">Q {currentQuestionNum} of {displayTotal}</span>
          )}
          {!isInterviewActive ? (
            <button className="btn btn-primary btn-start" onClick={handleStartInterview}>
              Start Interview
            </button>
          ) : (
            <button className="btn btn-danger btn-end" onClick={handleEndInterview} disabled={isSubmitting}>
              End Interview
            </button>
          )}
        </div>
      </header>

      <div className="interview-room-body">
        <section className="interviewer-section">
          <div className={`interviewer-avatar ${isAiSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}>
            <div className="avatar-ring" />
            <svg className="interviewer-avatar-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              {/* Head */}
              <ellipse cx="100" cy="98" rx="72" ry="78" className="avatar-head" />
              {/* Neck / shoulders */}
              <path d="M 55 168 Q 55 185 75 192 L 125 192 Q 145 185 145 168" className="avatar-neck" />
              {/* Left ear - listening cue */}
              <ellipse cx="28" cy="98" rx="10" ry="14" className="avatar-ear" />
              {/* Right ear */}
              <ellipse cx="172" cy="98" rx="10" ry="14" className="avatar-ear" />
              {/* Eyes - attentive, looking at viewer */}
              <ellipse cx="72" cy="88" rx="12" ry="10" className="avatar-eye" />
              <ellipse cx="128" cy="88" rx="12" ry="10" className="avatar-eye" />
              <circle cx="72" cy="88" r="4" className="avatar-pupil" />
              <circle cx="128" cy="88" r="4" className="avatar-pupil" />
              {/* Mouth - neutral when idle, slight smile when listening */}
              <path d="M 78 122 Q 100 132 122 122" strokeLinecap="round" className={`avatar-mouth ${isListening ? 'listening' : ''}`} />
              {/* Listening waves - visible when we are listening to you */}
              {isListening && (
                <>
                  <path d="M 8 98 Q 18 88 28 98 Q 18 108 8 98" className="avatar-wave wave-1" />
                  <path d="M 172 98 Q 182 88 192 98 Q 182 108 172 98" className="avatar-wave wave-2" />
                  <path d="M 0 98 Q 12 85 24 98 Q 12 111 0 98" className="avatar-wave wave-3" />
                  <path d="M 176 98 Q 188 85 200 98 Q 188 111 176 98" className="avatar-wave wave-4" />
                </>
              )}
            </svg>
          </div>
          <h2 className="interviewer-name">Your interviewer</h2>
          <p className="interviewer-hint">Listen to the question, then answer. The mic turns on as soon as the interviewer finishes — you can speak right away. When you pause, your answer is submitted automatically.</p>
          <div className={`interviewer-status ${isAiSpeaking ? 'asking' : isListening ? 'listening' : ''}`}>
            {isAiSpeaking ? 'Asking question...' : isListening ? 'Listening to you...' : isInterviewActive ? 'Ready' : '—'}
          </div>
          <div className={`mic-indicator ${isListening ? 'on' : 'off'}`}>
            {isListening ? '🎤 Mic on' : '🎤 Mic off'}
          </div>
        </section>

        <section className="content-section">
          <div className="question-card">
            <span className="question-label">Question {currentQuestionNum}</span>
            <p className="question-text">{currentQuestion?.questionText || 'Waiting for next question...'}</p>
          </div>

          <div className="answer-area">
            <div className="answer-label">Your answer (speak below)</div>
            <div className="answer-captions">
              {displayTranscript || 'Start speaking — your answer will be submitted automatically when you pause, or use Submit.'}
            </div>
            <div className={`waveform-bars ${isUserSpeaking ? 'active' : ''}`}>
              {[...Array(10)].map((_, i) => <span key={i} />)}
            </div>
          </div>

          <div className="answer-actions">
            <button
              type="button"
              className="btn btn-secondary btn-submit"
              onClick={handleManualSubmit}
              disabled={isSubmitting || !isInterviewActive || !currentQuestion?.questionText}
            >
              {isSubmitting ? 'Submitting...' : 'Submit & next question'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MockInterviewRoom;
