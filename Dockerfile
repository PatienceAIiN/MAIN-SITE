# Single Docker webservice: Node.js (port 4000) + Python FastAPI (port 8000)
# Run build-docker.sh before docker build to prepare dist/ and backend/

FROM python:3.11-slim

# Install Node.js 20 + supervisor
RUN apt-get update && \
    apt-get install -y ca-certificates curl supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Python backend source
COPY backend/ /app/backend/

# Node deps
COPY package*.json /app/
RUN npm ci --omit=dev --legacy-peer-deps

# Node server + API handlers + pre-built frontend
COPY server.js /app/
COPY api/ /app/api/
COPY dist/ /app/dist/

# Images dir
RUN mkdir -p /app/images

# Supervisor
COPY supervisord.conf /etc/supervisor/conf.d/app.conf

EXPOSE 4000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]
