export function capitalize(str) {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

export function formatStatus(status) {
  const map = {
    accepted: 'Accepted',
    wrong_answer: 'Wrong Answer',
    runtime_error: 'Runtime Error',
    compile_error: 'Compile Error',
    timeout: 'Time Limit Exceeded',
    solved: 'Solved',
    attempted: 'Attempted',
    unsolved: 'Todo',
    todo: 'Todo',
  };
  return map[status] || capitalize(status);
}

export function statusClass(status) {
  if (status === 'accepted' || status === 'solved') return 'solved';
  if (!status || status === 'unsolved' || status === 'todo') return 'unsolved';
  return 'attempted';
}

export function formatMs(ms) {
  if (!ms) return '—';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `${h}h ${rem}m`;
}

export function formatLanguage(lang) {
  const map = { python: 'Python', java: 'Java', cpp: 'C++', c: 'C' };
  return map[lang] || capitalize(lang);
}

export function formatRelativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function formatScore(score) {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return `${Math.round(Number(score))}%`;
}
