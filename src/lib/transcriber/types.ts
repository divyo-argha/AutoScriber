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
  skippedChunks?: number[];
}

export interface ChunkResult {
  chunkIndex: number;
  segments: TranscriptionSegment[];
  rawText: string;
  fallbackUsed?: boolean;
  model?: string;
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
  status: 'pending' | 'uploading' | 'chunking' | 'processing' | 'completed' | 'failed' | 'cancelled';
  controlStatus: string; // running, paused, cancel_requested, cancelled
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
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Recommended Google AI Studio Free Tier flagship model. Fast execution, best quality, audio understanding, diarization, and mixed Bangla-English transcription.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (15 RPM / 1500 RPD)',
    recommended: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Gemini 2.5 Flash model (Requires compatible API project or paid Google Cloud account).',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid / Restricted API keys',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Proven high-speed model with 1M context window and high audio stability.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (15 RPM / 1500 RPD)',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Flagship reasoning model for complex audio with heavy diarization needs.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (2 RPM / 50 RPD)',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    description: 'High-throughput lightweight model for quick processing.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free Tier (30 RPM / 1500 RPD)',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    description: 'Gemini 2.5 Flash Lite model.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid / Restricted API keys',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Gemini 2.5 Pro reasoning model.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid / Restricted API keys',
  },
];

export const GEMINI_TRANSCRIPTION_PROMPT = `You are a professional Bangla-English speech transcription engine. Your ONLY job is to output a valid JSON array of transcribed speech segments.

RULES:
1. Transcribe EVERY word that is spoken, exactly as spoken, in the language(s) used (Bangla, English, or mixed). Never summarize, correct, paraphrase, or translate.
2. Transcribe the audio from its first second to its very last second. Never truncate or drop the final sentence — always finish it completely, even if it is cut off at the end of the audio.
3. Identify speakers as "Speaker 1", "Speaker 2", etc., in order of first appearance. Keep the same label for the same voice.
4. Timestamps must be in seconds, relative to the start of the provided audio, with 1 decimal place (e.g. 0.0, 12.3, 45.7). The first segment should start at or near 0.0, and the last segment must cover the final audio content.
5. Split the transcript into natural segments of 1-3 sentences. Assign accurate startTime and endTime to every segment. Use the full audio duration — never stop early.
6. Keep filler words ("আরে", "হুম", "um", "yeah") if they are spoken. Only add [laughing], [silence] style notations when genuinely relevant.

OUTPUT FORMAT (REQUIRED — output ONLY the JSON array; no markdown, no code fences, no extra text):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি this is very important"},
  {"speaker": "Speaker 2", "startTime": 5.5, "endTime": 10.1, "text": "হ্যাঁ, I agree"}
]`;

export const GEMINI_CHUNK_PROMPT = `You are a professional Bangla-English speech transcription engine. Your ONLY job is to output a valid JSON array of transcribed speech segments.

The provided audio is a middle segment of a longer recording. It may begin and end in the middle of a conversation or a sentence. Transcribe it exactly as heard.

RULES:
1. Transcribe EVERY word that is spoken in this audio, exactly as spoken, in the language(s) used (Bangla, English, or mixed). Never summarize, correct, paraphrase, or translate.
2. Transcribe the audio from its first second to its very last second. If a sentence is already in progress at the start, transcribe the words you hear; if the audio ends mid-sentence, finish the sentence in full. Never drop the last sentence.
3. Identify speakers as "Speaker 1", "Speaker 2", etc., in order of first appearance in THIS audio. Keep the same label for the same voice.
4. Timestamps must be in seconds, relative to the start of THIS audio file (0.0 = first second of this audio), with 1 decimal place (e.g. 0.0, 12.3, 45.7). Never use timestamps of the original longer recording.
5. Split the transcript into natural segments of 1-3 sentences. Assign accurate startTime and endTime to every segment. The last segment must reach the very end of the audio.
6. Keep filler words ("আরে", "হুম", "um", "yeah") if they are spoken. Only add [laughing], [silence] style notations when genuinely relevant.

OUTPUT FORMAT (REQUIRED — output ONLY the JSON array; no markdown, no code fences, no extra text):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি this is very important"}
]`;
