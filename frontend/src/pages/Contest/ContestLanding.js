import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiAward,
  FiClock,
  FiCalendar,
  FiCheckCircle,
  FiLogIn,
  FiPlay,
  FiFileText,
  FiMic,
  FiCpu,
  FiBox,
  FiAlertCircle,
  FiUser,
  FiMail,
  FiLock,
  FiPhone,
  FiBook,
  FiHash,
  FiSun,
  FiMoon,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useVendorBranding } from '../../context/VendorBrandingContext';
import '../Auth/Login.css';
import './ContestLanding.css';

const ASSESSMENT_ICONS = {
  test: FiFileText,
  interview: FiMic,
  assignment: FiCpu,
  system_design: FiBox,
};

const ASSESSMENT_LABELS = {
  test: 'Test',
  interview: 'Interview',
  assignment: 'Assignment',
  system_design: 'System Design',
};

const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const formatDateShort = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function getLiveContestState(contest, participant, nowMs) {
  if (!contest) return { phase: 'unknown', countdownTo: null, countdownLabel: null };

  const now = nowMs;
  const attemptStart = new Date(contest.attemptWindowStart).getTime();
  const attemptEnd = new Date(contest.attemptWindowEnd).getTime();
  const regOpens = new Date(contest.registrationOpensAt).getTime();
  const regCloses = new Date(contest.registrationClosesAt).getTime();

  if (contest.status === 'ended' || contest.phase === 'draft' || now > attemptEnd) {
    return { phase: 'ended', countdownTo: null, countdownLabel: null };
  }

  if (now < attemptStart) {
    const phase = participant
      ? 'registered_waiting'
      : now >= regOpens && now <= regCloses
        ? 'registration_open'
        : 'registration_closed_waiting';
    return {
      phase,
      countdownTo: attemptStart,
      countdownLabel: 'Attempt window opens in',
    };
  }

  if (now >= attemptStart && now <= attemptEnd) {
    return {
      phase: 'attempt_open',
      countdownTo: attemptEnd,
      countdownLabel: 'Attempt window closes in',
    };
  }

  return { phase: 'ended', countdownTo: null, countdownLabel: null };
}

