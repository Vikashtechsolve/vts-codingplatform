# Setup Guide

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- Python 3 (for code execution)
- Java JDK (for Java code execution)
- GCC/G++ (for C/C++ code execution)

## Installation Steps

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Backend Setup

1. Navigate to `backend` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your MongoDB connection string and JWT secret:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/coding-platform
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   SUPER_ADMIN_EMAIL=admin@platform.com
   SUPER_ADMIN_PASSWORD=admin123
   NODE_ENV=development
   ```

4. Create necessary directories:
   ```bash
   mkdir -p uploads/logos
   mkdir -p temp
   ```

### 3. Frontend Setup

1. Navigate to `frontend` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` if needed (default should work for development)

### 4. Start MongoDB

Make sure MongoDB is running on your system:
```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Linux
sudo systemctl start mongod

# Or use MongoDB Atlas connection string in .env
```

### 5. Run the Application

#### Option 1: Run both servers together (from root)
```bash
npm run dev
```

#### Option 2: Run separately

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

### 6. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Default Credentials

### Super Admin
- Email: `admin@platform.com`
- Password: (set in backend/.env, default: `admin123`)

## Usage Flow

### Super Admin
1. Login as super admin
2. Create vendors from "Vendors" page
3. Each vendor gets admin credentials (shown after creation)

### Vendor Admin
1. Login with vendor admin credentials
2. Create coding questions and MCQ questions
3. Create tests (coding, MCQ, or mixed)
4. Enroll students (bulk or individual)
5. Assign tests to students
6. View analytics and results

### Student
1. Login with student credentials
2. View assigned tests
3. Take tests (coding with Monaco editor, MCQ with radio buttons)
4. View results after submission

## Features

- ✅ Multi-tenant architecture (multiple vendors)
- ✅ Coding tests (Java, C++, C, Python)
- ✅ MCQ tests
- ✅ Mixed tests (coding + MCQ)
- ✅ Code execution service
- ✅ Student enrollment and test assignment
- ✅ Analytics and reporting
- ✅ Vendor customization (logo, colors)
- ✅ Dark/Light mode
- ✅ Red gradient theme

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify MongoDB port (default: 27017)

### Code Execution Not Working
- Ensure Python 3, Java JDK, and GCC are installed
- Check PATH environment variable
- Verify compilers are accessible from command line

### Port Already in Use
- Change PORT in backend/.env
- Or kill the process using the port:
  ```bash
  # Find process
  lsof -i :5000
  # Kill process
  kill -9 <PID>
  ```

## Production Deployment

1. Set `NODE_ENV=production` in backend/.env
2. Build frontend: `cd frontend && npm run build`
3. Use a process manager like PM2 for backend
4. Use a reverse proxy (nginx) for serving frontend
5. Use MongoDB Atlas or managed MongoDB service
6. Implement proper code execution sandboxing (Docker containers recommended)
7. Set secure JWT_SECRET
8. Enable HTTPS

