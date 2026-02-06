# Railway Deployment Checklist ✅

## Pre-Deployment Checklist

### Files Required
- [x] `backend/Dockerfile` - Installs all compilers
- [x] `backend/.dockerignore` - Optimizes builds
- [x] `backend/railway.json` - Railway configuration
- [x] `backend/package.json` - Node.js dependencies

### GitHub Setup
- [ ] Code pushed to GitHub
- [ ] All files committed
- [ ] Repository is accessible

### Railway Account
- [ ] Railway account created
- [ ] GitHub connected to Railway

### MongoDB Setup
- [ ] MongoDB Atlas account created (or local MongoDB)
- [ ] Database cluster created
- [ ] Connection string ready
- [ ] IP whitelist configured (`0.0.0.0/0` for Railway)

---

## Deployment Steps

### Step 1: Connect Railway to GitHub
- [ ] Go to railway.app
- [ ] Click "New Project"
- [ ] Select "Deploy from GitHub repo"
- [ ] Choose your repository

### Step 2: Configure Service
- [ ] Click on service
- [ ] Go to Settings tab
- [ ] Set Root Directory: `backend`
- [ ] Verify Dockerfile is detected

### Step 3: Set Environment Variables
- [ ] `PORT=5000`
- [ ] `MONGODB_URI=mongodb+srv://...`
- [ ] `JWT_SECRET=(generated 64-byte hex)`
- [ ] `JWT_EXPIRE=365d`
- [ ] `NODE_ENV=production`
- [ ] `CODE_EXECUTION_TIMEOUT=10000`
- [ ] `MAX_VIOLATIONS=3`
- [ ] `SUPER_ADMIN_EMAIL=admin@yourdomain.com`
- [ ] `SUPER_ADMIN_PASSWORD=secure-password`

### Step 4: Deploy
- [ ] Railway builds automatically
- [ ] Check build logs
- [ ] Wait for "Build Successful"

---

## Post-Deployment Verification

### Build Verification
- [ ] Build completed successfully
- [ ] Python 3 installed (check logs)
- [ ] Java JDK installed (check logs)
- [ ] GCC installed (check logs)
- [ ] G++ installed (check logs)
- [ ] Node.js dependencies installed

### Application Verification
- [ ] Health endpoint works: `/api/health`
- [ ] Can access Railway URL
- [ ] MongoDB connected (check logs)
- [ ] No errors in Railway logs

### Code Execution Verification
- [ ] Can login to app
- [ ] Python code execution works
- [ ] Java code execution works
- [ ] C++ code execution works
- [ ] C code execution works

---

## Troubleshooting Checklist

If something doesn't work:

- [ ] Check Railway build logs
- [ ] Check Railway runtime logs
- [ ] Verify environment variables are set
- [ ] Verify MongoDB connection string
- [ ] Check MongoDB Atlas IP whitelist
- [ ] Verify Dockerfile syntax
- [ ] Check that all files are pushed to GitHub

---

## Success Criteria

✅ All compilers installed automatically
✅ Application starts without errors
✅ Code execution works for all languages
✅ MongoDB connection successful
✅ Health endpoint responds correctly

---

## Quick Commands

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Test Health Endpoint:**
```bash
curl https://your-app.railway.app/api/health
```

**Check Railway Logs:**
- Railway Dashboard → Deployments → View Logs

---

## Files Structure

```
backend/
├── Dockerfile          ✅ Installs compilers
├── .dockerignore       ✅ Optimizes builds
├── railway.json        ✅ Railway config
├── package.json        ✅ Dependencies
└── server.js           ✅ Main server file
```

---

## Next Steps After Deployment

1. [ ] Test all features
2. [ ] Set up custom domain
3. [ ] Configure monitoring
4. [ ] Update frontend API URL
5. [ ] Deploy frontend (if separate)

---

**Your deployment is ready! Follow `RAILWAY_QUICK_START.md` for step-by-step instructions.**

