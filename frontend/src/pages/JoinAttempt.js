import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveJoinTarget } from '../utils/shareLinks';
import { markShareLinkAttempt } from '../utils/examShareLink';
import axiosInstance from '../utils/axios';
import './JoinAttempt.css';

function formatScheduleDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
}

const KIND_LABELS = {
  test: 'Test',
  interview: 'Mock interview',
  assignment: 'Project assignment',
  'system-design': 'System design',
};

const JoinAttempt = ({ kind }) => {
  const { testId, interviewId, assignmentId, problemId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const id = testId || interviewId || assignmentId || problemId;

  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState('');
  const [starting, setStarting] = useState(false);

  const redirectPath = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`, { replace: true });
      return;
    }

    if (user.role !== 'student') {
      navigate('/login', {
        replace: true,
        state: { message: 'This link is for students. Please sign in with a student account.' },
      });
    }
  }, [user, authLoading, navigate, redirectPath]);

  const fetchMeta = useCallback(async () => {
    if (!user || user.role !== 'student' || !id) return;

    setMetaLoading(true);
    setMetaError('');

    try {
      if (kind === 'test') {
        const { data } = await axiosInstance.get(`/tests/${id}`);
        setMeta({
          title: data.title,
          subtitle: `${data.type} · ${data.duration} min`,
          duration: data.duration,
          contestId: data.contestId,
          schedulePhase: data.schedulePhase,
          scheduleMessage: data.scheduleMessage,
          scheduleWindowStart: data.scheduleWindowStart,
          scheduleWindowEnd: data.scheduleWindowEnd,
          canStartAttempt: data.canStartAttempt,
          canContinueAttempt: data.canContinueAttempt,
          enrollmentStatus: data.enrollmentStatus,
        });
      } else if (kind === 'interview') {
        const { data } = await axiosInstance.get(`/interviews/${id}`);
        setMeta({
          title: data.title,
          subtitle: [data.interviewType, data.topic, data.difficulty].filter(Boolean).join(' · '),
          duration: data.duration,
        });
      } else if (kind === 'assignment') {
        const { data } = await axiosInstance.get(`/assignments/${id}`);
        const a = data.assignment || data;
        setMeta({
          title: a.title,
          subtitle: [a.category, a.difficulty].filter(Boolean).join(' · '),
          duration: a.duration,
        });
      } else if (kind === 'system-design') {
        const { data } = await axiosInstance.get(`/system-design-problems/${id}`);
        const p = data.problem || data;
        setMeta({
          title: p.title,
          subtitle: [p.category, p.difficulty].filter(Boolean).join(' · '),
          duration: p.duration,
        });
      }
    } catch (err) {
      setMetaError(
        err.response?.data?.message ||
          'Could not load this assessment. Make sure you are assigned to it and signed in as a student.'
      );
    } finally {
      setMetaLoading(false);
    }
  }, [user, id, kind]);

  useEffect(() => {
    if (authLoading || !user || user.role !== 'student') return;
    fetchMeta();
  }, [authLoading, user, fetchMeta]);

  const handleStart = () => {
    setStarting(true);
    markShareLinkAttempt();

    const target = resolveJoinTarget({ kind, id, searchParams });
    const contestQuery = kind === 'test' && meta?.contestId ? `?contestId=${meta.contestId}` : '';
    const destination = kind === 'test' && meta?.contestId && !target.includes('contestId=')
      ? `${target}${contestQuery}`
      : target;
    navigate(destination, {
      replace: true,
      state: { fromShareLink: true },
    });
  };

  if (authLoading || !user || user.role !== 'student') {
    return (
      <div className="join-attempt-screen">
        <div className="join-attempt-card">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="join-attempt-screen">
      <div className="join-attempt-card join-attempt-card-wide">
        <span className="join-attempt-kind">{KIND_LABELS[kind] || 'Assessment'}</span>

        {metaLoading && <div className="loading">Loading assessment…</div>}

        {metaError && (
          <>
            <p className="join-attempt-error">{metaError}</p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/student/dashboard')}>
              Go to dashboard
            </button>
          </>
        )}

        {!metaLoading && !metaError && meta && (
          <>
            <h1 className="join-attempt-title">{meta.title}</h1>
            {meta.subtitle && <p className="join-attempt-meta">{meta.subtitle}</p>}
            {meta.duration && (
              <p className="join-attempt-duration">Duration: {meta.duration} minutes</p>
            )}
            {kind === 'test' && (meta.scheduleWindowStart || meta.scheduleWindowEnd) && (
              <p className="join-attempt-schedule">
                {meta.scheduleWindowStart && (
                  <span>Opens: {formatScheduleDate(meta.scheduleWindowStart)}</span>
                )}
                {meta.scheduleWindowStart && meta.scheduleWindowEnd && ' · '}
                {meta.scheduleWindowEnd && (
                  <span>Closes: {formatScheduleDate(meta.scheduleWindowEnd)}</span>
                )}
              </p>
            )}
            {kind === 'test' && meta.scheduleMessage && meta.canStartAttempt === false && meta.enrollmentStatus !== 'in_progress' && (
              <p className="join-attempt-error join-attempt-schedule-notice">{meta.scheduleMessage}</p>
            )}

            <ul className="join-attempt-rules">
              <li>On the next screen you will enter fullscreen (required for exam security)</li>
              <li>Stay on this tab — switching apps, desktops (macOS swipe), or tabs counts as a violation</li>
              <li>Maximum 3 violations allowed; the test auto-submits if you exceed that</li>
              <li>Ensure a stable connection before you begin</li>
            </ul>

            <button
              type="button"
              className="btn btn-primary join-attempt-start-btn"
              onClick={handleStart}
              disabled={
                starting ||
                (kind === 'test' &&
                  meta.canStartAttempt === false &&
                  meta.canContinueAttempt !== true)
              }
            >
              {starting
                ? 'Starting…'
                : kind === 'test' && meta.schedulePhase === 'upcoming'
                  ? 'Not open yet'
                  : kind === 'test' &&
                      meta.canStartAttempt === false &&
                      meta.enrollmentStatus === 'in_progress' &&
                      meta.canContinueAttempt
                    ? 'Continue assessment'
                    : kind === 'test' && meta.canStartAttempt === false
                      ? 'Window closed'
                      : meta.enrollmentStatus === 'in_progress'
                        ? 'Continue assessment'
                        : 'Start assessment'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinAttempt;
