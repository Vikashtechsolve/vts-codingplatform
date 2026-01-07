const Vendor = require('../models/Vendor');

// Middleware to ensure vendor admin can only access their own vendor data
const tenantMiddleware = async (req, res, next) => {
  try {
    console.log('🏢 Tenant middleware - User role:', req.user?.role, 'VendorId:', req.user?.vendorId);

    if (req.user.role === 'super_admin') {
      // Super admin can access all vendors
      console.log('✅ Super admin - access granted');
      return next();
    }

    if (req.user.role === 'vendor_admin') {
      // Vendor admin can only access their own vendor
      if (!req.user.vendorId) {
        console.log('❌ Vendor admin has no vendorId assigned');
        return res.status(403).json({ message: 'Vendor admin has no vendor assigned' });
      }
      req.vendorId = req.user.vendorId;
      console.log('✅ Vendor admin - vendorId set to:', req.vendorId);
      return next();
    }

    if (req.user.role === 'student') {
      // Students can access their vendor's data
      if (!req.user.vendorId) {
        console.log('❌ Student has no vendorId assigned');
        return res.status(403).json({ message: 'Student has no vendor assigned' });
      }
      req.vendorId = req.user.vendorId;
      console.log('✅ Student - vendorId set to:', req.vendorId);
      return next();
    }

    console.log('❌ Unknown role:', req.user.role);
    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('❌ Tenant middleware error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = tenantMiddleware;

