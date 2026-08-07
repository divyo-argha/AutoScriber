const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const TRANSCRIBE_PROMPT = `You are an elite, highly detailed Bangla-English speech transcription and speaker diarization engine. Your ONLY job is to output a valid JSON array of transcribed speech segments.

OUTPUT FORMAT (JSON ARRAY ONLY):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি এই বিষয়ে আমাদের কথা বলা দরকার।"},
  {"speaker": "Speaker 2", "startTime": 5.5, "endTime": 10.1, "text": "হ্যাঁ, I completely agree with you."}
]

RULES:
1. Transcribe the exact spoken words in the original language (Bangla or English or a mix).
2. Split into speaker turns with approximate startTime/endTime in seconds relative to the audio clip.
3. Use "Speaker 1", "Speaker 2" etc. for distinct voices. If only one voice, still use "Speaker 1".
4. Do not add filler, commentary, or markdown. Output ONLY the JSON array.`;

export async function transcribeChunkInBrowser(audioBlob, apiKey, modelId = 'gemini-2.0-flash') {
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Open Settings and add your API key.');
  }
  const base64Audio = await blobToBase64(audioBlob);

  const requestBody = {
    contents: [
      {
        parts: [
          { text: TRANSCRIBE_PROMPT },
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/mp3',
              data: base64Audio,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  let response;
  try {
    response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error(`Network error calling Gemini API: ${err.message}`);
  }

  if (!response.ok) {
    let message = `Gemini API error (HTTP ${response.status})`;
    try {
      const err = await response.json();
      message = err.error?.message || message;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini returned no transcript content.');
  }
  return parseSegments(rawText);
}

export function parseSegments(rawText) {
  let cleaned = String(rawText).trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('Could not parse Gemini transcript JSON: ' + err.message);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini did not return a segment array.');
  }
  return parsed
    .map((seg, index) => ({
      speaker: String(seg.speaker || `Speaker ${index + 1}`),
      startTime: Number(seg.startTime) || 0,
      endTime: Number(seg.endTime) || Number(seg.startTime) || 0,
      text: String(seg.text || '').trim(),
    }))
    .filter((seg) => seg.text.length > 0);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}