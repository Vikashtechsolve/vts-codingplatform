#!/bin/bash

# Start Production Deployment
# This script is for VPS/EC2 deployment with PM2

echo "🚀 Starting Coding Platform (Production)"
echo "========================================"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version 14 or higher required"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if Redis is running
if ! redis-cli ping &> /dev/null; then
    echo "❌ Redis is not running!"
    echo "Start Redis: sudo systemctl start redis-server"
    exit 1
fi

echo "✅ Redis is running"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

echo "✅ PM2 is installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create logs directory
mkdir -p logs

# Stop existing processes
echo "🛑 Stopping existing processes..."
pm2 delete ecosystem.config.js 2>/dev/null || true

# Start with PM2 in production mode
echo "🚀 Starting application in production mode..."
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot (run once)
if ! pm2 startup | grep -q "already"; then
    echo "⚙️  Setting up PM2 startup script..."
    pm2 startup systemd -u $USER --hp $HOME
fi

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
echo ""
echo "========================================"
