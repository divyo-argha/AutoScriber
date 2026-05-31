import fs from 'fs';
import type { TranscriptionSegment, ChunkResult } from './types';

const SONIOX_API = 'https://api.soniox.com/v1';

interface SonioxToken {
  text: string;
  start_ms: number;
  end_ms: number;
  speaker?: string;
}

function tokensToSegments(tokens: SonioxToken[], timeOffset: number): TranscriptionSegment[] {
  if (!tokens.length) return [];

  const segments: TranscriptionSegment[] = [];
  let current: TranscriptionSegment | null = null;

  for (const token of tokens) {
    const speaker = token.speaker || 'Speaker 1';
    const start = token.start_ms / 1000 + timeOffset;
    const end = token.end_ms / 1000 + timeOffset;
    const text = token.text;

    if (!text.trim()) continue;

    if (current && current.speaker === speaker && start - current.endTime < 2) {
      current.text += text;
      current.endTime = end;
    } else {
      if (current) segments.push(current);
      current = { speaker, startTime: start, endTime: end, text };
    }
  }
  if (current) segments.push(current);

  return segments.map(s => ({ ...s, text: s.text.trim() })).filter(s => s.text.length > 0);
}

async function pollUntilDone(id: string, apiKey: string): Promise<void> {
  const deadline = Date.now() + 10 * 60 * 1000; // 10 min max
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`${SONIOX_API}/transcriptions/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Soniox poll error: ${res.status}`);
    const data = await res.json();
    if (data.status === 'completed') return;
    if (data.status === 'error') throw new Error(`Soniox transcription failed: ${data.error_message}`);
  }
  throw new Error('Soniox transcription timed out');
}

export async function transcribeChunkWithSoniox(
  filePath: string,
  apiKey: string,
  modelId: string,
  chunkIndex: number,
  timeOffset: number
): Promise<ChunkResult> {
  // Step 1: Upload file
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = filePath.split('/').pop() || 'audio.mp3';
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);

  const uploadRes = await fetch(`${SONIOX_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Soniox file upload failed: ${uploadRes.status} - ${err}`);
  }
  const uploadData = await uploadRes.json();
  const fileId = uploadData.id;

  // Step 2: Create transcription
  const createRes = await fetch(`${SONIOX_API}/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      file_id: fileId,
      language_hints: ['bn', 'en'],
      enable_speaker_diarization: true,
      enable_language_identification: true,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Soniox create transcription failed: ${createRes.status} - ${err}`);
  }
  const { id } = await createRes.json();

  // Step 3: Poll until done
  await pollUntilDone(id, apiKey);

  // Step 4: Get transcript
  const transcriptRes = await fetch(`${SONIOX_API}/transcriptions/${id}/transcript`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!transcriptRes.ok) throw new Error(`Soniox get transcript failed: ${transcriptRes.status}`);
  const transcript = await transcriptRes.json();

  // Step 5: Cleanup
  await fetch(`${SONIOX_API}/transcriptions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => {});

  const segments = tokensToSegments(transcript.tokens || [], timeOffset);
  return { chunkIndex, segments, rawText: transcript.text || '' };
}

export async function testSonioxConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${SONIOX_API}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
