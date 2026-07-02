/**
 * Normalize assessments from different APIs into a unified shape for section detail UI.
 */

export const STATUS_GROUPS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
};

/** User-facing filter tabs */
export const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  {
    id: 'pending',
    label: 'Pending',
    groups: [STATUS_GROUPS.TODO, STATUS_GROUPS.IN_PROGRESS, STATUS_GROUPS.PENDING, STATUS_GROUPS.OVERDUE],
  },
  { id: 'completed', label: 'Completed' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'todo', label: 'Not started' },
];

export const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently assigned' },
  { id: 'title', label: 'Title (A–Z)' },
  { id: 'status', label: 'By status' },
  { id: 'score', label: 'Score (high to low)' },
];

const STATUS_ORDER = {
  overdue: 0,
  in_progress: 1,
  todo: 2,
  pending: 3,
  completed: 4,
};

function formatDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
}

function mapTestStatus(enrollmentStatus) {
  if (enrollmentStatus === 'completed') return { group: STATUS_GROUPS.COMPLETED, key: 'completed', label: 'Completed' };
  if (enrollmentStatus === 'in_progress') return { group: STATUS_GROUPS.IN_PROGRESS, key: 'in_progress', label: 'In progress' };
  return { group: STATUS_GROUPS.TODO, key: 'assigned', label: 'Not started' };
}

function getTestAction(test) {
  const isEnglish = test.type === 'english' || test.type === 'verbal';
  const basePath = isEnglish ? `/student/english-test/${test._id}` : `/student/test/${test._id}`;
  const contestQuery = test.contestId ? `?contestId=${test.contestId}` : '';
  const base = `${basePath}${contestQuery}`;
  const resultBase = isEnglish
    ? (test.resultId
        ? `/student/english-result/${test.resultId}`
        : `/student/english-result/test/${test._id}`)
    : test.resultId
      ? `/student/result/${test.resultId}`
      : `/student/result/test/${test._id}`;

  if (test.enrollmentStatus === 'completed') {
    return { primary: { label: 'View result', link: resultBase, variant: 'secondary' } };
  }

  if (test.enrollmentStatus === 'in_progress') {
    if (test.canContinueAttempt === false) {
      return {
        primary: {
          label: 'Window closed',
          disabled: true,
          hint: test.scheduleMessage || 'The attempt window has ended.',
        },
      };
    }
    return { primary: { label: 'Continue test', link: base, variant: 'primary' } };
  }

  if (test.schedulePhase === 'upcoming') {
    return {
      primary: {
        label: test.scheduleWindowStart
          ? `Opens ${formatDate(test.scheduleWindowStart)}`
          : 'Not open yet',
        disabled: true,
        hint: test.scheduleMessage || 'This test is not open yet.',
      },
    };
  }

  if (test.schedulePhase === 'ended' || test.canStartAttempt === false) {
    return {
      primary: {
        label: 'Window closed',
        disabled: true,
        hint: test.scheduleMessage || 'The scheduled attempt window has ended.',
      },
    };
  }

  return { primary: { label: 'Start test', link: base, variant: 'primary' } };
}

export function normalizeTestItem(test) {
  let st = mapTestStatus(test.enrollmentStatus || 'assigned');
  if (test.schedulePhase === 'upcoming' && test.enrollmentStatus !== 'completed') {
    st = { group: STATUS_GROUPS.TODO, key: 'upcoming', label: 'Opens soon' };
  } else if (
    test.schedulePhase === 'ended' &&
    test.enrollmentStatus !== 'completed' &&
    test.enrollmentStatus !== 'in_progress'
  ) {
    st = { group: STATUS_GROUPS.OVERDUE, key: 'window_closed', label: 'Window closed' };
  }

  const meta = [];
  if (test.duration) meta.push({ label: 'Duration', value: `${test.duration} min` });
  if (test.scheduleWindowStart || test.startDate) {
    meta.push({ label: 'Starts', value: formatDate(test.scheduleWindowStart || test.startDate) });
  }
  if (test.scheduleWindowEnd || test.endDate) {
    meta.push({ label: 'Ends', value: formatDate(test.scheduleWindowEnd || test.endDate) });
  }
  if (test.assignedAt) meta.push({ label: 'Assigned', value: formatDate(test.assignedAt) });
  if (test.submittedAt && st.group === STATUS_GROUPS.COMPLETED) {
    meta.push({ label: 'Submitted', value: formatDate(test.submittedAt) });
  }

  return {
    id: test._id,
    title: test.title,
    description: test.description,
    typeLabel: test.type,
    statusGroup: st.group,
    statusKey: st.key,
    statusLabel: st.label,
    score: test.percentage != null ? Math.round(test.percentage) : null,
    assignedAt: test.assignedAt,
    sortDate: test.assignedAt || test.startDate,
    meta,
    ...getTestAction(test),
    raw: test,
  };
}

