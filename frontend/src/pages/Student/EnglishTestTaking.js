import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import Modal from '../../components/Modal';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './EnglishTestTaking.css';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '');

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

const EnglishTestTaking = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  useAuth();

  const [test, setTest] = useState(null);
  const [result, setResult] = useState(null);
  const [sections, setSections] = useState([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [notes, setNotes] = useState({});
  const [sectionTimers, setSectionTimers] = useState({});
  const timeWarnedRef = useRef({ five: false, one: false });
  const handleSectionTimeoutRef = useRef(() => {});
  const [sectionStarted, setSectionStarted] = useState({});
  const [showSectionTransition, setShowSectionTransition] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Listening state
  const [audioPlayCount, setAudioPlayCount] = useState({});
  const [audioFinished, setAudioFinished] = useState({});
  const audioRef = useRef(null);

  // Speaking state
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobs, setRecordedBlobs] = useState({});
  const [recordAttempts, setRecordAttempts] = useState({});
  const [speakTimer, setSpeakTimer] = useState(0);
  const [speakingUploadStatus, setSpeakingUploadStatus] = useState({});
  const [recordedUrls, setRecordedUrls] = useState({});
  const [, setMicTested] = useState(false);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const speakTimerRef = useRef(null);
  const resultRef = useRef(null);

  const { violations } = useExamSecurity(result?._id, true);

  useEffect(() => { resultRef.current = result; }, [result]);

  const buildSections = useCallback((testData) => {
    if (!testData.englishSections || testData.englishSections.length === 0) {
      return [{ sectionType: 'mixed', sectionTitle: 'All Questions', duration: testData.duration, questions: testData.questions }];
    }
    return testData.englishSections
      .sort((a, b) => a.order - b.order)
      .map(sec => ({
        ...sec,
        questions: testData.questions.filter(q => q.sectionId === sec.sectionType)
      }));
  }, []);

  const testMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicTested(true);
    } catch {
      setModal({ isOpen: true, title: 'Microphone Required', message: 'Please allow microphone access for the speaking section.', type: 'warning' });
    }
  }, []);

  const fetchTestAndStart = useCallback(async () => {
    try {
      const testRes = await axiosInstance.get(`/tests/${testId}`);
      setTest(testRes.data);

      const builtSections = buildSections(testRes.data);
      setSections(builtSections);

      const timers = {};
      builtSections.forEach((s, i) => {
        timers[i] = (s.duration || 15) * 60;
      });
      setSectionTimers(timers);

      const resultRes = await axiosInstance.post(`/results/start/${testId}`);
      setResult(resultRes.data);

      if (resultRes.data.answers) {
        const existingAnswers = {};
        const existingNotes = {};
        const existingFlagged = {};
        resultRes.data.answers.forEach(a => {
          const id = a.questionId?.toString?.() || a.questionId;
          if (a.answer !== undefined && a.answer !== null) existingAnswers[id] = a.answer;
          if (a.note) existingNotes[id] = a.note;
          if (a.flagged) existingFlagged[id] = true;
        });
        setAnswers(existingAnswers);
        setNotes(existingNotes);
        setFlagged(existingFlagged);
      }

      const hasSpeaking = builtSections.some(s => s.sectionType === 'speaking');
      if (hasSpeaking) await testMicrophone();

      setSectionStarted({ 0: true });
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Failed to start test', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [testId, buildSections, testMicrophone]);

  useEffect(() => {
    fetchTestAndStart();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (speakTimerRef.current) clearInterval(speakTimerRef.current);
    };
  }, [fetchTestAndStart]);

  useEffect(() => {
    return () => { Object.values(recordedUrls).forEach(u => { if (u) URL.revokeObjectURL(u); }); };
  }, [recordedUrls]);

  const isPractice = test?.settings?.practiceMode === true;
  const [practiceRevealed, setPracticeRevealed] = useState({});

  useEffect(() => {
    timeWarnedRef.current = { five: false, one: false };
  }, [currentSectionIdx]);

  useEffect(() => {
    if (isPractice) return;
    if (sections.length === 0 || !sectionStarted[currentSectionIdx]) return;
    const sectionType = sections[currentSectionIdx]?.sectionType;
    if (!sectionType) return;

    const interval = setInterval(() => {
      setSectionTimers(prev => {
        const remaining = (prev[currentSectionIdx] || 0) - 1;
        if (remaining === 300 && !timeWarnedRef.current.five) {
          timeWarnedRef.current.five = true;
          setModal({ isOpen: true, title: 'Time reminder', message: '5 minutes remaining in this section.', type: 'warning' });
        }
        if (remaining === 60 && !timeWarnedRef.current.one) {
          timeWarnedRef.current.one = true;
          setModal({ isOpen: true, title: 'Time reminder', message: '1 minute remaining in this section.', type: 'warning' });
        }
        if (remaining <= 0) {
          clearInterval(interval);
          handleSectionTimeoutRef.current();
          return { ...prev, [currentSectionIdx]: 0 };
        }
        return { ...prev, [currentSectionIdx]: remaining };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSectionIdx, sectionStarted, isPractice, sections]);

  const currentSection = sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions?.[currentQuestionIdx];
  const questionData = currentQuestion?.questionId;
  const timeRemaining = sectionTimers[currentSectionIdx] || 0;

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSectionTimeout = () => {
    saveAllCurrentAnswers();
    if (currentSectionIdx < sections.length - 1) {
      moveToNextSection();
    } else {
      handleSubmitTest();
    }
  };
  handleSectionTimeoutRef.current = handleSectionTimeout;

  const moveToNextSection = () => {
    setShowSectionTransition(true);
    setTimeout(() => {
      const nextIdx = currentSectionIdx + 1;
      setCurrentSectionIdx(nextIdx);
      setCurrentQuestionIdx(0);
      setSectionStarted(prev => ({ ...prev, [nextIdx]: true }));
      setShowSectionTransition(false);
    }, 100);
  };

  const saveAnswer = async (questionId, answer, extra = {}) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    if (result?._id) {
      try {
        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId,
          answer,
          ...extra
        });
      } catch (err) {
        console.error('Error saving answer:', err);
      }
    }
  };

  const saveAllCurrentAnswers = () => {
    if (!currentSection) return;
    currentSection.questions.forEach(q => {
      const qId = q.questionId?._id || q.questionId;
      if (answers[qId] !== undefined) {
        saveAnswer(qId, answers[qId], { note: notes[qId], flagged: flagged[qId] });
      }
    });
  };

  const uploadSpeakingAudio = useCallback(async (questionId, blob) => {
    const rid = resultRef.current?._id;
    if (!rid || !blob) return null;
    setSpeakingUploadStatus(prev => ({ ...prev, [questionId]: 'uploading' }));
    try {
      const formData = new FormData();
      const ext = blob.type?.includes('mp4') ? 'mp4' : blob.type?.includes('ogg') ? 'ogg' : 'webm';
      formData.append('audio', blob, `speaking-${questionId}.${ext}`);
      formData.append('questionId', questionId);

      const baseURL = axiosInstance.defaults.baseURL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseURL}/results/${rid}/upload-audio`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Upload failed (${response.status})`);
      }
      const data = await response.json();
      setSpeakingUploadStatus(prev => ({ ...prev, [questionId]: 'uploaded' }));
      setAnswers(prev => ({ ...prev, [questionId]: data.audioUrl }));
      return data.audioUrl;
    } catch (err) {
      console.error('Speaking upload error:', err);
      setSpeakingUploadStatus(prev => ({ ...prev, [questionId]: 'failed' }));
      return null;
    }
  }, []);

  const uploadAllPendingSpeakingAudio = useCallback(async () => {
    if (!resultRef.current?._id) return;
    const pendingIds = Object.keys(recordedBlobs).filter(
      qId => recordedBlobs[qId] && speakingUploadStatus[qId] !== 'uploaded'
    );
    if (pendingIds.length === 0) return;
    const uploads = pendingIds.map(qId => uploadSpeakingAudio(qId, recordedBlobs[qId]));
    await Promise.allSettled(uploads);
  }, [recordedBlobs, speakingUploadStatus, uploadSpeakingAudio]);

  const saveAllAnswersBeforeSubmit = async () => {
    if (!resultRef.current?._id) return;
    await uploadAllPendingSpeakingAudio();
    const keys = Object.keys(answers || {});
    const promises = keys.map(qId =>
      saveAnswer(qId, answers[qId], { note: notes[qId], flagged: flagged[qId] })
    );
    await Promise.allSettled(promises);
  };

  const toggleFlag = (qId) => {
    const next = !flagged[qId];
    setFlagged(prev => ({ ...prev, [qId]: next }));
    if (result?._id && questionData?._id === qId) saveAnswer(qId, answers[qId], { note: notes[qId], flagged: next });
  };

  const handleNext = () => {
    const qId = questionData?._id;
    if (qId && answers[qId] !== undefined) saveAnswer(qId, answers[qId], { note: notes[qId], flagged: flagged[qId] });
    if (currentQuestionIdx < currentSection.questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIdx > 0) setCurrentQuestionIdx(currentQuestionIdx - 1);
  };

  const goToResult = useCallback((resultId) => {
    try {
      navigate(`/student/english-result/${resultId}`, { replace: true });
    } catch (_) {
      // fallback
    }
    setTimeout(() => {
      if (window.location.pathname.indexOf('english-result') === -1) {
        window.location.href = `/student/english-result/${resultId}`;
      }
    }, 300);
  }, [navigate]);

  const handleSubmitTest = async () => {
    if (submitting) return;
    const rid = result?._id || resultRef.current?._id;
    if (!rid) return;
    setSubmitting(true);
    setShowReview(false);
    try {
      await saveAllAnswersBeforeSubmit();
      const response = await axiosInstance.post(`/results/${rid}/submit`, {}, {
        timeout: 300000
      });
      const finalId = response?.data?._id || rid;
      goToResult(finalId);
    } catch (error) {
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message || '';
      const alreadySubmitted = status === 400 && serverMsg.toLowerCase().includes('already');

      if (alreadySubmitted) {
        const existingId = error?.response?.data?.resultId || rid;
        goToResult(existingId);
        return;
      }

      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      if (isTimeout) {
        goToResult(rid);
        return;
      }

      setModal({
        isOpen: true,
        title: 'Submission Error',
        message: serverMsg || error.message || 'Failed to submit test. Please try again.',
        type: 'error'
      });
      setSubmitting(false);
    }
  };

  // ===== GRAMMAR QUESTION RENDERER =====
  const renderGrammarQuestion = () => {
    const q = questionData;
    if (!q) return null;
    const qId = q._id;

    if (q.subType === 'parajumble') {
      const order = answers[qId] || [];
      const handleReorder = (fromIdx, toIdx) => {
        const newOrder = [...(order.length ? order : q.sentences.map((_, i) => i))];
        const [moved] = newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, moved);
        setAnswers(prev => ({ ...prev, [qId]: newOrder }));
      };
      const sentenceOrder = order.length ? order : q.sentences.map((_, i) => i);
      return (
        <div className="question-content">
          <p className="question-text">{q.questionText}</p>
          <div className="parajumble-sentences">
            {sentenceOrder.map((sIdx, pos) => (
              <div key={pos} className="parajumble-item">
                <span className="pj-number">{pos + 1}</span>
                <p className="pj-text">{q.sentences[sIdx]}</p>
                <div className="pj-actions">
                  <button disabled={pos === 0} onClick={() => handleReorder(pos, pos - 1)} className="pj-btn">Up</button>
                  <button disabled={pos === sentenceOrder.length - 1} onClick={() => handleReorder(pos, pos + 1)} className="pj-btn">Down</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (q.subType === 'fill_in_blank') {
      return (
        <div className="question-content">
          <p className="question-text">{q.questionText}</p>
          {q.blankSentence && <p className="blank-sentence">{q.blankSentence}</p>}
          <input type="text" className="fill-blank-input" value={answers[qId] || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))} placeholder="Type your answer..." />
        </div>
      );
    }

    if (q.subType === 'error_detection') {
      const words = (q.blankSentence || q.questionText).split(/\s+/);
      return (
        <div className="question-content">
          <p className="question-text">{q.questionText}</p>
          {q.options && q.options.length > 0 ? (
            <div className="mcq-options">{q.options.map((opt, i) => (
              <div key={i} className={`mcq-option ${answers[qId] === i ? 'selected' : ''}`} onClick={() => setAnswers(prev => ({ ...prev, [qId]: i }))}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span>{opt.text}</span>
              </div>
            ))}</div>
          ) : (
            <div className="error-detect-words">
              {words.map((w, i) => (
                <span key={i} className={`error-word ${answers[qId] === i ? 'selected' : ''}`} onClick={() => setAnswers(prev => ({ ...prev, [qId]: i }))}>{w}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (q.subType === 'sentence_correction' && !q.isSubjective) {
      return (
        <div className="question-content">
          <p className="question-text">{q.questionText}</p>
          <input type="text" className="fill-blank-input sentence-correction-input" value={answers[qId] || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))} placeholder="Type your corrected sentence..." />
        </div>
      );
    }

    if (q.isSubjective) {
      return (
        <div className="question-content">
          <p className="question-text">{q.questionText}</p>
          <textarea className="subjective-textarea" value={answers[qId] || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: e.target.value }))} rows="4" placeholder="Type your corrected sentence..." />
        </div>
      );
    }

    return (
      <div className="question-content">
        <p className="question-text">{q.questionText}</p>
        {q.blankSentence && <p className="blank-sentence">{q.blankSentence}</p>}
        <div className="mcq-options">{q.options?.map((opt, i) => (
          <div key={i} className={`mcq-option ${answers[qId] === i ? 'selected' : ''}`} onClick={() => setAnswers(prev => ({ ...prev, [qId]: i }))}>
            <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{opt.text}</span>
          </div>
        ))}</div>
      </div>
    );
  };

  // ===== VOCABULARY QUESTION RENDERER =====
  const renderVocabularyQuestion = () => {
    const q = questionData;
    if (!q) return null;
    const qId = q._id;
    return (
      <div className="question-content vocabulary-question">
        <div className="vocab-word-display">
          <span className="vocab-label">{q.subType === 'idiom_phrase' ? 'Phrase' : 'Word'}:</span>
          <span className="vocab-word">{q.word}</span>
        </div>
        {q.contextSentence && <p className="vocab-context">"{q.contextSentence}"</p>}
        <p className="question-text">{q.subType === 'synonym' ? 'Choose the synonym:' : q.subType === 'antonym' ? 'Choose the antonym:' : q.subType === 'meaning' ? 'What does this word mean?' : q.subType === 'one_word_substitution' ? 'Choose the one word substitution:' : q.subType === 'idiom_phrase' ? 'What does this phrase mean?' : 'Choose the correct option:'}</p>
        <div className="mcq-options">{q.options?.map((opt, i) => (
          <div key={i} className={`mcq-option ${answers[qId] === i ? 'selected' : ''}`} onClick={() => setAnswers(prev => ({ ...prev, [qId]: i }))}>
            <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{opt.text}</span>
          </div>
        ))}</div>
      </div>
    );
  };

  // ===== READING QUESTION RENDERER =====
  const renderReadingQuestion = () => {
    const q = questionData;
    if (!q) return null;
    const qId = q._id;
    const subAnswers = answers[qId] || {};
    return (
      <div className="reading-layout">
        <div className="reading-passage-panel">
          <div className="passage-header">
            <h3>{q.passage?.title}</h3>
            <span className="passage-meta">{q.passage?.wordCount} words | {q.passage?.genre}</span>
          </div>
          <div className="passage-content" dangerouslySetInnerHTML={{ __html: q.passage?.content }} />
          {q.passage?.source && <p className="passage-source">Source: {q.passage.source}</p>}
        </div>
        <div className="reading-questions-panel">
          <h3>Questions ({q.questions?.length})</h3>
          {q.questions?.map((sq, sIdx) => (
            <div key={sIdx} className="reading-sub-question">
              <p className="sub-q-text">{sIdx + 1}. {sq.questionText}</p>
              {(sq.questionType === 'mcq' || sq.questionType === 'true_false') && (
                <div className="mcq-options compact">{sq.options?.map((opt, oIdx) => (
                  <div key={oIdx} className={`mcq-option ${subAnswers[sIdx] === oIdx ? 'selected' : ''}`} onClick={() => setAnswers(prev => ({ ...prev, [qId]: { ...subAnswers, [sIdx]: oIdx } }))}>
                    <span className="option-letter">{String.fromCharCode(65 + oIdx)}</span>
                    <span>{opt.text}</span>
                  </div>
                ))}</div>
              )}
              {(sq.questionType === 'short_answer' || sq.questionType === 'inference') && (
                <textarea className="short-answer-input" value={subAnswers[sIdx] || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: { ...subAnswers, [sIdx]: e.target.value } }))} rows="3" placeholder="Type your answer..." />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== ESSAY/WRITING QUESTION RENDERER =====
  const renderEssayQuestion = () => {
    const q = questionData;
    if (!q) return null;
    const qId = q._id;
    const content = answers[qId] || '';
    const plainText = content.replace(/<[^>]*>/g, '');
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    return (
      <div className="question-content essay-question">
        <div className="essay-prompt-card">
          <h3>Writing Prompt</h3>
          <p className="essay-prompt-text">{q.prompt}</p>
          {q.instructions && <p className="essay-instructions">{q.instructions}</p>}
          <div className="essay-meta-row">
            <span>Type: {q.writingType?.replace(/_/g, ' ')}</span>
            <span>Word Limit: {q.wordLimit?.min} - {q.wordLimit?.max}</span>
            {q.timeLimit && <span>Time: {q.timeLimit} min</span>}
          </div>
        </div>
        {q.expectedFormat && (
          <details className="format-guide">
            <summary>Format Guide</summary>
            <pre>{q.expectedFormat}</pre>
          </details>
        )}
        <div className="essay-editor-wrapper">
          <ReactQuill theme="snow" value={content} onChange={(val) => setAnswers(prev => ({ ...prev, [qId]: val }))} modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] }} placeholder="Start writing..." />
          <div className={`word-counter ${wordCount < (q.wordLimit?.min || 0) ? 'under' : wordCount > (q.wordLimit?.max || 9999) ? 'over' : 'ok'}`}>
            {wordCount} / {q.wordLimit?.min}-{q.wordLimit?.max} words
          </div>
          {(q.wordLimit?.min || 0) > 0 && (
            <div className="word-target-indicator">
              <div className="word-target-label">
                {wordCount >= (q.wordLimit?.min || 0) ? 'Minimum word count reached' : `Minimum ${q.wordLimit.min} words (you have ${wordCount})`}
              </div>
              <div className="word-target-bar-wrap">
                <div
                  className="word-target-bar"
                  style={{ width: `${Math.min(100, (wordCount / (q.wordLimit?.min || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===== LISTENING QUESTION RENDERER =====
  const renderListeningQuestion = () => {
    const q = questionData;
    if (!q) return null;
    const qId = q._id;
    const plays = audioPlayCount[qId] || 0;
    const maxPlays = (q.maxReplays || 2) + 1;
    const limitReached = plays >= maxPlays;
    const finished = audioFinished[qId];
    const subAnswers = answers[qId] || {};

    const handlePlay = (e) => {
      const newCount = plays + 1;
      if (newCount > maxPlays) {
        e.target.pause();
        e.target.currentTime = 0;
        return;
      }
      setAudioPlayCount(prev => ({ ...prev, [qId]: newCount }));
    };

    const handleAudioEnd = () => {
      setAudioFinished(prev => ({ ...prev, [qId]: true }));
      if (plays >= maxPlays && audioRef.current) {
        audioRef.current.removeAttribute('controls');
      }
    };

    const handleCanPlay = () => {
      if (limitReached && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };

    const audioSrc = resolveMediaUrl(q.audioUrl);

    return (
      <div className="question-content listening-question">
        <h3>{q.title}</h3>
        <div className="audio-player-card">
          {!limitReached ? (
            <audio
              ref={audioRef}
              src={audioSrc}
              onPlay={handlePlay}
              onEnded={handleAudioEnd}
              onCanPlay={handleCanPlay}
              controls
              controlsList="nodownload noplaybackrate"
            />
          ) : (
            <div className="audio-disabled-placeholder">Audio playback complete</div>
          )}
          <div className="replay-info">
            Plays used: {plays} / {maxPlays}
            {!limitReached && plays > 0 && ` (${maxPlays - plays} remaining)`}
          </div>
          {limitReached && <p className="replay-limit">All replays used. Answer the questions below.</p>}
        </div>
        {(finished || limitReached) ? (
          <div className="listening-questions-list">
            <h4>Answer the questions</h4>
            {q.questions?.map((sq, sIdx) => (
              <div key={sIdx} className="listening-sub-question">
                <p className="sub-q-text">{sIdx + 1}. {sq.questionText}</p>
                {(sq.questionType === 'mcq' || sq.questionType === 'true_false') && (
                  <div className="mcq-options compact">{sq.options?.map((opt, oIdx) => (
                    <div key={oIdx} className={`mcq-option ${subAnswers[sIdx] === oIdx ? 'selected' : ''}`} onClick={() => setAnswers(prev => ({ ...prev, [qId]: { ...subAnswers, [sIdx]: oIdx } }))}>
                      <span className="option-letter">{String.fromCharCode(65 + oIdx)}</span>
                      <span>{opt.text}</span>
                    </div>
                  ))}</div>
                )}
                {(sq.questionType === 'fill_in_blank' || sq.questionType === 'short_answer') && (
                  <input type="text" className="fill-blank-input" value={subAnswers[sIdx] || ''} onChange={(e) => setAnswers(prev => ({ ...prev, [qId]: { ...subAnswers, [sIdx]: e.target.value } }))} placeholder="Your answer..." />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="listen-first-msg">Listen to the audio first. Questions will appear after the audio finishes playing.</p>
        )}
      </div>
    );
  };

  // ===== SPEAKING QUESTION RENDERER =====
  const renderSpeakingQuestion = () => {
    const q = questionData;
    if (!q) return null;
    const qId = q._id;
    const attempts = recordAttempts[qId] || 0;
    const maxAttempts = q.maxAttempts || 2;
    const recorded = recordedBlobs[qId];
    const uploadStatus = speakingUploadStatus[qId];

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
            : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : '';
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedBlobs(prev => ({ ...prev, [qId]: blob }));
          setRecordedUrls(prev => {
            if (prev[qId]) URL.revokeObjectURL(prev[qId]);
            return { ...prev, [qId]: url };
          });
          setRecordAttempts(prev => ({ ...prev, [qId]: attempts + 1 }));
          setSpeakingUploadStatus(prev => ({ ...prev, [qId]: 'pending' }));
          stream.getTracks().forEach(t => t.stop());
          uploadSpeakingAudio(qId, blob);
        };
        recorder.start(1000);
        setMediaRecorder(recorder);
        setIsRecording(true);

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        drawWaveform();

        const maxSec = q.speakingTime?.max || 120;
        setSpeakTimer(maxSec);
        if (speakTimerRef.current) clearInterval(speakTimerRef.current);
        speakTimerRef.current = setInterval(() => {
          setSpeakTimer(prev => {
            if (prev <= 1) {
              clearInterval(speakTimerRef.current);
              speakTimerRef.current = null;
              if (recorder.state !== 'inactive') recorder.stop();
              setIsRecording(false);
              if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } catch {
        setModal({ isOpen: true, title: 'Error', message: 'Microphone access denied. Please allow microphone access and try again.', type: 'error' });
      }
    };

    const stopRecording = () => {
      if (speakTimerRef.current) {
        clearInterval(speakTimerRef.current);
        speakTimerRef.current = null;
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };

    const drawWaveform = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        ctx.fillStyle = 'var(--bg-secondary)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ED0331';
        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      };
      draw();
    };

    const handleReRecord = () => {
      if (recordedUrls[qId]) URL.revokeObjectURL(recordedUrls[qId]);
      setRecordedUrls(prev => ({ ...prev, [qId]: null }));
      setRecordedBlobs(prev => ({ ...prev, [qId]: null }));
      setSpeakingUploadStatus(prev => ({ ...prev, [qId]: null }));
      setAnswers(prev => { const next = { ...prev }; delete next[qId]; return next; });
    };

    return (
      <div className="question-content speaking-question">
        <div className="speaking-prompt-card">
          <span className="speaking-type-badge">{q.speakingType?.replace(/_/g, ' ')}</span>
          <p className="speaking-prompt">{q.prompt}</p>
          {q.speakingType === 'read_aloud' && q.referenceText && (
            <div className="read-aloud-text"><p>{q.referenceText}</p></div>
          )}
          {q.speakingType === 'describe_image' && q.imageUrl && (
            <img src={resolveMediaUrl(q.imageUrl)} alt="Describe this" className="speaking-image" />
          )}
        </div>

        <div className="recording-controls">
          {isRecording && <canvas ref={canvasRef} className="waveform-canvas" width="500" height="80" />}
          {isRecording && <div className="speak-timer">Recording: {formatTime(speakTimer)}</div>}

          <div className="recording-buttons">
            {!isRecording && !recorded && attempts < maxAttempts && (
              <button type="button" onClick={startRecording} className="btn btn-primary record-btn">Start Recording</button>
            )}
            {isRecording && (
              <button type="button" onClick={stopRecording} className="btn btn-danger stop-btn">Stop Recording</button>
            )}
            {recorded && !isRecording && recordedUrls[qId] && (
              <div className="recording-playback">
                <audio controls src={recordedUrls[qId]} />
                <div className="upload-status-row">
                  {uploadStatus === 'uploading' && <span className="upload-status uploading">Uploading audio...</span>}
                  {uploadStatus === 'uploaded' && <span className="upload-status uploaded">Audio saved</span>}
                  {uploadStatus === 'failed' && (
                    <span className="upload-status failed">
                      Upload failed
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => uploadSpeakingAudio(qId, recorded)}>Retry</button>
                    </span>
                  )}
                </div>
                {attempts < maxAttempts && (
                  <button type="button" onClick={handleReRecord} className="btn btn-secondary">Re-record ({maxAttempts - attempts} left)</button>
                )}
              </div>
            )}
          </div>
          {!isRecording && !recorded && attempts === 0 && (
            <p className="speaking-instructions">Click "Start Recording" and speak clearly into your microphone. Max duration: {q.speakingTime?.max || 120}s</p>
          )}
          <div className="attempts-info">Attempts: {attempts} / {maxAttempts}</div>
        </div>
      </div>
    );
  };

  const renderPracticeFeedback = () => {
    if (!isPractice || !questionData) return null;
    const qId = questionData._id;
    const userAnswer = answers[qId];
    if (userAnswer === undefined || userAnswer === null) return null;
    if (practiceRevealed[qId]) return null;

    const type = currentQuestion?.type;
    const isObjective = (type === 'english_grammar' && !questionData.isSubjective && questionData.subType !== 'parajumble') ||
                        type === 'english_vocabulary';
    if (!isObjective) return null;

    return (
      <div className="practice-check-btn-wrap">
        <button
          className="btn btn-primary practice-check-btn"
          onClick={() => setPracticeRevealed(prev => ({ ...prev, [qId]: true }))}
        >
          Check Answer
        </button>
      </div>
    );
  };

  const renderPracticeResult = () => {
    if (!isPractice || !questionData) return null;
    const qId = questionData._id;
    if (!practiceRevealed[qId]) return null;

    const userAnswer = answers[qId];
    const type = currentQuestion?.type;
    let isCorrectAnswer = false;
    let correctDisplay = '';

    if (type === 'english_grammar' && !questionData.isSubjective) {
      if (typeof questionData.correctAnswer === 'number') {
        isCorrectAnswer = userAnswer === questionData.correctAnswer;
        correctDisplay = questionData.options?.[questionData.correctAnswer]?.text || `Option ${questionData.correctAnswer + 1}`;
      } else {
        isCorrectAnswer = String(userAnswer).toLowerCase().trim() === String(questionData.correctAnswer).toLowerCase().trim();
        correctDisplay = questionData.correctAnswer;
      }
    } else if (type === 'english_vocabulary') {
      isCorrectAnswer = userAnswer === questionData.correctAnswer;
      correctDisplay = questionData.options?.[questionData.correctAnswer]?.text || `Option ${questionData.correctAnswer + 1}`;
    }

    return (
      <div className={`practice-feedback-panel ${isCorrectAnswer ? 'correct' : 'incorrect'}`}>
        <div className="practice-feedback-icon">{isCorrectAnswer ? '✓ Correct!' : '✗ Incorrect'}</div>
        {!isCorrectAnswer && <div className="practice-correct-answer">Correct answer: {correctDisplay}</div>}
        {questionData.explanation && <div className="practice-explanation">{questionData.explanation}</div>}
      </div>
    );
  };

  // ===== MAIN QUESTION RENDERER =====
  const renderQuestion = () => {
    if (!currentSection || !currentQuestion) return null;
    const type = currentQuestion.type;
    let content = null;
    if (type === 'english_grammar') content = renderGrammarQuestion();
    else if (type === 'english_vocabulary') content = renderVocabularyQuestion();
    else if (type === 'english_reading') content = renderReadingQuestion();
    else if (type === 'english_essay') content = renderEssayQuestion();
    else if (type === 'english_listening') content = renderListeningQuestion();
    else if (type === 'english_speaking') content = renderSpeakingQuestion();
    else return <p>Unknown question type: {type}</p>;

    return (
      <>
        {content}
        {renderPracticeFeedback()}
        {renderPracticeResult()}
      </>
    );
  };

  // ===== REVIEW PANEL =====
  const renderReview = () => {
    const hasPendingSpeaking = Object.keys(recordedBlobs).some(
      qId => recordedBlobs[qId] && speakingUploadStatus[qId] !== 'uploaded'
    );

    return (
      <div className="review-panel">
        <h2>Review Your Answers</h2>
        {sections.map((sec, sIdx) => (
          <div key={sIdx} className="review-section">
            <h3>{sec.sectionTitle}</h3>
            <div className="review-questions">
              {sec.questions.map((q, qIdx) => {
                const qId = q.questionId?._id || q.questionId;
                const isSpeaking = q.type === 'english_speaking';
                const answered = isSpeaking
                  ? !!(recordedBlobs[qId] || answers[qId])
                  : answers[qId] !== undefined;
                const isFlagged = flagged[qId];
                const speakingStatus = isSpeaking ? speakingUploadStatus[qId] : null;
                return (
                  <div
                    key={qIdx}
                    className={`review-item ${answered ? 'answered' : 'unanswered'} ${isFlagged ? 'flagged' : ''} ${speakingStatus === 'failed' ? 'upload-failed' : ''}`}
                    onClick={() => { setCurrentSectionIdx(sIdx); setCurrentQuestionIdx(qIdx); setShowReview(false); }}
                  >
                    <span>Q{qIdx + 1}</span>
                    {isFlagged && <span className="flag-icon">!</span>}
                    {speakingStatus === 'uploading' && <span className="upload-icon">...</span>}
                    {speakingStatus === 'uploaded' && <span className="upload-icon done">ok</span>}
                    {speakingStatus === 'failed' && <span className="upload-icon fail">!</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {hasPendingSpeaking && (
          <div className="review-warning">
            Some speaking recordings haven't been uploaded yet. They will be uploaded when you submit.
          </div>
        )}
        <div className="review-actions">
          <button className="btn btn-secondary" onClick={() => setShowReview(false)}>Back to Test</button>
          <button className="btn btn-primary" disabled={submitting} onClick={handleSubmitTest}>
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="english-test-loading">Loading test...</div>;
  if (!test) return <div className="english-test-loading">Test not found.</div>;

  if (showSectionTransition && sections[currentSectionIdx + 1]) {
    const next = sections[currentSectionIdx + 1];
    return (
      <div className="section-transition">
        <div className="transition-card">
          <h2>Next Section</h2>
          <h1>{next.sectionTitle}</h1>
          <p>{next.questions?.length} questions | {next.duration} minutes</p>
          {next.instructions && <p className="transition-instructions">{next.instructions}</p>}
          <button className="btn btn-primary" onClick={() => { setCurrentSectionIdx(currentSectionIdx + 1); setCurrentQuestionIdx(0); setSectionStarted(prev => ({ ...prev, [currentSectionIdx + 1]: true })); setShowSectionTransition(false); }}>Start Section</button>
        </div>
      </div>
    );
  }

  if (showReview) return renderReview();

  const totalQuestionsInSection = currentSection?.questions?.length || 0;

  return (
    <div className="english-test-taking">
      <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="test-header">
        <div className="test-header-left">
          <h2 className="test-title">{test.title}</h2>
          <span className="section-badge">{currentSection?.sectionTitle} ({currentQuestionIdx + 1}/{totalQuestionsInSection})</span>
        </div>
        <div className="test-header-right">
          {isPractice ? (
            <div className="practice-mode-badge">Practice Mode</div>
          ) : (
            <div className={`timer ${timeRemaining < 60 ? 'danger' : timeRemaining < 300 ? 'warning' : ''}`}>
              {formatTime(timeRemaining)}
            </div>
          )}
          <div className="violations-indicator">Violations: {violations}</div>
        </div>
      </div>

      <div className="test-progress">
        {sections.map((s, i) => (
          <div key={i} className={`progress-section ${i === currentSectionIdx ? 'current' : i < currentSectionIdx ? 'completed' : 'upcoming'}`}>
            {s.sectionTitle}
          </div>
        ))}
      </div>

      <div className="test-body">
        <div className="question-sidebar">
          <h4>{currentSection?.sectionTitle}</h4>
          <div className="question-nav-grid">
            {currentSection?.questions?.map((q, i) => {
              const qId = q.questionId?._id || q.questionId;
              const answered = answers[qId] !== undefined;
              const isFlagged = flagged[qId];
              return (
                <button key={i} className={`q-nav-btn ${i === currentQuestionIdx ? 'active' : ''} ${answered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''}`} onClick={() => setCurrentQuestionIdx(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="nav-legend">
            <span><span className="legend-dot answered"></span>Answered</span>
            <span><span className="legend-dot flagged"></span>Flagged</span>
            <span><span className="legend-dot"></span>Not Attempted</span>
          </div>
        </div>

        <div className="question-main">
          <div className="question-number-bar">
            <span>Question {currentQuestionIdx + 1} of {totalQuestionsInSection}</span>
            <span className="question-points">{currentQuestion?.points || 0} points</span>
            <button className={`flag-btn ${flagged[questionData?._id] ? 'active' : ''}`} onClick={() => toggleFlag(questionData?._id)}>
              {flagged[questionData?._id] ? 'Unflag' : 'Flag for Review'}
            </button>
          </div>

          {renderQuestion()}

          {questionData?._id && (
            <div className="question-note-area">
              <label>Note for this question (optional)</label>
              <textarea
                value={notes[questionData._id] || ''}
                onChange={(e) => setNotes(prev => ({ ...prev, [questionData._id]: e.target.value }))}
                onBlur={(e) => { const val = e.target.value; setNotes(prev => ({ ...prev, [questionData._id]: val })); saveAnswer(questionData._id, answers[questionData._id], { note: val, flagged: flagged[questionData._id] }); }}
                placeholder="Add a private note to review later..."
                rows={2}
              />
            </div>
          )}

          <div className="question-actions">
            <button className="btn btn-secondary" onClick={handlePrev} disabled={currentQuestionIdx === 0}>Previous</button>
            <div className="action-right">
              {currentQuestionIdx < totalQuestionsInSection - 1 ? (
                <button className="btn btn-primary" onClick={handleNext}>Save & Next</button>
              ) : currentSectionIdx < sections.length - 1 ? (
                <button className="btn btn-primary" onClick={moveToNextSection}>Next Section</button>
              ) : (
                <button className="btn btn-primary submit-test-btn" disabled={submitting} onClick={handleSubmitTest}>
                  {submitting ? 'Submitting...' : 'Submit Test'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnglishTestTaking;
