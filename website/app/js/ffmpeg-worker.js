import { FFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.12.15';
import { toBlobURL, fetchFile } from 'https://esm.sh/@ffmpeg/util@0.12.2';

const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.9/dist/esm';

let ffmpeg = null;
let loadPromise = null;
let onLog = null;

export function setFfmpegLogger(fn) {
  onLog = fn;
}

export function loadFFmpeg() {
  if (ffmpeg) return Promise.resolve(ffmpeg);
  if (!loadPromise) {
    loadPromise = (async () => {
      const instance = new FFmpeg();
      if (onLog) {
        instance.on('log', ({ message }) => onLog(message));
      }
      await instance.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      ffmpeg = instance;
      return ffmpeg;
    })();
  }
  return loadPromise;
}

export async function splitAudioToChunks(file, chunkDurationSeconds = 300) {
  const instance = await loadFFmpeg();
  const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
  const inputName = `input_audio.${ext}`;
  const outPattern = 'chunk_%03d.mp3';

  await instance.writeFile(inputName, await fetchFile(file));
  await instance.exec([
    '-y',
    '-i', inputName,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-f', 'segment',
    '-segment_time', String(chunkDurationSeconds),
    '-reset_timestamps', '1',
    outPattern,
  ]);

  const entries = await instance.readdir('/');
  const names = entries
    .map((e) => e.name)
    .filter((n) => /^chunk_\d{3}\.mp3$/.test(n))
    .sort();

  const chunks = [];
  for (const name of names) {
    const data = await instance.readFile(name);
    if (data && data.byteLength > 0) {
      chunks.push({ name, blob: new Blob([data], { type: 'audio/mp3' }) });
    }
    await instance.deleteFile(name);
  }
  await instance.deleteFile(inputName);
  return chunks;
}

export function measureDuration(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}