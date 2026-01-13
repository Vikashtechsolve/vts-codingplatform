# Use Node.js 18 LTS as base image
FROM node:18-slim

# Install system dependencies and compilers required for code execution
# Python 3 for Python code execution
# Java JDK for Java code execution
# GCC/G++ for C/C++ code execution
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    default-jdk \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy all application files
COPY . .

# Create temp directory for code execution with proper permissions
RUN mkdir -p temp && chmod 755 temp

# Create uploads directory for file uploads
RUN mkdir -p uploads/logos && chmod 755 uploads/logos

# Expose the port the app runs on
EXPOSE 5000

# Health check (optional but recommended)
# Uses PORT environment variable (defaults to 5000) - works in any environment
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://localhost:' + port + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))" || exit 1

# Start the application
CMD ["node", "server.js"]