function formatCountdownParts(ms) {
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs: ms,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

const CountdownBlock = ({ value, label }) => (
  <div className="cl-countdown-unit">
    <span className="cl-countdown-value">{pad2(value)}</span>
    <span className="cl-countdown-label">{label}</span>
  </div>
);

const ContestField = ({ id, label, icon: Icon, children }) => (
  <div className="login-field">
    <label htmlFor={id}>{label}</label>
    <div className="login-input-box">
      {Icon && (
        <span className="login-input-affix" aria-hidden="true">
          <Icon />
        </span>
      )}
      {children}
    </div>
  </div>
);

const ContestLanding = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, applySession } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { applyPublicBranding, clearPublicBranding } = useVendorBranding();

  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('register');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [clockOffset, setClockOffset] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const prevPhaseRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    college: '',
    rollNumber: '',
  });

  const fetchContest = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await axiosInstance.get(`/contests/public/${slug}`);
      if (data.serverNow) {
        setClockOffset(new Date(data.serverNow).getTime() - Date.now());
      }
      if (data.branding && data.vendorId) {
        applyPublicBranding(data.branding, data.vendorId);
      }
      setContest(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Contest not found');
    } finally {
      setLoading(false);
    }
  }, [slug, applyPublicBranding]);

  useEffect(() => () => clearPublicBranding(), [clearPublicBranding]);

  useEffect(() => {
    if (authLoading) return;
    fetchContest();
  }, [fetchContest, authLoading, user?.id]);

  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.name) {
      setForm((prev) => ({ ...prev, name: user.name, email: user.email }));
    }
  }, [user]);

  const now = tick + clockOffset;

  const liveState = useMemo(
    () => getLiveContestState(contest, contest?.participant, now),
    [contest, now]
  );

  useEffect(() => {
    const phase = liveState.phase;
    if (prevPhaseRef.current && prevPhaseRef.current !== phase && phase === 'attempt_open') {
      fetchContest();
    }
    prevPhaseRef.current = phase;
  }, [liveState.phase, fetchContest]);

  const countdownParts = useMemo(() => {
    if (!liveState.countdownTo) return null;
    return formatCountdownParts(liveState.countdownTo - now);
  }, [liveState.countdownTo, now]);

  const windowProgress = useMemo(() => {
    if (!contest) return 0;
    const start = new Date(contest.attemptWindowStart).getTime();
    const end = new Date(contest.attemptWindowEnd).getTime();
    if (now < start) return 0;
    if (now > end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }, [contest, now]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post(`/contests/public/${slug}/register`, form);
      if (data.token && data.user) {
        applySession(data.token, data.user);
      }
      await fetchContest();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setFormError('');
    setSubmitting(true);
    try {
      await axiosInstance.post(`/contests/public/${slug}/join`);
      await fetchContest();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to join contest');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async () => {
    setFormError('');
    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post(`/contests/public/${slug}/start`);
      navigate(data.redirectPath);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Cannot start attempt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginRedirect = () => {
    navigate(`/login?redirect=${encodeURIComponent(`/contest/${slug}`)}`);
  };

  if (loading || authLoading) {
    return (
      <div className="login-loading-screen">
        <div className="login-loading-card">
          <div className="cl-loading-spinner" />
          <p>Loading contest…</p>
        </div>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="login-loading-screen">
        <div className="login-form-card cl-error-card">
          <FiAlertCircle className="cl-error-icon" />
          <h2>Contest unavailable</h2>
          <p>{error || 'This contest could not be found.'}</p>
          <Link to="/login" className="login-submit cl-error-btn">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const isRegistered = Boolean(contest.participant);
  const phase = liveState.phase;
  const participantStatus = contest.participant?.status;
  const canRegister = phase === 'registration_open' && !isRegistered;
  const canJoin = user && user.role === 'student' && canRegister;
  const canStart = isRegistered && phase === 'attempt_open' && participantStatus !== 'completed';
  const isWaiting = isRegistered && (phase === 'registered_waiting' || phase === 'registration_closed_waiting');
  const isLive = phase === 'attempt_open';
  const isEnded = phase === 'ended';
  const AssessmentIcon = ASSESSMENT_ICONS[contest.assessmentType] || FiAward;

  const statusConfig = {
    registered_waiting: { label: 'Registered', tone: 'waiting' },
    registration_closed_waiting: { label: 'Registered', tone: 'waiting' },
    attempt_open: { label: isRegistered ? 'Live now' : 'Open', tone: 'live' },
    registration_open: { label: 'Registration open', tone: 'open' },
    ended: { label: 'Ended', tone: 'ended' },
  }[phase] || { label: phase, tone: 'muted' };

  const panelTitle = canStart
    ? participantStatus === 'in_progress'
      ? 'Continue your attempt'
      : 'Ready to compete'
    : isRegistered && isWaiting
      ? 'You\'re registered'
      : isRegistered && isEnded
        ? 'Contest ended'
        : canJoin
          ? 'Join this contest'
          : mode === 'login'
            ? 'Welcome back'
            : 'Register for contest';

  const panelSubtitle = canStart
    ? 'The attempt window is open. Start when you\'re ready.'
    : isRegistered && isWaiting
      ? 'Stay on this page — the start button appears when the window opens.'
      : isRegistered && isEnded
        ? 'Thank you for participating.'
        : canJoin
          ? 'You\'re signed in. Confirm to register for this event.'
          : mode === 'login'
            ? 'Sign in to join with your existing account.'
            : 'Create your account and secure your spot in one step.';

  return (
    <div className="cl-page">
      <aside className="cl-hero" aria-label="Contest details">
        <div className="cl-hero-bg" />
        <div className="cl-hero-grid" />
        <div className="cl-hero-glow" />
        <div className="cl-hero-glow-accent" />

        <div className="cl-hero-content">
          <div className="cl-hero-top">
            <span className="cl-hero-brand">
              <span className="cl-hero-brand-icon" aria-hidden="true">
                <FiAward />
              </span>
              Live contest
            </span>
            <span className={`cl-status-pill cl-status-pill--${statusConfig.tone}`}>
              {statusConfig.tone === 'live' && <span className="cl-live-dot" aria-hidden />}
              {statusConfig.label}
            </span>
          </div>

          <h1 className="cl-hero-title">{contest.title}</h1>
          {contest.description && <p className="cl-hero-desc">{contest.description}</p>}

          {contest.assessment && (
            <div className="cl-hero-assessment">
              <span className="cl-hero-assessment-icon">
                <AssessmentIcon />
              </span>
              <div>
                <span className="cl-hero-assessment-type">
                  {ASSESSMENT_LABELS[contest.assessmentType] || contest.assessmentType}
                </span>
                <strong>{contest.assessment.title}</strong>
                <span>{contest.assessment.duration} min · timed assessment</span>
              </div>
            </div>
          )}

          {!isEnded && countdownParts && (
            <div className={`cl-hero-countdown ${isLive ? 'cl-hero-countdown--live' : ''}`}>
              <p className="cl-hero-countdown-label">{liveState.countdownLabel}</p>
              <div className="cl-countdown-grid">
                {countdownParts.days > 0 && <CountdownBlock value={countdownParts.days} label="Days" />}
                <CountdownBlock value={countdownParts.hours} label="Hours" />
                <CountdownBlock value={countdownParts.minutes} label="Min" />
                <CountdownBlock value={countdownParts.seconds} label="Sec" />
              </div>
              {countdownParts.totalMs <= 60000 && countdownParts.totalMs > 0 && isWaiting && (
                <p className="cl-hero-countdown-soon">Starting very soon — stay on this page</p>
              )}
            </div>
          )}

          <div className="cl-hero-schedule">
            <div className="cl-schedule-card">
              <FiCalendar />
              <div>
                <span>Attempt opens</span>
                <strong>{formatDateShort(contest.attemptWindowStart)}</strong>
              </div>
            </div>
            <div className="cl-schedule-card">
              <FiClock />
              <div>
                <span>Attempt closes</span>
                <strong>{formatDateShort(contest.attemptWindowEnd)}</strong>
              </div>
            </div>
          </div>

          <div className="cl-progress-card">
            <div className="cl-progress-head">
              <span className="cl-progress-title">Attempt window progress</span>
              <span className="cl-progress-pct">{windowProgress}%</span>
            </div>
            <div className="cl-progress-track" role="progressbar" aria-valuenow={windowProgress} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="cl-progress-fill"
                style={{ width: `${Math.max(windowProgress, windowProgress > 0 ? 2 : 0)}%` }}
              />
            </div>
            <p className="cl-progress-caption">
              {windowProgress === 0
                ? 'The attempt window has not started yet.'
                : windowProgress >= 100
                  ? 'The attempt window has ended.'
                  : `${100 - windowProgress}% of the window remaining`}
            </p>
          </div>

          <div className="cl-code-preview">
            <div className="cl-code-header">
              <span className="cl-code-dot cl-code-dot--red" />
              <span className="cl-code-dot cl-code-dot--yellow" />
              <span className="cl-code-dot cl-code-dot--green" />
              <span className="cl-code-filename">contest.config.json</span>
            </div>
            <pre className="cl-code-body">
              <code>
                <span className="cl-code-line">{'{'}</span>
                <span className="cl-code-line">
                  {'  '}<span className="cl-code-key">&quot;slug&quot;</span>
                  : <span className="cl-code-str">&quot;{contest.slug}&quot;</span>,
                </span>
                <span className="cl-code-line">
                  {'  '}<span className="cl-code-key">&quot;assessment&quot;</span>
                  : <span className="cl-code-str">&quot;{contest.assessment?.title || '—'}&quot;</span>,
                </span>
                <span className="cl-code-line">
                  {'  '}<span className="cl-code-key">&quot;duration&quot;</span>
                  : <span className="cl-code-num">{contest.assessment?.duration ?? '—'}</span>,
                </span>
                <span className="cl-code-line">
                  {'  '}<span className="cl-code-key">&quot;phase&quot;</span>
                  : <span className="cl-code-str">&quot;{phase}&quot;</span>
                </span>
                <span className="cl-code-line">{'}'}</span>
              </code>
            </pre>
            <div className="cl-code-footer">
              <FiCalendar aria-hidden />
              <span>Registration closes {formatDateShort(contest.registrationClosesAt)}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="cl-panel">
        <button
          type="button"
          className="login-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <FiSun /> : <FiMoon />}
        </button>

        <div className="login-panel-inner cl-panel-inner">
          <div className="login-form-card cl-form-card">
            <header className="login-panel-header">
              <h2>{panelTitle}</h2>
              <p>{panelSubtitle}</p>
            </header>

            {formError && (
              <div className="login-alert login-alert-error" role="alert">
                {formError}
              </div>
            )}

            {canStart && (
              <div className="cl-action-block">
                <div className="cl-action-success">
                  <FiCheckCircle />
                  <span>
                    {isLive
                      ? 'Attempt window is live right now.'
                      : 'You are cleared to start.'}
                  </span>
                </div>
                <button
                  type="button"
                  className="login-submit cl-start-btn"
                  onClick={handleStart}
                  disabled={submitting}
                >
                  <FiPlay />
                  {submitting
                    ? 'Starting…'
                    : participantStatus === 'in_progress'
                      ? 'Continue attempt'
                      : 'Start attempt'}
                </button>
              </div>
            )}

            {isRegistered && isWaiting && !canStart && (
              <div className="cl-action-block">
                <div className="cl-registered-banner">
                  <FiCheckCircle />
                  <div>
                    <strong>Registration confirmed</strong>
                    <p>
                      Hi{user?.name ? ` ${user.name.split(' ')[0]}` : ''}, you&apos;re in.
                      {countdownParts && (
                        <>
                          {' '}Window opens in{' '}
                          <strong>
                            {countdownParts.hours > 0 && `${countdownParts.hours}h `}
                            {countdownParts.minutes}m {countdownParts.seconds}s
                          </strong>.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="cl-info-list">
                  <div className="cl-info-row">
                    <FiCalendar />
                    <span>Opens {formatDateTime(contest.attemptWindowStart)}</span>
                  </div>
                  <div className="cl-info-row">
                    <FiClock />
                    <span>Closes {formatDateTime(contest.attemptWindowEnd)}</span>
                  </div>
                </div>
              </div>
            )}

            {isRegistered && isEnded && (
              <div className="cl-action-block">
                <div className="cl-registered-banner cl-registered-banner--muted">
                  <FiCheckCircle />
                  <div>
                    <strong>Contest ended</strong>
                    <p>
                      {contest.myResult
                        ? `Your rank: #${contest.myResult.rank} · Score ${contest.myResult.score}/${contest.myResult.maxScore} (${contest.myResult.percentage}%)`
                        : participantStatus === 'completed'
                          ? 'You completed this contest.'
                          : 'The attempt window has closed.'}
                    </p>
                  </div>
                </div>

                {contest.leaderboard?.length > 0 && (
                  <div className="cl-leaderboard">
                    <h3 className="cl-leaderboard-title">
                      <FiAward /> Leaderboard
                    </h3>
                    <div className="cl-leaderboard-table-wrap">
                      <table className="cl-leaderboard-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Score</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contest.leaderboard.slice(0, 20).map((row) => (
                            <tr
                              key={`${row.rank}-${row.studentEmail}`}
                              className={
                                contest.myResult?.studentEmail === row.studentEmail
                                  ? 'is-you'
                                  : undefined
                              }
                            >
                              <td>{row.rank}</td>
                              <td>{row.studentName || '—'}</td>
                              <td>
                                {row.score != null && row.maxScore != null
                                  ? `${row.score} / ${row.maxScore}`
                                  : '—'}
                              </td>
                              <td>{row.percentage != null ? `${row.percentage}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canJoin && (
              <div className="cl-action-block">
                <div className="cl-info-list">
                  <div className="cl-info-row">
                    <FiUser />
                    <span>Signed in as <strong>{user.email}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  className="login-submit"
                  onClick={handleJoin}
                  disabled={submitting}
                >
                  {submitting ? 'Joining…' : 'Join contest'}
                </button>
              </div>
            )}

            {canRegister && !user && (
              <>
                <div className="cl-auth-tabs">
                  <button
                    type="button"
                    className={`cl-auth-tab ${mode === 'register' ? 'is-active' : ''}`}
                    onClick={() => setMode('register')}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    className={`cl-auth-tab ${mode === 'login' ? 'is-active' : ''}`}
                    onClick={() => setMode('login')}
                  >
                    Login
                  </button>
                </div>

                {mode === 'login' ? (
                  <div className="cl-login-prompt">
                    <p>Already registered on the platform? Sign in to join this contest.</p>
                    <button type="button" className="login-submit" onClick={handleLoginRedirect}>
                      <FiLogIn /> Sign in to join
                    </button>
                  </div>
                ) : (
                  <form className="cl-register-form" onSubmit={handleRegister} noValidate>
                    <ContestField id="cl-name" label="Full name" icon={FiUser}>
                      <input
                        id="cl-name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Your full name"
                        disabled={submitting}
                      />
                    </ContestField>

                    <ContestField id="cl-email" label="Email address" icon={FiMail}>
                      <input
                        id="cl-email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        disabled={submitting}
                      />
                    </ContestField>

                    <ContestField id="cl-password" label="Password" icon={FiLock}>
                      <input
                        id="cl-password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Min. 6 characters"
                        disabled={submitting}
                      />
                    </ContestField>

                    {contest.settings?.collectPhone && (
                      <ContestField id="cl-phone" label="Phone number" icon={FiPhone}>
                        <input
                          id="cl-phone"
                          name="phone"
                          value={form.phone}
                          onChange={handleChange}
                          required
                          placeholder="Phone number"
                          disabled={submitting}
                        />
                      </ContestField>
                    )}

                    {contest.settings?.collectCollege && (
                      <ContestField id="cl-college" label="College" icon={FiBook}>
                        <input
                          id="cl-college"
                          name="college"
                          value={form.college}
                          onChange={handleChange}
                          required
                          placeholder="College name"
                          disabled={submitting}
                        />
                      </ContestField>
                    )}

                    {contest.settings?.collectRollNumber && (
                      <ContestField id="cl-roll" label="Roll number" icon={FiHash}>
                        <input
                          id="cl-roll"
                          name="rollNumber"
                          value={form.rollNumber}
                          onChange={handleChange}
                          required
                          placeholder="Roll number"
                          disabled={submitting}
                        />
                      </ContestField>
                    )}

                    <button type="submit" className="login-submit" disabled={submitting}>
                      {submitting ? 'Registering…' : 'Register for contest'}
                    </button>
                  </form>
                )}
              </>
            )}

            {!canRegister && !canJoin && !isRegistered && !isEnded && phase === 'registration_closed_waiting' && (
              <div className="login-alert login-alert-warn" role="status">
                Registration is closed. The attempt window opens at{' '}
                {formatDateShort(contest.attemptWindowStart)}.
              </div>
            )}

            {user && user.role !== 'student' && (
              <div className="login-alert login-alert-warn" role="alert">
                Please sign in with a student account to participate.
              </div>
            )}
          </div>

          <p className="login-panel-footer">
            Secure registration · Contest access is time-windowed
          </p>
        </div>
      </main>
    </div>
  );
};

export default ContestLanding;
