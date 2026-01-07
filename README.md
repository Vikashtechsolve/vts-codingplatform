# Coding Platform - Multi-Tenant Assessment Platform

A comprehensive coding and MCQ test platform built with MERN stack, supporting multiple vendors with their own admin panels.

## Features

- **Coding Tests**: Create coding challenges in Java, C++, C, Python
- **MCQ Tests**: Create multiple-choice question tests
- **Mixed Tests**: Combine coding and MCQ questions in a single test
- **Multi-Tenant**: Support multiple vendors with isolated data
- **Super Admin**: Manage vendors and platform-wide settings
- **Vendor Admin**: Create tests, manage students, view analytics
- **Student Dashboard**: Take assigned tests and view results
- **Dark/Light Mode**: Theme support with red gradient styling

## Tech Stack

- **Frontend**: React (Plain JavaScript)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT

## Installation

1. Install all dependencies:
```bash
npm run install-all
```

2. Set up environment variables:
- Copy `backend/.env.example` to `backend/.env` and fill in values
- Copy `frontend/.env.example` to `frontend/.env` and fill in values

3. Start development servers:
```bash
npm run dev
```

## Project Structure

```
coding-platform/
├── backend/          # Express.js backend
├── frontend/         # React frontend
└── README.md
```

## Default Credentials

Super Admin:
- Email: admin@platform.com
- Password: (set in backend/.env)

