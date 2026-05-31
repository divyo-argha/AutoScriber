-- CreateTable
CREATE TABLE IF NOT EXISTS "TranscriptionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "language" TEXT NOT NULL DEFAULT 'bn',
    "chunksTotal" INTEGER NOT NULL DEFAULT 0,
    "chunksDone" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "result" TEXT,
    "audioPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "geminiApiKey" TEXT NOT NULL DEFAULT '',
    "geminiApiBaseUrl" TEXT NOT NULL DEFAULT '',
    "sonioxApiKey" TEXT NOT NULL DEFAULT '',
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "chunkDuration" INTEGER NOT NULL DEFAULT 300,
    "overlapDuration" INTEGER NOT NULL DEFAULT 10
);
