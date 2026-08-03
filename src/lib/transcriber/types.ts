export interface TranscriptionSegment {
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  duration: number;
  language: string;
  model: string;
  fallbackUsed?: boolean;
}

export interface ChunkResult {
  chunkIndex: number;
  segments: TranscriptionSegment[];
  rawText: string;
  fallbackUsed?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'gemini';
  description: string;
  maxAudioLength: number;
  supportsDiarization: boolean;
  supportsTimestamps: boolean;
  tierInfo?: string;
  recommended?: boolean;
}

export interface TranscriptionJob {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number | null;
  status: 'pending' | 'uploading' | 'chunking' | 'processing' | 'completed' | 'failed';
  progress: number;
  model: string;
  language: string;
  chunksTotal: number;
  chunksDone: number;
  errorMessage: string | null;
  result: TranscriptionResult | null;
  chunkResults?: ChunkResult[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Recommended AI Studio Free Tier flagship model. Fast execution, best quality, audio understanding, diarization, and mixed Bangla-English transcription.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (10 RPM / 250 RPD)',
    recommended: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    description: 'High-throughput lightweight model. Highest RPM limit (25 RPM) on AI Studio free tier.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (25 RPM / 250 RPD)',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Highest quality reasoning model. Best for complex audio with heavy diarization needs.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (2 RPM / 50 RPD)',
  },
];

export const GEMINI_TRANSCRIPTION_PROMPT = `You are a Bangla-English audio transcription system. Your ONLY job is to output valid JSON.

RULES:
1. Transcribe audio in the language spoken (Bangla or English)
2. Identify speakers as Speaker 1, Speaker 2, etc
3. Provide accurate timestamps in seconds
4. Output ONLY a valid JSON array - nothing else, no markdown, no explanation

OUTPUT FORMAT (REQUIRED):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি this is very important"},
  {"speaker": "Speaker 2", "startTime": 5.5, "endTime": 10.1, "text": "হ্যাঁ, I agree"}
]

CRITICAL: Output ONLY the JSON array. No markdown. No code blocks. No text before or after.`;

export const GEMINI_CHUNK_PROMPT = `You are a Bangla-English audio transcription system. Your ONLY job is to output valid JSON.

RULES:
1. Transcribe audio in the language spoken (Bangla or English)
2. Identify speakers as Speaker 1, Speaker 2, etc
3. Provide accurate timestamps in seconds (relative to chunk start)
4. Output ONLY a valid JSON array - nothing else, no markdown, no explanation

OUTPUT FORMAT (REQUIRED):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি this is very important"}
]

CRITICAL: Output ONLY the JSON array. No markdown. No code blocks. No text before or after.`;
