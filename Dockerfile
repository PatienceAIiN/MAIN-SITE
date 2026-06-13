# Self-contained Node.js web service. The frontend (dist/) is built inside the
# image from the committed source — no pre-build step or sibling repos required,
# so a clean `git` checkout deploys correctly on Render. The legacy Python
# marketing backend has been replaced by the Node-native Business Growth OS
# (/api/business, /growth); /marketing-auto now redirects there.

# ── Stage 1: build the React frontend ────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Server + API handlers + the freshly built frontend
COPY server.js ./
COPY api/ ./api/
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/images
EXPOSE 4000
CMD ["node", "server.js"]
