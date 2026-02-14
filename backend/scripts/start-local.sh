#!/bin/bash

# Start Local Development with Redis and PM2
# This script ensures Redis is running and starts the application with PM2

echo "🚀 Starting Coding Platform (Local Development)"
echo "================================================"

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis is not installed!"
    echo "📦 Install Redis:"
    echo "   macOS: brew install redis"
    echo "   Ubuntu: sudo apt install redis-server"
    echo "   Docker: docker run -d -p 6379:6379 redis:alpine"
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping &> /dev/null; then
    echo "⚠️  Redis is not running. Starting Redis..."
    
    # Try to start Redis based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew services start redis
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo systemctl start redis-server
    fi
    
    # Wait for Redis to start
    sleep 2
    
    # Check again
    if ! redis-cli ping &> /dev/null; then
        echo "❌ Failed to start Redis automatically"
        echo "Please start Redis manually and try again"
        exit 1
    fi
fi

echo "✅ Redis is running"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

echo "✅ PM2 is installed"

# Create logs directory
mkdir -p logs

# Stop any existing PM2 processes
echo "🛑 Stopping existing PM2 processes..."
pm2 delete ecosystem.config.js 2>/dev/null || true

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Show status
echo ""
echo "✅ Application started successfully!"
echo ""
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "📝 Useful commands:"
echo "   View logs:     pm2 logs"
echo "   Monitor:       pm2 monit"
echo "   Restart:       pm2 restart all"
echo "   Stop:          pm2 stop all"
echo "   Delete:        pm2 delete all"
echo ""
echo "🌐 Server running on: http://localhost:5500"
echo "================================================"
