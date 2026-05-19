const User = require('../models/User');

function getSuperAdminCredentials() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com').toLowerCase().trim();
  const password = (process.env.SUPER_ADMIN_PASSWORD || 'admin123').trim();
  return { email, password };
}

const initSuperAdmin = async () => {
  try {
    const { email: superAdminEmail, password: superAdminPassword } = getSuperAdminCredentials();

    if (!superAdminPassword || superAdminPassword.length < 6) {
      console.warn(
        '⚠️ SUPER_ADMIN_PASSWORD must be at least 6 characters — super admin sync skipped'
      );
      return;
    }

    console.log('👤 Checking super admin...');
    console.log('📧 Email:', superAdminEmail);

    let existingAdmin =
      (await User.findOne({ email: superAdminEmail })) ||
      (await User.findOne({ role: 'super_admin' }));

    if (existingAdmin) {
      let updated = false;

      if (existingAdmin.email !== superAdminEmail) {
        const emailTaken = await User.findOne({
          email: superAdminEmail,
          _id: { $ne: existingAdmin._id },
        });
        if (emailTaken) {
          console.error(
            `❌ Cannot sync super admin email to ${superAdminEmail} — already used by another account`
          );
        } else {
          existingAdmin.email = superAdminEmail;
          updated = true;
          console.log('🔄 Super admin email updated from env');
        }
      }

      if (existingAdmin.role !== 'super_admin') {
        existingAdmin.role = 'super_admin';
        updated = true;
      }

      if (!existingAdmin.isActive) {
        existingAdmin.isActive = true;
        updated = true;
      }

      const passwordMatches = await existingAdmin.comparePassword(superAdminPassword);
      if (!passwordMatches) {
        existingAdmin.password = superAdminPassword;
        updated = true;
        console.log('🔄 Super admin password synced from SUPER_ADMIN_PASSWORD');
      }

      if (updated) {
        await existingAdmin.save();
        console.log('✅ Super admin updated');
      } else {
        console.log('✅ Super admin already in sync with env');
      }

      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Is Active:', existingAdmin.isActive);
      return;
    }

    console.log('➕ Creating super admin from env...');
    const superAdmin = new User({
      name: 'Super Admin',
      email: superAdminEmail,
      password: superAdminPassword,
      role: 'super_admin',
    });

    await superAdmin.save();
    console.log('✅ Super admin created successfully');
    console.log('   Email:', superAdminEmail);
  } catch (error) {
    console.error('❌ Error initializing super admin:', error.message);
  }
};

module.exports = initSuperAdmin;
