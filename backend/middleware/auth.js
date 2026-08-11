const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    console.log('🔐 Auth middleware - Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      console.log('❌ No Authorization header found');
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      console.log('❌ Token is empty');
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    console.log('🔐 Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded, userId:', decoded.userId);

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('❌ User not found for userId:', decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.email, 'Role:', user.role, 'Active:', user.isActive);

    if (!user.isActive) {
      console.log('❌ User is inactive:', user.email);
      return res.status(401).json({ message: 'Account is inactive' });
    }

    req.user = user;
    console.log('✅ Auth middleware passed for:', user.email);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Token is not valid', error: error.message });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = { auth, authorize };

