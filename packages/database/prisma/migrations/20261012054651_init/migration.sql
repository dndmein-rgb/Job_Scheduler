-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'SCHEDULED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DRAINING');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" "JobPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "JobStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "tenantId" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "capabilities" TEXT[],
    "status" "WorkerStatus" NOT NULL DEFAULT 'ONLINE',
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_status_scheduledAt_idx" ON "jobs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "jobs_leaseExpiresAt_idx" ON "jobs"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "jobs_status_priority_createdAt_idx" ON "jobs"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_tenantId_idx" ON "jobs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_idempotencyKey_key" ON "jobs"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_eventId_key" ON "outbox"("eventId");

-- CreateIndex
CREATE INDEX "outbox_publishedAt_createdAt_idx" ON "outbox"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "workers_status_lastHeartbeatAt_idx" ON "workers"("status", "lastHeartbeatAt");