export function normalizeInterviewItem(interview) {
  const hasCompleted = interview.hasCompleted;
  const canRetry = interview.allowMultipleAttempts === true;

  let st;
  if (hasCompleted && !canRetry) {
    st = { group: STATUS_GROUPS.COMPLETED, key: 'completed', label: 'Completed' };
  } else if (hasCompleted && canRetry) {
    st = { group: STATUS_GROUPS.COMPLETED, key: 'completed', label: 'Completed' };
  } else if (interview.enrollmentStatus === 'in_progress') {
    st = { group: STATUS_GROUPS.IN_PROGRESS, key: 'in_progress', label: 'In progress' };
  } else {
    st = { group: STATUS_GROUPS.TODO, key: 'assigned', label: 'Not started' };
  }

  const meta = [];
  if (interview.duration) meta.push({ label: 'Duration', value: `${interview.duration} min` });
  if (interview.interviewType) meta.push({ label: 'Type', value: interview.interviewType });
  if (interview.difficulty) meta.push({ label: 'Difficulty', value: interview.difficulty });

  const actions = { primary: { label: 'Start interview', link: `/student/interviews/${interview._id}`, variant: 'primary' } };
  if (hasCompleted && interview.lastSessionId) {
    actions.secondary = { label: 'View feedback', link: `/student/interviews/feedback/${interview.lastSessionId}`, variant: 'secondary' };
    if (canRetry) {
      actions.primary = { label: 'Retake interview', link: `/student/interviews/${interview._id}`, variant: 'primary' };
    } else {
      actions.primary = actions.secondary;
      delete actions.secondary;
    }
  }

  return {
    id: interview._id,
    title: interview.title,
    description: null,
    typeLabel: 'interview',
    statusGroup: st.group,
    statusKey: st.key,
    statusLabel: st.label,
    score: null,
    assignedAt: interview.assignedAt,
    sortDate: interview.assignedAt,
    meta,
    ...actions,
    raw: interview,
  };
}

export function normalizeProjectItem(item) {
  const assignment = item.assignment || item;
  const status = item.enrollmentStatus || 'assigned';
  const isOverdue = item.isOverdue && status !== 'evaluated';
  const submissionId = item.submission?._id ?? item.submission ?? item.enrollmentData?.submissionId;

  let st;
  if (isOverdue) st = { group: STATUS_GROUPS.OVERDUE, key: 'overdue', label: 'Overdue' };
  else if (status === 'evaluated') st = { group: STATUS_GROUPS.COMPLETED, key: 'evaluated', label: 'Completed' };
  else if (status === 'submitted') st = { group: STATUS_GROUPS.PENDING, key: 'submitted', label: 'Under review' };
  else if (status === 'in_progress') st = { group: STATUS_GROUPS.IN_PROGRESS, key: 'in_progress', label: 'In progress' };
  else st = { group: STATUS_GROUPS.TODO, key: 'assigned', label: 'Not started' };

  const meta = [];
  if (assignment.duration) meta.push({ label: 'Duration', value: `${assignment.duration} min` });
  if (assignment.category) meta.push({ label: 'Category', value: assignment.category });
  if (assignment.difficulty) meta.push({ label: 'Difficulty', value: assignment.difficulty });
  if (item.deadline) meta.push({ label: 'Deadline', value: formatDate(item.deadline) });
  if (item.assignedAt) meta.push({ label: 'Assigned', value: formatDate(item.assignedAt) });

  const link = `/student/submit-assignment/${assignment._id}`;
  const actions = {};

  if (st.group === STATUS_GROUPS.COMPLETED && submissionId) {
    actions.primary = { label: 'View result', link: `/student/submission/${submissionId}/result`, variant: 'secondary' };
  } else if (st.group === STATUS_GROUPS.PENDING && submissionId) {
    actions.primary = { label: 'Check status', link: `/student/submission/${submissionId}/result`, variant: 'primary' };
    if (item.timerEndAt && new Date(item.timerEndAt) > new Date()) {
      actions.secondary = { label: 'Edit submission', link, variant: 'secondary' };
    }
  } else if (st.group === STATUS_GROUPS.IN_PROGRESS && !isOverdue) {
    actions.primary = { label: 'Submit project', link, variant: 'primary' };
  } else if (st.group === STATUS_GROUPS.TODO && !isOverdue) {
    actions.primary = { label: 'Start assignment', link, variant: 'primary' };
  }

  const sub = item.submission;
  const score = sub?.percentage ?? sub?.overallScore ?? sub?.score ?? null;

  return {
    id: assignment._id,
    title: assignment.title,
    description: assignment.description,
    typeLabel: 'project',
    statusGroup: st.group,
    statusKey: st.key,
    statusLabel: st.label,
    score: score != null ? Math.round(Number(score)) : null,
    assignedAt: item.assignedAt,
    sortDate: item.assignedAt,
    meta,
    ...actions,
    raw: item,
  };
}

