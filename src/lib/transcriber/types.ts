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
];

export const GEMINI_TRANSCRIPTION_PROMPT = `You are an expert transcription system specialized in Bangla (Bengali) and English mixed-language audio transcription.

TASK: Transcribe the provided audio accurately with the following requirements:

1. LANGUAGE: The audio contains a mix of Bangla and English. Transcribe each word in the language it was spoken. Do NOT translate English words to Bangla or vice versa. Keep the original language of each word as spoken.

2. SPEAKER DIARIZATION: Identify different speakers and label them as Speaker 1, Speaker 2, Speaker 3, etc. Each segment should indicate who is speaking.

3. TIMESTAMPS: For each speaker segment, provide the start and end timestamps in seconds.

4. FORMAT: Return the transcription as a JSON array with this exact structure:
[
  {
    "speaker": "Speaker 1",
    "startTime": 0.0,
    "endTime": 5.2,
    "text": "আমি মনে করি this is very important"
  },
  {
    "speaker": "Speaker 2",
    "startTime": 5.5,
    "endTime": 10.1,
    "text": "হ্যাঁ, I agree with that point"
  }
]

IMPORTANT RULES:
- Keep English words in English script, Bangla words in Bangla script
- Preserve natural speech patterns including filler words
- Include timestamps accurate to 0.1 seconds
- If you cannot determine the speaker, label as "Speaker Unknown"
- Return ONLY the JSON array, no additional text or markdown formatting`;

export const GEMINI_CHUNK_PROMPT = `You are an expert transcription system specialized in Bangla (Bengali) and English mixed-language audio transcription.

TASK: Transcribe the provided audio chunk accurately with the following requirements:

1. LANGUAGE: The audio contains a mix of Bangla and English. Transcribe each word in the language it was spoken. Do NOT translate. Keep original languages.

2. SPEAKER DIARIZATION: Identify different speakers and label them as Speaker 1, Speaker 2, etc.

3. TIMESTAMPS: For each segment, provide the start and end timestamps in seconds (relative to the start of this chunk).

4. FORMAT: Return the transcription as a JSON array:
[
  {
    "speaker": "Speaker 1",
    "startTime": 0.0,
    "endTime": 5.2,
    "text": "আমি মনে করি this is very important"
  }
]

IMPORTANT RULES:
- Keep English words in English script, Bangla words in Bangla script
- Preserve natural speech patterns including filler words
- Return ONLY the JSON array, no additional text or markdown`;

export const OLLAMA_TRANSCRIPTION_PROMPT = `You are a Bangla-English mixed language transcription assistant. The user will provide an audio recording. Transcribe it accurately following these rules:

1. Keep Bangla words in Bangla script and English words in English script
2. Preserve the original language of each word as spoken
3. Include timestamps for each segment
4. Identify different speakers if possible

Return the transcription as a JSON array:
[
  {
    "speaker": "Speaker 1",
    "startTime": 0.0,
    "endTime": 5.2,
    "text": "transcribed text here"
  }
]

Return ONLY valid JSON, no additional text.`;
