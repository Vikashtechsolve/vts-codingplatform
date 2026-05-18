/**
 * Student share / join links — open assessment directly after login.
 */

export const getJoinPath = (item) => {
  if (!item?._id) return '';

  if (item.kind === 'interview') {
    return `/join/interview/${item._id}`;
  }
  if (item.kind === 'assignment') {
    return `/join/assignment/${item._id}`;
  }
  if (item.kind === 'system_design') {
    return `/join/system-design/${item._id}`;
  }

  const typeQuery =
    item.type === 'english' ? '?type=english' : item.type ? `?type=${encodeURIComponent(item.type)}` : '';
  return `/join/test/${item._id}${typeQuery}`;
};

export const getStudentAttemptPath = (item) => {
  if (!item?._id) return '';

  if (item.kind === 'interview') {
    return `/student/interviews/${item._id}`;
  }
  if (item.kind === 'assignment') {
    return `/student/submit-assignment/${item._id}`;
  }
  if (item.kind === 'system_design') {
    return `/student/system-design/${item._id}`;
  }
  if (item.type === 'english') {
    return `/student/english-test/${item._id}`;
  }
  return `/student/test/${item._id}`;
};

export const getFullShareUrl = (item) => {
  if (typeof window === 'undefined') return getJoinPath(item);
  return `${window.location.origin}${getJoinPath(item)}`;
};

/** Resolve join URL path segments to student attempt route */
export const resolveJoinTarget = ({ kind, id, searchParams }) => {
  if (!id) return '/student/dashboard';

  switch (kind) {
    case 'interview':
      return `/student/interviews/${id}`;
    case 'assignment':
      return `/student/submit-assignment/${id}`;
    case 'system-design':
      return `/student/system-design/${id}`;
    case 'test':
    default: {
      const type = searchParams?.get('type');
      if (type === 'english') return `/student/english-test/${id}`;
      return `/student/test/${id}`;
    }
  }
};
