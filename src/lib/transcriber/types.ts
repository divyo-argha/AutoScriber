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
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    description: 'Latest generation Flash model. Best overall for transcription — fast, accurate, and supports audio understanding. Requires a billing-enabled Google Cloud project.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
    recommended: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'gemini',
    description: 'Fastest and most cost-efficient current model. Good for high-volume, shorter audio files. Requires a billing-enabled Google Cloud project.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    provider: 'gemini',
    description: 'Most capable current model — best for complex, long, or low-quality audio. Slower and more expensive. Requires a billing-enabled Google Cloud project.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Price-performance sweet spot in the 2.5 family. Solid audio understanding and diarization. Requires a billing-enabled Google Cloud project.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    description: 'Fastest and most budget-friendly in the 2.5 family. Good for short audio files where speed matters. Requires a billing-enabled Google Cloud project.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Most advanced model in the 2.5 family — deep reasoning and superior accuracy. Use for difficult or noisy recordings. Requires a billing-enabled Google Cloud project.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
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
