# Quick Fix for API Calls

The frontend needs to be updated to use the axios instance. Here's what was changed:

1. Created `src/utils/axios.js` - Centralized axios configuration
2. Updated `src/context/AuthContext.js` - Uses axiosInstance
3. Updated CORS in backend to allow requests from frontend

## To Fix All Files:

You need to update all files that import axios. The pattern is:

**Before:**
```javascript
import axios from 'axios';
axios.get('/api/endpoint')
```

**After:**
```javascript
import axiosInstance from '../../utils/axios';  // Adjust path as needed
axiosInstance.get('/endpoint')  // Remove /api prefix
```

## Quick Fix Script:

Run this in the frontend directory:
```bash
cd frontend
find src -name "*.js" -type f -exec sed -i '' "s/import axios from 'axios'/import axiosInstance from '..\/utils\/axios'/g" {} \;
find src -name "*.js" -type f -exec sed -i '' "s/axios\./axiosInstance./g" {} \;
find src -name "*.js" -type f -exec sed -i '' "s/'\/api\//'/g" {} \;
```

Or manually update each file that uses axios.

