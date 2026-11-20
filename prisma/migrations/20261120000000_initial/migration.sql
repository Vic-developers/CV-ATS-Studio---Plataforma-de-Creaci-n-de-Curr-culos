-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "diagnostics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "resumeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("resumeId")
);

-- CreateTable
CREATE TABLE "ATSAnalysis" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ATSAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_expires_idx" ON "PasswordReset"("expires");

-- CreateIndex
CREATE INDEX "RateLimit_expires_idx" ON "RateLimit"("expires");

-- CreateIndex
CREATE INDEX "Resume_userId_updatedAt_idx" ON "Resume"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Resume_parentId_idx" ON "Resume"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportFile_resumeId_key" ON "ImportFile"("resumeId");

-- CreateIndex
CREATE INDEX "ImportFile_userId_createdAt_idx" ON "ImportFile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ATSAnalysis_resumeId_createdAt_idx" ON "ATSAnalysis"("resumeId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_resumeId_createdAt_idx" ON "AIRecommendation"("resumeId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportHistory_resumeId_createdAt_idx" ON "ExportHistory"("resumeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ATSAnalysis" ADD CONSTRAINT "ATSAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
