/**
 * One-time repair: assign vendorId to students missing it (from classroom or enrolled tests).
 * Run: node scripts/fixStudentVendorIds.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { resolveVendorIdFromStudentContext } = require('../utils/vendorBranding');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const students = await User.find({ role: 'student', $or: [{ vendorId: null }, { vendorId: { $exists: false } }] });
  console.log(`Found ${students.length} student(s) without vendorId`);

  let fixed = 0;
  for (const student of students) {
    const vendorId = await resolveVendorIdFromStudentContext(student._id);
    if (vendorId) {
      student.vendorId = vendorId;
      await student.save();
      console.log(`✅ ${student.email} → vendor ${vendorId}`);
      fixed += 1;
    } else {
      console.log(`⚠️  ${student.email} — no classroom/test vendor found`);
    }
  }

  console.log(`Done. Fixed ${fixed} / ${students.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
