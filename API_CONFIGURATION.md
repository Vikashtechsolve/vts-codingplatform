# Frontend API Configuration

## ✅ All API Calls Now Use Environment Variables

All frontend API calls have been updated to use `axiosInstance` from `utils/axios.js`, which reads the API URL from `.env` file.

## Configuration

### Environment File: `frontend/.env`
```env
REACT_APP_API_URL=http://localhost:5500/api
REACT_APP_ENV=development
```

### Axios Instance: `src/utils/axios.js`
- Reads `REACT_APP_API_URL` from environment variables
- Defaults to `http://localhost:5500/api` if not set
- Automatically adds Authorization header with JWT token
- Handles 401 errors (redirects to login)

## How It Works

1. **Base URL**: Set in `utils/axios.js` from `.env` file
2. **All API calls**: Use `axiosInstance` instead of `axios`
3. **URLs**: Use relative paths starting with `/` (e.g., `/auth/login`)
4. **Full URL**: Base URL + relative path = `http://localhost:5500/api/auth/login`

## Example Usage

```javascript
import axiosInstance from '../../utils/axios';

// GET request
const response = await axiosInstance.get('/super-admin/stats');

// POST request
const response = await axiosInstance.post('/auth/login', { email, password });

// PUT request
const response = await axiosInstance.put('/tests/123', data);

// DELETE request
await axiosInstance.delete('/tests/123');
```

## Changing the Backend URL

To change the backend URL, simply update `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5500/api
# or
REACT_APP_API_URL=https://api.yourdomain.com/api
```

**Important**: After changing `.env`, restart the React development server:
```bash
# Stop the server (Ctrl+C)
npm start
```

## Files Updated

All frontend files now use `axiosInstance`:
- ✅ `context/AuthContext.js`
- ✅ All pages in `pages/SuperAdmin/`
- ✅ All pages in `pages/VendorAdmin/`
- ✅ All pages in `pages/Student/`

## Verification

To verify API calls are going to the correct URL:
1. Open browser DevTools → Network tab
2. Make an API call (e.g., login)
3. Check the request URL - it should be `http://localhost:5500/api/...`

