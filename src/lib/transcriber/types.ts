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
  provider: 'gemini' | 'soniox';
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
    description: 'Recommended AI Studio Free Tier flagship model. Best quality, fast audio understanding, diarization, and mixed Bangla-English transcription.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (10 RPM / 250 RPD)',
    recommended: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'High-volume Free Tier model. Fast execution with 1,500 RPD daily quota.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (15 RPM / 1,500 RPD)',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    description: 'High-throughput lightweight model. Highest RPM limit (30 RPM) on AI Studio free tier.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (30 RPM / 1,500 RPD)',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Previous generation Gemini Flash. Reliable legacy fallback option.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (15 RPM / 1,500 RPD)',
  },
  {
    id: 'stt-async-preview',
    name: 'Soniox Async',
    provider: 'soniox',
    description: 'Soniox async transcription engine. Speaker diarization and word-level timestamps.',
    maxAudioLength: 14400,
    supportsDiarization: true,
    supportsTimestamps: true,
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