export function normalizeSystemDesignItem(sd) {
  const status = sd.submission ? sd.submission.status : 'assigned';

  let st;
  if (status === 'evaluated') st = { group: STATUS_GROUPS.COMPLETED, key: 'evaluated', label: 'Completed' };
  else if (['submitted', 'evaluating'].includes(status)) st = { group: STATUS_GROUPS.PENDING, key: status, label: status === 'evaluating' ? 'Evaluating' : 'Under review' };
  else if (status === 'follow_up') st = { group: STATUS_GROUPS.IN_PROGRESS, key: 'follow_up', label: 'Follow-up' };
  else if (status === 'in_progress') st = { group: STATUS_GROUPS.IN_PROGRESS, key: 'in_progress', label: 'In progress' };
  else st = { group: STATUS_GROUPS.TODO, key: 'assigned', label: 'Not started' };

  const meta = [];
  if (sd.duration) meta.push({ label: 'Duration', value: `${sd.duration} min` });
  if (sd.difficulty) meta.push({ label: 'Difficulty', value: sd.difficulty });
  if (sd.category) meta.push({ label: 'Category', value: sd.category });

  let actions = {};
  if (st.key === 'evaluated' && sd.submission?._id) {
    actions.primary = { label: 'View result', link: `/student/system-design-result/${sd.submission._id}`, variant: 'secondary' };
  } else if (st.key === 'follow_up') {
    actions.primary = { label: 'Answer follow-up', link: `/student/system-design/${sd.submission._id}/follow-up`, variant: 'primary' };
  } else if (!['submitted', 'evaluating'].includes(st.key)) {
    actions.primary = {
      label: st.group === STATUS_GROUPS.IN_PROGRESS ? 'Continue' : 'Start',
      link: `/student/system-design/${sd._id}`,
      variant: 'primary',
    };
  }

  return {
    id: sd._id,
    title: sd.title,
    description: sd.description,
    typeLabel: 'system design',
    statusGroup: st.group,
    statusKey: st.key,
    statusLabel: st.label,
    score: sd.submission?.percentage != null ? Math.round(sd.submission.percentage) : null,
    assignedAt: null,
    sortDate: sd.createdAt,
    meta,
    ...actions,
    raw: sd,
  };
}

/** Map section id → tests from API (handles type aliases) */
export function filterItemsBySection(sectionId, { tests, interviews, assignments, systemDesigns }) {
  if (sectionId === 'interview') return interviews || [];
  if (sectionId === 'project') return assignments || [];
  if (sectionId === 'system') return systemDesigns || [];
  if (!tests?.length) return [];

  if (sectionId === 'core') return tests.filter((t) => t.type === 'theory');
  if (sectionId === 'tools') return tests.filter((t) => t.type === 'sql');
  if (sectionId === 'english') return tests.filter((t) => t.type === 'english' || t.type === 'verbal');
  if (sectionId === 'company') {
    return tests.filter((t) => t.type === 'company' || t.category === 'company');
  }

  return tests.filter((t) => t.type === sectionId);
}

export function normalizeSectionItems(sectionId, rawItems) {
  if (sectionId === 'interview') return rawItems.map(normalizeInterviewItem);
  if (sectionId === 'project') return rawItems.map(normalizeProjectItem);
  if (sectionId === 'system') return rawItems.map(normalizeSystemDesignItem);
  return rawItems.map(normalizeTestItem);
}

export function computeSectionStats(items) {
  const total = items.length;
  const completed = items.filter((i) => i.statusGroup === STATUS_GROUPS.COMPLETED).length;
  const inProgress = items.filter((i) => i.statusGroup === STATUS_GROUPS.IN_PROGRESS).length;
  const todo = items.filter((i) => i.statusGroup === STATUS_GROUPS.TODO).length;
  const pending = items.filter((i) => i.statusGroup === STATUS_GROUPS.PENDING).length;
  const overdue = items.filter((i) => i.statusGroup === STATUS_GROUPS.OVERDUE).length;
  const notDone = todo + inProgress + pending + overdue;
  const scored = items.filter((i) => i.score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length)
    : null;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, inProgress, todo, pending, overdue, notDone, avgScore, completionRate, scoredCount: scored.length };
}

export function applyFiltersAndSort(items, { filter, search, sort }) {
  let list = [...items];

  if (filter && filter !== 'all') {
    const opt = FILTER_OPTIONS.find((o) => o.id === filter);
    if (opt?.groups) {
      list = list.filter((i) => opt.groups.includes(i.statusGroup));
    } else {
      list = list.filter((i) => i.statusGroup === filter);
    }
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (i) =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.typeLabel?.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sort === 'score') {
      return (b.score ?? -1) - (a.score ?? -1);
    }
    if (sort === 'status') {
      return (STATUS_ORDER[a.statusGroup] ?? 9) - (STATUS_ORDER[b.statusGroup] ?? 9);
    }
    const da = new Date(a.sortDate || 0).getTime();
    const db = new Date(b.sortDate || 0).getTime();
    return db - da;
  });

  return list;
}

export function getFilterCounts(items) {
  const counts = { total: items.length };
  FILTER_OPTIONS.forEach((opt) => {
    if (opt.id === 'all') return;
    if (opt.groups) {
      counts[opt.id] = items.filter((i) => opt.groups.includes(i.statusGroup)).length;
    } else {
      counts[opt.id] = items.filter((i) => i.statusGroup === opt.id).length;
    }
  });
  return counts;
}
