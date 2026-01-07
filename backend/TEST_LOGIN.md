# Test Login Credentials

## Super Admin Login

**Email:** admin@platform.com  
**Password:** admin123

## How to Test

1. Make sure backend server is running:
   ```bash
   cd backend
   npm start
   ```

2. Test login with curl:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@platform.com","password":"admin123"}'
   ```

3. Or use the frontend login page at: http://localhost:3000/login

## Reset Super Admin Password

If login still doesn't work, reset the password:
```bash
cd backend
node scripts/resetSuperAdmin.js
```

This will:
- Find or create the super admin
- Reset the password to match .env file
- Verify the password works

## Troubleshooting

1. **Check MongoDB is running:**
   ```bash
   mongosh
   ```

2. **Check if user exists:**
   ```bash
   cd backend
   node -e "
   const mongoose = require('mongoose');
   const User = require('./models/User');
   require('dotenv').config();
   mongoose.connect(process.env.MONGODB_URI).then(async () => {
     const user = await User.findOne({ email: 'admin@platform.com' });
     console.log('User:', user ? 'Found' : 'Not found');
     if (user) {
       console.log('Email:', user.email);
       console.log('Role:', user.role);
       console.log('Is Active:', user.isActive);
     }
     process.exit(0);
   });
   "
   ```

3. **Verify .env file:**
   ```bash
   cd backend
   cat .env | grep SUPER_ADMIN
   ```

