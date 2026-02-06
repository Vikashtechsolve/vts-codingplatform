# Railway Deployment Guide - Dockerfile Method

This guide covers deploying your coding platform on Railway using Dockerfile (the recommended method).

## 🚀 Quick Overview

The Dockerfile automatically installs all required compilers (Python 3, Java JDK, GCC, G++) and sets up your Node.js application for deployment on Railway.

---

## 📋 Prerequisites

- GitHub account with your code pushed
- Railway account ([railway.app](https://railway.app))
- MongoDB Atlas account (or MongoDB connection string)

---

## 🎯 Step-by-Step Deployment

### Step 1: Verify Files

Make sure these files exist in your `backend/` directory:
- ✅ `Dockerfile` - Installs compilers and sets up the app
- ✅ `.dockerignore` - Optimizes Docker builds
- ✅ `railway.json` - Railway configuration
- ✅ `package.json` - Node.js dependencies

### Step 2: Push to GitHub

```bash
git add backend/Dockerfile backend/.dockerignore backend/railway.json
git commit -m "Add Railway deployment configuration"
git push origin main
```

### Step 3: Deploy on Railway

1. **Go to Railway.app**
   - Visit [railway.app](https://railway.app)
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect the Dockerfile ✅

3. **Configure Service**
   - Click on your service
   - Go to **Settings** tab
   - Set **Root Directory** to: `backend`
   - Railway will automatically use the Dockerfile

4. **Set Environment Variables**
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

5. **Deploy**
   - Railway will automatically build and deploy
   - Check **Deployments** tab for build logs
   - Wait for "Build Successful" ✅

### Step 4: Verify Deployment

1. **Check Build Logs**
   In Railway → Deployments → View logs, you should see:
   ```
   ✅ Installing Python 3
   ✅ Installing Java JDK
   ✅ Installing GCC/G++
   ✅ Installing Node.js dependencies
   ✅ Build successful
   ```

2. **Get Your Railway URL**
   - Railway provides: `https://your-app.railway.app`
   - Or set custom domain in Settings → Domains

3. **Test Health Endpoint**
   ```
   https://your-app.railway.app/api/health
   ```
   Should return: `{ status: "OK", message: "Server is running" }`

4. **Test Code Execution**
   - Login to your app
   - Try running Python code: `print("Hello World")`
   - Try running Java code
   - Try running C++ code
   - All should work! ✅

---

## 🔍 What the Dockerfile Does

The Dockerfile (`backend/Dockerfile`) automatically:

1. **Uses Node.js 18 LTS** as base image
2. **Installs compilers:**
   - Python 3 + pip
   - Java JDK (default-jdk)
   - GCC (C compiler)
   - G++ (C++ compiler)
   - Make (build tool)
3. **Sets up Node.js app:**
   - Copies package files
   - Installs dependencies
   - Copies application files
4. **Creates directories:**
   - `temp/` for code execution
   - `uploads/logos/` for file uploads
5. **Configures health check**
6. **Starts the server**

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Build completed successfully
- [ ] All compilers installed (check logs)
- [ ] Environment variables set correctly
- [ ] Health endpoint works: `/api/health`
- [ ] Can login to app
- [ ] Code execution works (test Python, Java, C++)
- [ ] MongoDB connected (check logs)
- [ ] No errors in Railway logs

---

## 🐛 Troubleshooting

### Issue: "Compiler not found" errors

**Solution:**
- Check Railway build logs for compiler installation
- Verify Dockerfile includes all compilers
- Ensure build completed successfully
- Check that `backend/Dockerfile` exists and is correct

### Issue: "Build failed"

**Solution:**
- Check Railway build logs for specific error
- Verify `backend/package.json` exists
- Ensure Dockerfile syntax is correct
- Check that all files are pushed to GitHub

### Issue: "Port already in use"

**Solution:**
- Railway handles ports automatically
- Just set `PORT` env var (Railway will use it)
- No manual port configuration needed

### Issue: "MongoDB connection failed"

**Solution:**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (allow all: `0.0.0.0/0`)
- Verify credentials are correct
- Check MongoDB Atlas cluster is running

### Issue: "Code execution timeout"

**Solution:**
- Increase `CODE_EXECUTION_TIMEOUT` to `15000` or `20000`
- Check Railway resource limits
- Consider upgrading Railway plan if needed

### Issue: "File system error"

**Solution:**
- Dockerfile already creates temp directory with correct permissions
- If issues persist, check Railway logs
- Verify temp directory exists in container

---

## 📊 Railway Resource Limits

**Free Tier:**
- 500 hours/month
- 512MB RAM
- 1GB disk

**Pro Tier ($5/month):**
- Unlimited hours
- 8GB RAM
- 100GB disk

**For code execution, Pro tier recommended for better performance!**

---

## 🔐 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `(64-byte hex string)` |
| `JWT_EXPIRE` | Token expiration | `365d` |
| `NODE_ENV` | Environment | `production` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CODE_EXECUTION_TIMEOUT` | Code execution timeout (ms) | `5000` |
| `MAX_VIOLATIONS` | Max exam violations | `3` |
| `SUPER_ADMIN_EMAIL` | Super admin email | `admin@platform.com` |
| `SUPER_ADMIN_PASSWORD` | Super admin password | `admin123` |

---

## 🎯 Railway Settings

### Service Configuration

- **Root Directory:** `backend`
- **Port:** `5000` (or from `PORT` env var)
- **Health Check Path:** `/api/health`
- **Health Check Interval:** 30 seconds

### Build Configuration

- **Builder:** Dockerfile (auto-detected)
- **Dockerfile Path:** `Dockerfile`
- **Build Command:** (automatic from Dockerfile)

### Deploy Configuration

- **Start Command:** `node server.js`
- **Restart Policy:** On Failure
- **Max Retries:** 10

---

## 💡 Pro Tips

1. **Use Railway GitHub Integration**
   - Auto-deploys on every push
   - Easy to rollback if needed

2. **Set Up Custom Domain**
   - More professional
   - Better for production

3. **Enable Metrics**
   - Monitor resource usage
   - Track performance

4. **Set Up Alerts**
   - Get notified of issues
   - Monitor uptime

5. **Use Railway CLI**
   - Deploy from terminal
   - Manage services programmatically

6. **Monitor Logs**
   - Check regularly for errors
   - Debug issues quickly

---

## 🔗 Quick Links

- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Docs](https://docs.railway.app)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Docker Documentation](https://docs.docker.com)

---

## 🎉 Success!

Once deployed, your app will be live at:
```
https://your-app.railway.app
```

**All compilers should work automatically!** ✅

The Dockerfile ensures:
- ✅ Python 3 installed
- ✅ Java JDK installed
- ✅ GCC/G++ installed
- ✅ All dependencies installed
- ✅ Proper permissions set

---

## 📞 Need Help?

If you encounter issues:

1. **Check Railway Build Logs**
   - Railway → Deployments → View logs
   - Look for compiler installation messages

2. **Check Railway Runtime Logs**
   - Railway → Deployments → View logs
   - Look for application errors

3. **Verify Environment Variables**
   - Railway → Variables tab
   - Ensure all required variables are set

4. **Test Locally**
   - Build Docker image locally: `docker build -t coding-platform ./backend`
   - Run container: `docker run -p 5000:5000 coding-platform`
   - Test code execution

5. **Railway Support**
   - Railway Discord: [discord.gg/railway](https://discord.gg/railway)
   - Railway Docs: [docs.railway.app](https://docs.railway.app)

---

## 🚀 Next Steps

After successful deployment:

1. ✅ Test all features
2. ✅ Set up custom domain
3. ✅ Configure monitoring
4. ✅ Set up backups
5. ✅ Update frontend API URL
6. ✅ Deploy frontend (if separate)

Your backend is now ready for production! 🎉
