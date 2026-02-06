# Railway Quick Start Guide 🚀

## 5-Minute Deployment Using Dockerfile

This guide will get your coding platform deployed on Railway in 5 minutes.

---

## ✅ Prerequisites Checklist

- [ ] Code pushed to GitHub
- [ ] Railway account ([railway.app](https://railway.app))
- [ ] MongoDB Atlas account (or MongoDB connection string)

---

## 🚀 Step-by-Step Deployment

### Step 1: Verify Files (30 seconds)

Check that these files exist in `backend/`:
- ✅ `Dockerfile`
- ✅ `.dockerignore`
- ✅ `railway.json`
- ✅ `package.json`

**If missing, they're already created in your repo!**

### Step 2: Push to GitHub (1 minute)

```bash
git add backend/Dockerfile backend/.dockerignore backend/railway.json
git commit -m "Add Railway deployment files"
git push origin main
```

### Step 3: Deploy on Railway (2 minutes)

1. **Go to Railway.app**
   - Visit [railway.app](https://railway.app)
   - Sign in/up

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects Dockerfile ✅

3. **Configure Service**
   - Click on your service
   - Go to **Settings** tab
   - Set **Root Directory** to: `backend`

### Step 4: Set Environment Variables (1 minute)

Go to **Variables** tab and add:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/coding-platform
JWT_SECRET=your-strong-random-secret-here
JWT_EXPIRE=365d
NODE_ENV=production
CODE_EXECUTION_TIMEOUT=10000
MAX_VIOLATIONS=3
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=your-secure-password
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 5: Deploy! (30 seconds)

- Railway automatically builds and deploys
- Check **Deployments** tab
- Wait for "Build Successful" ✅

---

## ✅ Verification (1 minute)

### 1. Check Build Logs

Railway → Deployments → View logs:
```
✅ python3 installed
✅ java installed
✅ gcc installed
✅ g++ installed
✅ Build successful
```

### 2. Test Health Endpoint

```
https://your-app.railway.app/api/health
```

Should return: `{ status: "OK" }`

### 3. Test Code Execution

- Login to your app
- Try running Python: `print("Hello")`
- Should work! ✅

---

## 🎯 Your App is Live!

**URL:** `https://your-app.railway.app`

**All compilers installed automatically!** ✅

---

## 🐛 Quick Troubleshooting

### Build Failed?
- Check Railway build logs
- Verify `backend/Dockerfile` exists
- Ensure files are pushed to GitHub

### Compilers Not Working?
- Check build logs for installation messages
- Verify environment variables are set
- Check Railway runtime logs

### MongoDB Connection Failed?
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (`0.0.0.0/0`)
- Verify credentials

---

## 📋 Environment Variables Quick Reference

**Required:**
- `PORT=5000`
- `MONGODB_URI=mongodb+srv://...`
- `JWT_SECRET=(64-byte hex)`
- `JWT_EXPIRE=365d`
- `NODE_ENV=production`

**Optional:**
- `CODE_EXECUTION_TIMEOUT=10000`
- `MAX_VIOLATIONS=3`
- `SUPER_ADMIN_EMAIL=...`
- `SUPER_ADMIN_PASSWORD=...`

---

## 💡 Pro Tips

1. **Auto-Deploy:** Railway auto-deploys on every GitHub push
2. **Custom Domain:** Set up in Settings → Domains
3. **Monitor Logs:** Check Railway logs regularly
4. **Upgrade Plan:** Pro tier ($5/month) recommended for code execution

---

## 🎉 Done!

Your backend is deployed and ready! 🚀

For detailed information, see `RAILWAY_DEPLOYMENT.md`
