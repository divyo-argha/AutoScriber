-- Add pause/resume/cancel control status to transcription jobs
ALTER TABLE "TranscriptionJob" ADD COLUMN "controlStatus" TEXT NOT NULL DEFAULT 'running';
