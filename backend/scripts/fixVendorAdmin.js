const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

dotenv.config();

const fixVendorAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform');
    console.log('✅ MongoDB Connected\n');

    const email = process.argv[2];
    if (!email) {
      console.error('Usage: node scripts/fixVendorAdmin.js <vendor-email>');
      process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔍 Looking for vendor admin with email:', normalizedEmail);

    // Find vendor admin user
    let vendorAdmin = await User.findOne({ 
      $or: [
        { email: normalizedEmail },
        { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
      ],
      role: 'vendor_admin'
    });

    if (!vendorAdmin) {
      console.log('❌ Vendor admin user not found');
      
      // Check if vendor exists
      const vendor = await Vendor.findOne({ 
        $or: [
          { email: normalizedEmail },
          { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
        ]
      });

      if (vendor) {
        console.log('✅ Vendor found:', vendor.companyName);
        console.log('📝 Creating vendor admin user...');
        
        try {
          vendorAdmin = new User({
            name: vendor.name,
            email: normalizedEmail,
            password: 'vendor123',
            role: 'vendor_admin',
            vendorId: vendor._id,
            isActive: true
          });
          
          await vendorAdmin.save();
          console.log('✅ Vendor admin user created successfully!');
        } catch (saveError) {
          if (saveError.code === 11000) {
            console.log('⚠️  Duplicate key error - checking for existing user...');
            // Try to find existing user with different case
            const existingUser = await User.findOne({
              $or: [
                { email: normalizedEmail },
                { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
              ]
            });
            
            if (existingUser) {
              console.log('✅ Found existing user, updating...');
              vendorAdmin = existingUser;
              vendorAdmin.name = vendor.name;
              vendorAdmin.email = normalizedEmail;
              vendorAdmin.password = 'vendor123';
              vendorAdmin.role = 'vendor_admin';
              vendorAdmin.vendorId = vendor._id;
              vendorAdmin.isActive = true;
              await vendorAdmin.save();
              console.log('✅ Existing user updated successfully!');
            } else {
              console.log('❌ Index issue detected. Run: node scripts/fixMongoIndex.js');
              throw saveError;
            }
          } else {
            throw saveError;
          }
        }
      } else {
        console.log('❌ Vendor not found either');
        process.exit(1);
      }
    } else {
      console.log('✅ Vendor admin user found');
      console.log('   Current email:', vendorAdmin.email);
      console.log('   Is Active:', vendorAdmin.isActive);
      console.log('   Vendor ID:', vendorAdmin.vendorId);
      
      // Fix email if needed
      if (vendorAdmin.email !== normalizedEmail) {
        console.log('📝 Fixing email normalization...');
        vendorAdmin.email = normalizedEmail;
      }
      
      // Ensure isActive is true
      if (!vendorAdmin.isActive) {
        console.log('📝 Activating account...');
        vendorAdmin.isActive = true;
      }
      
      // Ensure vendorId exists
      if (!vendorAdmin.vendorId) {
        console.log('📝 Finding and assigning vendor ID...');
        const vendor = await Vendor.findOne({ 
          $or: [
            { email: normalizedEmail },
            { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
          ]
        });
        if (vendor) {
          vendorAdmin.vendorId = vendor._id;
          console.log('✅ Vendor ID assigned:', vendor._id);
        } else {
          console.log('⚠️  No vendor found for this email');
        }
      }
      
      // Reset password to vendor123
      console.log('📝 Resetting password to vendor123...');
      vendorAdmin.password = 'vendor123'; // Will be hashed by pre-save hook
      
      await vendorAdmin.save();
      console.log('✅ Vendor admin user fixed successfully!');
    }

    // Verify password
    console.log('\n🔐 Verifying password...');
    const isMatch = await vendorAdmin.comparePassword('vendor123');
    console.log('Password verification:', isMatch ? '✅ Success' : '❌ Failed');

    // Final status
    console.log('\n📊 Final Status:');
    console.log('   Email:', vendorAdmin.email);
    console.log('   Role:', vendorAdmin.role);
    console.log('   Is Active:', vendorAdmin.isActive);
    console.log('   Vendor ID:', vendorAdmin.vendorId);
    console.log('\n✅ Login credentials:');
    console.log('   Email:', vendorAdmin.email);
    console.log('   Password: vendor123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    mongoose.disconnect();
  }
};

fixVendorAdmin();

