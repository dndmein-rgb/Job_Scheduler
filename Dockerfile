# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/job-service/package.json ./apps/job-service/
COPY apps/worker/package.json ./apps/worker/
COPY apps/scheduler/package.json ./apps/scheduler/
COPY apps/reaper/package.json ./apps/reaper/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-events/package.json ./packages/shared-events/
COPY packages/shared-kafka/package.json ./packages/shared-kafka/
COPY packages/shared-utils/package.json ./packages/shared-utils/

RUN npm install

FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json* ./

# Full source (node_modules excluded by .dockerignore)
COPY . .

# Critical: re-link workspaces now that full package sources exist
RUN npm install

# Optional but recommended for Prisma apps
ENV DATABASE_URL="postgresql://jobplatform:jobplatform@localhost:5432/jobplatform?schema=public"
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

RUN npm run build -w @job-platform/shared-types \
 && npm run build -w @job-platform/shared-events \
 && npm run build -w @job-platform/shared-kafka \
 && npm run build -w @job-platform/shared-utils \
 && npm run build -w @job-platform/database \
 && npm run build -w @job-platform/job-service \
 && npm run build -w @job-platform/worker \
 && npm run build -w @job-platform/scheduler \
 && npm run build -w @job-platform/reaper

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/job-service ./apps/job-service
COPY --from=build /app/apps/worker ./apps/worker
COPY --from=build /app/apps/scheduler ./apps/scheduler
COPY --from=build /app/apps/reaper ./apps/reaper

CMD ["node", "apps/job-service/dist/server.js"]