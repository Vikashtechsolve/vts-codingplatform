const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('❌ JWT_SECRET is not set in environment variables!');
    throw new Error('JWT_SECRET is required');
  }

  const token = jwt.sign(
    { userId },
    secret,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  console.log('🎫 Token generated for userId:', userId);
  console.log('   Secret length:', secret.length);
  console.log('   Token length:', token.length);
  
  return token;
};

module.exports = generateToken;

