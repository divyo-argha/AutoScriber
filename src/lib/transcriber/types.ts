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
}

export interface ChunkResult {
  chunkIndex: number;
  segments: TranscriptionSegment[];
  rawText: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'gemini' | 'ollama';
  description: string;
  maxAudioLength: number; // in seconds
  supportsDiarization: boolean;
  supportsTimestamps: boolean;
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
  createdAt: Date;
  updatedAt: Date;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Google latest fast multimodal model. Excellent Bangla-English mixed transcription with native diarization.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Fast and efficient Gemini model. Great for Bangla transcription with good accuracy.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    description: 'Lightweight Gemini model. Faster but less accurate for complex audio.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Previous generation Gemini Flash. Slightly cheaper, good Bangla accuracy.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
  },
  {
    id: 'gemma3:12b',
    name: 'Gemma 3 12B (Local)',
    provider: 'ollama',
    description: 'Local Gemma 3 12B via Ollama. Requires Ollama installed. Good Bangla support with multimodal capabilities.',
    maxAudioLength: 300,
    supportsDiarization: false,
    supportsTimestamps: true,
  },
  {
    id: 'gemma3:4b',
    name: 'Gemma 3 4B (Local)',
    provider: 'ollama',
    description: 'Lightweight local Gemma 3 4B via Ollama. Runs on 16GB RAM. Decent Bangla transcription.',
    maxAudioLength: 180,
    supportsDiarization: false,
    supportsTimestamps: true,
  },
  {
    id: 'gemma4:e4b',
    name: 'Gemma 4 e4b (Local)',
    provider: 'ollama',
    description: 'Local Gemma 4 e4b via Ollama. Better performance for Bangla transcription on M-series Macs.',
    maxAudioLength: 300,
    supportsDiarization: false,
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

export const OLLAMA_TRANSCRIPTION_PROMPT = `You are a Bangla-English audio transcription system. Your ONLY job is to output valid JSON.

RULES:
1. Transcribe audio in the language spoken (Bangla or English)
2. Identify speakers as Speaker 1, Speaker 2, etc
3. Provide accurate timestamps in seconds
4. Output ONLY a valid JSON array - nothing else, no markdown, no explanation

OUTPUT FORMAT (REQUIRED):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি this is very important"}
]

CRITICAL: Output ONLY the JSON array. No markdown. No code blocks. No text before or after.`;
