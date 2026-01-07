# Vendor Admin Login Fix Guide

## Quick Fix Steps

### Step 1: Run the Fix Script

Run this command with your vendor email:

```bash
cd backend
node scripts/fixVendorAdmin.js <vendor-email>
```

**Example:**
```bash
node scripts/fixVendorAdmin.js vendor@example.com
```

This script will:
- ✅ Find or create the vendor admin user
- ✅ Normalize the email (lowercase + trim)
- ✅ Set `isActive: true`
- ✅ Assign correct `vendorId`
- ✅ Reset password to `vendor123`
- ✅ Verify password works

### Step 2: Try Login Again

After running the script, try logging in with:
- **Email**: The vendor email (case doesn't matter)
- **Password**: `vendor123`

---

## What the Fix Script Does

1. **Finds the vendor admin user** (case-insensitive search)
2. **Fixes email normalization** if needed
3. **Activates the account** if inactive
4. **Assigns vendor ID** if missing
5. **Resets password** to `vendor123` and verifies it works

---

## Troubleshooting

### If script says "User not found"

1. Check if vendor exists:
   ```bash
   # Check backend console when creating vendor
   # Look for: "✅ Vendor admin user created: [email]"
   ```

2. Verify email spelling:
   - Check the exact email used when creating vendor
   - Email is case-insensitive, but spelling must match

3. Check MongoDB directly:
   ```bash
   # Connect to MongoDB
   mongo
   use coding-platform
   db.users.find({role: "vendor_admin"})
   ```

### If password still doesn't work

1. Run the fix script again
2. Check backend console logs during login attempt
3. Verify password is exactly `vendor123` (no spaces, correct case)

### If account is inactive

The fix script automatically activates accounts. If still inactive:
```bash
# Run fix script - it will activate the account
node scripts/fixVendorAdmin.js <vendor-email>
```

---

## Manual Fix (if script doesn't work)

If the script doesn't work, you can manually fix using MongoDB:

```javascript
// Connect to MongoDB
use coding-platform

// Find vendor admin user
var user = db.users.findOne({role: "vendor_admin", email: /vendor@example.com/i})

// Update user
db.users.updateOne(
  {_id: user._id},
  {
    $set: {
      email: "vendor@example.com".toLowerCase().trim(),
      isActive: true,
      password: "$2a$10$..." // This needs to be bcrypt hash
    }
  }
)
```

**Note**: For password, use the resetPassword script instead:
```bash
node scripts/resetPassword.js vendor@example.com vendor123
```

---

## Verification

After running the fix script, you should see:

```
✅ MongoDB Connected

🔍 Looking for vendor admin with email: vendor@example.com
✅ Vendor admin user found
   Current email: vendor@example.com
   Is Active: true
   Vendor ID: [some-id]
📝 Resetting password to vendor123...
✅ Vendor admin user fixed successfully!

🔐 Verifying password...
Password verification: ✅ Success

📊 Final Status:
   Email: vendor@example.com
   Role: vendor_admin
   Is Active: true
   Vendor ID: [some-id]

✅ Login credentials:
   Email: vendor@example.com
   Password: vendor123
```

---

## Still Having Issues?

1. **Check backend console** when logging in - it shows detailed logs
2. **Run check script** to see all vendor admins:
   ```bash
   node scripts/checkVendorAdmin.js
   ```
3. **Verify email** matches exactly (check for typos)
4. **Try creating a new vendor** to test if the issue persists

---

## Prevention

For new vendors, the system now:
- ✅ Normalizes emails automatically
- ✅ Sets `isActive: true` explicitly
- ✅ Verifies password after creation
- ✅ Auto-fixes email case issues during login

