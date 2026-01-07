# Environment Variables Documentation

## Backend Environment Variables

### Required Variables

#### `PORT`
- **Description**: Port number for the Express server
- **Default**: `5000`
- **Example**: `5000`

#### `MONGODB_URI`
- **Description**: MongoDB connection string
- **Default**: `mongodb://localhost:27017/coding-platform`
- **Local MongoDB Example**: `mongodb://localhost:27017/coding-platform`
- **MongoDB Atlas Example**: `mongodb+srv://username:password@cluster.mongodb.net/coding-platform`
- **Note**: Make sure MongoDB is running locally or use a cloud service like MongoDB Atlas

#### `JWT_SECRET`
- **Description**: Secret key for signing JWT tokens
- **Default**: None (must be set)
- **Security**: Use a strong, random string in production
- **Generate Secret**: 
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- **Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6...`

#### `JWT_EXPIRE`
- **Description**: JWT token expiration time
- **Default**: `7d`
- **Format**: Number followed by unit (s, m, h, d)
- **Examples**: 
  - `1h` (1 hour)
  - `24h` (24 hours)
  - `7d` (7 days)
  - `30d` (30 days)

#### `SUPER_ADMIN_EMAIL`
- **Description**: Email for the super admin account
- **Default**: `admin@platform.com`
- **Note**: This account is automatically created on first server start
- **Example**: `admin@platform.com`

#### `SUPER_ADMIN_PASSWORD`
- **Description**: Password for the super admin account
- **Default**: `admin123`
- **Security**: Change this in production!
- **Example**: `admin123` (change this!)

#### `NODE_ENV`
- **Description**: Node.js environment
- **Default**: `development`
- **Options**: `development`, `production`, `test`
- **Example**: `development`

### Optional Variables

#### `MAX_FILE_SIZE`
- **Description**: Maximum file size for logo uploads (in bytes)
- **Default**: `5242880` (5MB)
- **Example**: `5242880`

#### `CODE_EXECUTION_TIMEOUT`
- **Description**: Timeout for code execution (in milliseconds)
- **Default**: `5000` (5 seconds)
- **Example**: `5000`

---

## Frontend Environment Variables

### Required Variables

#### `REACT_APP_API_URL`
- **Description**: Backend API base URL
- **Default**: `http://localhost:5000/api`
- **Example**: `http://localhost:5000/api`
- **Production Example**: `https://api.yourdomain.com/api`

### Optional Variables

#### `REACT_APP_ENV`
- **Description**: Frontend environment
- **Default**: `development`
- **Options**: `development`, `production`
- **Example**: `development`

---

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the example file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and update the values:
   ```bash
   # Use your preferred editor
   nano .env
   # or
   vim .env
   ```

4. **Important**: Generate a secure JWT_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Copy the output and paste it as `JWT_SECRET` value.

5. Update MongoDB URI if using a remote database:
   - For MongoDB Atlas: Get connection string from your cluster
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/coding-platform`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Copy the example file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and update `REACT_APP_API_URL` if your backend runs on a different port or domain.

---

## Production Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Change `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`
- [ ] Set `NODE_ENV=production`
- [ ] Update `MONGODB_URI` to production database
- [ ] Update `REACT_APP_API_URL` to production API URL
- [ ] Use HTTPS in production URLs
- [ ] Set up proper CORS configuration
- [ ] Configure file upload limits appropriately
- [ ] Set up proper logging and monitoring
- [ ] Use environment-specific secrets management

---

## Security Notes

1. **Never commit `.env` files to version control**
   - They are already in `.gitignore`
   - Use `.env.example` for documentation

2. **JWT_SECRET**: Must be kept secret and never exposed
   - Use different secrets for development and production
   - Rotate secrets periodically

3. **Database Credentials**: Protect MongoDB connection strings
   - Use strong passwords
   - Restrict IP access in MongoDB Atlas
   - Use connection string with credentials, not hardcoded

4. **Super Admin Credentials**: Change default values immediately
   - Use strong passwords
   - Consider using environment-specific accounts

---

## Example .env Files

### Development Backend (.env)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/coding-platform
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRE=7d
SUPER_ADMIN_EMAIL=admin@platform.com
SUPER_ADMIN_PASSWORD=admin123
```

### Production Backend (.env)
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/coding-platform
JWT_SECRET=<strong-random-64-byte-hex-string>
JWT_EXPIRE=24h
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=<strong-password>
```

### Development Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

### Production Frontend (.env)
```env
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_ENV=production
```

