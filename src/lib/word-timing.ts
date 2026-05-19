export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

export function calculateWordTimings(text: string, segmentStart: number, segmentEnd: number): WordTiming[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const segmentDuration = segmentEnd - segmentStart;
  const wordDuration = segmentDuration / words.length;

  return words.map((word, idx) => ({
    word,
    startTime: segmentStart + idx * wordDuration,
    endTime: segmentStart + (idx + 1) * wordDuration,
  }));
}

export function getCurrentWord(wordTimings: WordTiming[], currentTime: number): WordTiming | null {
  return wordTimings.find(w => currentTime >= w.startTime && currentTime <= w.endTime) || null;
}
