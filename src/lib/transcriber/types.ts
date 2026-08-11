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
  provider: 'gemini' | 'vertex';
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
    description: 'Fast, highly accurate production model for speech transcription with native audio understanding and speaker diarization.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free & Paid API Keys Supported',
    recommended: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'High-speed, cost-effective Flash model with high multimodal context window for long audio files.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free & Paid API Keys Supported',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Advanced reasoning model for noisy or complex multi-speaker audio recordings.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Free & Paid API Keys Supported',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Price-performance sweet spot in the 2.5 family. Solid audio understanding and diarization.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    description: 'Fastest and most budget-friendly in the 2.5 family. Good for short audio files where speed matters.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Most advanced model in the 2.5 family — deep reasoning and superior accuracy. Use for difficult or noisy recordings.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
];


export const VERTEX_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash-vertex',
    name: 'Gemini 2.5 Flash (Vertex)',
    provider: 'vertex',
    description: 'Best overall Vertex model for transcription — fast, accurate, native audio understanding with diarization.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
    recommended: true,
  },
  {
    id: 'gemini-2.5-flash-lite-vertex',
    name: 'Gemini 2.5 Flash-Lite (Vertex)',
    provider: 'vertex',
    description: 'Fastest and most cost-efficient Vertex model. Good for high-volume, shorter audio files.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.5-pro-vertex',
    name: 'Gemini 2.5 Pro (Vertex)',
    provider: 'vertex',
    description: 'Most capable Vertex model — best for complex, long, or low-quality audio. Slower and more expensive.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.0-flash-vertex',
    name: 'Gemini 2.0 Flash (Vertex)',
    provider: 'vertex',
    description: 'Mature, widely-deployed Vertex model with solid audio understanding and diarization.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-2.0-flash-lite-vertex',
    name: 'Gemini 2.0 Flash-Lite (Vertex)',
    provider: 'vertex',
    description: 'Budget-friendly Vertex model for shorter audio files where speed matters.',
    maxAudioLength: 3600,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-1.5-flash-vertex',
    name: 'Gemini 1.5 Flash (Vertex)',
    provider: 'vertex',
    description: 'Fast and cost-effective previous-generation Vertex model. Good for long recordings.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
  {
    id: 'gemini-1.5-pro-vertex',
    name: 'Gemini 1.5 Pro (Vertex)',
    provider: 'vertex',
    description: 'Powerful previous-generation Vertex model for difficult or noisy recordings.',
    maxAudioLength: 7200,
    supportsDiarization: true,
    supportsTimestamps: true,
    tierInfo: 'Paid (billing-enabled project required)',
  },
];

const ALL_MODELS_MERGED: ModelInfo[] = [...AVAILABLE_MODELS, ...VERTEX_MODELS];

export const ALL_MODELS: ModelInfo[] = Array.from(
  new Map(ALL_MODELS_MERGED.map(model => [model.id, model])).values()
);


export const GEMINI_TRANSCRIPTION_PROMPT = `You are an elite, highly detailed Bangla-English speech transcription and speaker diarization engine. Your ONLY job is to output a valid JSON array of transcribed speech segments.

EXHAUSTIVE TRANSCRIPTION RULES:
1. VERBATIM & EXHAUSTIVE: Transcribe 100% of EVERY word, phrase, and sentence spoken in the audio from the first second to the very last second. NEVER summarize, skip, paraphrase, omit, or translate any spoken content.
2. BILINGUAL & MIXED SPEECH: Transcribe Bangla in Bangla script, English in English, and code-mixed speech exactly as spoken. Preserve all colloquialisms, filler words ("হুম", "আরে", "um", "like", "you know"), and false starts.
3. SPEAKER DIARIZATION: Distinctly identify every speaker as "Speaker 1", "Speaker 2", "Speaker 3", etc., in order of appearance. Maintain consistent speaker labels whenever the same voice speaks. Do NOT merge distinct voices into a single speaker.
4. COMPLETE TIMESTAMPS: Assign precise start and end timestamps (in seconds, 1 decimal place e.g., 0.0, 4.2) for every segment. Cover the entire audio file from 0.0 to its full duration — NEVER stop early or truncate the final sentence.
5. SEGMENTATION: Break transcript into natural 1-3 sentence conversational blocks with accurate startTime and endTime.
6. NO EXTRA TEXT: Output ONLY the raw JSON array. Do not add markdown code fences, headers, or conversational text.

OUTPUT FORMAT (JSON ARRAY ONLY):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি এই বিষয়ে আমাদের কথা বলা দরকার।"},
  {"speaker": "Speaker 2", "startTime": 5.5, "endTime": 10.1, "text": "হ্যাঁ, I completely agree with you."}
]`;

export const GEMINI_CHUNK_PROMPT = `You are an elite, highly detailed Bangla-English speech transcription and speaker diarization engine. Your ONLY job is to output a valid JSON array of transcribed speech segments.

This audio is a sequential chunk of a longer recording. It may begin or end mid-sentence.

EXHAUSTIVE CHUNK RULES:
1. VERBATIM & EXHAUSTIVE: Transcribe 100% of EVERY word spoken in this audio snippet from second 0.0 to the very end. NEVER summarize, skip, omit, or abbreviate any portion of the audio.
2. MID-SENTENCE CONTINUATION: If speech is mid-sentence at the start or end, transcribe all spoken words completely. Never drop truncated words or sentences.
3. BILINGUAL ACCURACY: Transcribe Bangla in Bangla script, English in English, and mixed speech accurately as spoken.
4. SPEAKER DIARIZATION: Identify speakers as "Speaker 1", "Speaker 2", etc., in order of appearance in THIS snippet. Distinguish different voices clearly.
5. RELATIVE TIMESTAMPS: Timestamps must be relative to the start of THIS audio snippet (0.0 = start of this chunk). The final segment must extend to the end of this audio chunk.
6. NO EXTRA TEXT: Output ONLY the raw JSON array. No markdown code block markers or introductory comments.

OUTPUT FORMAT (REQUIRED — output ONLY the JSON array; no markdown, no code fences, no extra text):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 4.8, "text": "প্রথম কথা হলো, এই কাজটা আমাদের শেষ করতে হবে।"}
]`;
