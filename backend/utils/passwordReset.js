const crypto = require('crypto');

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRE_MINUTES = 60;

const getExpireMinutes = () => {
  const n = parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPIRE_MINUTES;
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const generateResetToken = () => {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + getExpireMinutes() * 60 * 1000);
  return { token, tokenHash, expiresAt };
};

const isResetTokenValid = (user, rawToken) => {
  if (!user?.passwordResetTokenHash || !user?.passwordResetExpires || !rawToken) {
    return false;
  }
  if (user.passwordResetExpires.getTime() < Date.now()) {
    return false;
  }
  const incomingHash = hashToken(rawToken);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(incomingHash, 'hex'),
      Buffer.from(user.passwordResetTokenHash, 'hex')
    );
  } catch {
    return false;
  }
};

const clearResetFields = (user) => {
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
};

module.exports = {
  hashToken,
  generateResetToken,
  isResetTokenValid,
  clearResetFields,
  getExpireMinutes,
};
