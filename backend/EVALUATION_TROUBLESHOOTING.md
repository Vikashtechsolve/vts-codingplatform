# AI Project Evaluation - Troubleshooting Guide

## Quick Checklist

If evaluations are not completing, verify these in order:

### 1. Redis is Running
The evaluation queue uses Redis. **Redis must be running** for jobs to be processed.

**Check Redis:**
```bash
# Local: Test connection
redis-cli ping
# Should return: PONG

# Or run the test script
node scripts/test-redis.js
```

**Start Redis (if not running):**
- **macOS:** `brew services start redis`
- **Linux:** `sudo systemctl start redis`
- **Docker:** `docker run -d -p 6379:6379 redis:alpine`

### 2. Environment Variables
Ensure these are set in `backend/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | Your OpenAI API key |
| `OPENAI_MODEL` or `OPENAI_EVAL_MODEL` | Optional | Model for evaluation (default: gpt-4o-mini) |
| `REDIS_URL` or `REDIS_HOST`+`REDIS_PORT` | ✅ Yes | Redis connection |

### 3. Evaluation Queue Status
Check if the queue is connected and processing:

```
GET http://localhost:5500/api/health/evaluation
```

Expected response when working:
```json
{
  "status": "OK",
  "evaluation": {
    "queueConnected": true,
    "waiting": 0,
    "active": 0,
    "completed": 5,
    "failed": 0
  }
}
```

If `queueConnected: false`, Redis is not reachable.

### 4. Server Startup
The evaluation worker loads automatically with the server. You should see in console:
- `📬 Evaluation queue connected to Redis` (when Redis connects)
- `🎯 Evaluation worker ready and waiting for jobs...` (when worker starts)

### 5. GitHub Repository
- Repository must be **public** (or use a token for private repos)
- URL format: `https://github.com/username/repo`
- Branch must exist (default: `main`)

### 6. Check Logs
When a submission is evaluated, the server console shows:
```
🚀 Starting evaluation for submission: <id>
📥 Step 1: Cloning repository...
✅ Repository cloned successfully
🔍 Step 2: Analyzing repository...
✅ Repository analysis completed
🤖 Step 3: Running AI evaluation...
✅ AI evaluation completed
🎯 Step 5: Calculating final score...
✅ Evaluation completed successfully
```

If it stops or shows errors, the error message indicates the issue.

### 7. Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "read ETIMEDOUT" | Redis connection timeout (common with remote Redis) | 1) Railway Redis may be paused - open Railway dashboard to wake it 2) Use local Redis: set REDIS_HOST=localhost, REDIS_PORT=6379 in .env and comment REDIS_URL 3) Check network/firewall allows outbound to Redis port |
| "Evaluation job not found" | EvaluationJob not created or wrong ID | Check DB - ensure submission created EvaluationJob |
| "Failed to clone repository" | Private repo, invalid URL, or branch | Use public repo or add GitHub token |
| "AI evaluation failed" | Invalid OpenAI key or model | Verify OPENAI_API_KEY, try gpt-4o-mini |
| "Redis connection failed" | Redis not running | Start Redis: `brew services start redis` (macOS) or `docker run -d -p 6379:6379 redis` |
| Jobs stuck in "waiting" | Worker not processing | Restart server, check Redis |

### 8. Run with PM2 (Recommended for Production)
For reliable evaluation processing:
```bash
cd backend
npm run start:pm2
```
This runs both the API server and evaluation worker as separate processes.

### 9. Retry Failed Evaluations
Vendor admins can retry failed submissions from the Assignment Submissions page via the "Retry Evaluation" button.
