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
    timeout: 'Time Limit',
    solved: 'Solved',
    attempted: 'Attempted',
    unsolved: 'Not Started',
  };
  return map[status] || capitalize(status);
}

export function statusClass(status) {
  if (status === 'accepted' || status === 'solved') return 'solved';
  if (status === 'unsolved') return 'unsolved';
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
