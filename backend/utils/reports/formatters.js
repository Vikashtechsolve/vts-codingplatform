const truncate = (value, max = 500) => {
  if (value == null) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
};

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return '';
  }
};

const formatMinutes = (seconds) => {
  if (seconds == null || Number.isNaN(Number(seconds))) return '';
  const mins = Math.round(Number(seconds) / 60);
  return mins;
};

const formatBool = (v) => (v === true ? 'Yes' : v === false ? 'No' : '');

const formatArray = (arr) => (Array.isArray(arr) ? arr.join('; ') : '');

const safeNum = (n, decimals = 2) => {
  if (n == null || Number.isNaN(Number(n))) return '';
  return Number(Number(n).toFixed(decimals));
};

module.exports = {
  truncate,
  formatDate,
  formatMinutes,
  formatBool,
  formatArray,
  safeNum,
};
