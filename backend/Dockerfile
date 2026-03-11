FROM node:18-slim

# Install only what's needed: compilers for code execution, git for evaluation worker
# Use headless JRE instead of full JDK to save ~400MB, skip python3-pip (not needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    default-jdk-headless \
    gcc \
    g++ \
    make \
    git \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production && npm cache clean --force

COPY . .

RUN mkdir -p temp uploads/logos logs && chmod 755 temp uploads/logos logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://localhost:' + port + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))" || exit 1

CMD ["node", "server.js"]
