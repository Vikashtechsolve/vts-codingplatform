# Development Setup

## Auto-Restart with Nodemon

The backend now uses **nodemon** for automatic server restart when code changes.

### Start Development Server

```bash
cd backend
npm run dev
```

This will:
- ✅ Watch for file changes in `.js` and `.json` files
- ✅ Automatically restart the server when you save changes
- ✅ Ignore `node_modules` and `uploads` folders
- ✅ Show restart messages in console

### Alternative Commands

```bash
# Using nodemon directly
npm run dev

# Or use watch script
npm run watch

# Production (no auto-restart)
npm start
```

## Troubleshooting Vendor Admin Login

If you're getting "unauthorized" errors:

### Step 1: Check Backend Logs

The enhanced logging will show:
- 🔐 Token verification status
- ✅ User found/not found
- 🏢 Tenant middleware status
- ❌ Any errors

### Step 2: Verify Token is Being Sent

Check browser Network tab:
- Request should have `Authorization: Bearer <token>` header
- Token should be present after login

### Step 3: Run Fix Script

```bash
cd backend
node scripts/fixVendorAdmin.js <vendor-email>
```

### Step 4: Check Environment Variables

Make sure `.env` has:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-long-and-random-123456789
```

### Step 5: Verify User in Database

```bash
node scripts/checkVendorAdmin.js
```

## Common Issues

### Issue: "No token, authorization denied"
- **Cause**: Token not being sent from frontend
- **Fix**: Check axios interceptor in `frontend/src/utils/axios.js`

### Issue: "Token is not valid"
- **Cause**: JWT_SECRET mismatch or token expired
- **Fix**: Check `.env` file, restart server

### Issue: "User not found"
- **Cause**: User deleted or ID mismatch
- **Fix**: Run `fixVendorAdmin.js` script

### Issue: "Vendor admin has no vendor assigned"
- **Cause**: vendorId is null
- **Fix**: Run `fixVendorAdmin.js` script

## Debugging

Enable detailed logs by checking backend console. All middleware now logs:
- Auth middleware: Token verification
- Authorize middleware: Role check
- Tenant middleware: Vendor ID assignment

