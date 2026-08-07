import {
  getSettings,
  saveSettings,
  listJobs,
  saveJob,
  getJob,
  updateJob,
  deleteJob,
} from './db.js';
import { splitAudioToChunks, measureDuration, setFfmpegLogger } from './ffmpeg-worker.js';
import { transcribeChunkInBrowser } from './gemini-client.js';
import { exportTranscript, formatTime } from './exporter.js';

const MODELS = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

const CHUNK_SECONDS = 240;

const state = {
  settings: { apiKey: '', model: MODELS[1].id },
  view: 'dashboard',
  activeJobId: null,
  draftFiles: [],
  recording: false,
  recorder: null,
  recChunks: [],
  recTimer: null,
  recElapsed: 0,
  transcription: null,
  queue: null,
  syncTimer: null,
};

const viewEl = document.getElementById('app-view');
const dialogEl = document.getElementById('app-settings-dialog');
const modelSelect = document.getElementById('setting-model');
const apiKeyInput = document.getElementById('setting-api-key');

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'audio/*';
fileInput.multiple = true;
fileInput.style.display = 'none';
document.body.appendChild(fileInput);
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length) {
    state.draftFiles = Array.from(fileInput.files);
    renderNewView();
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setView(html) {
  viewEl.innerHTML = html;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function statusChip(job) {
  return `<span class="job-status ${esc(job.status)}">${esc(job.status)}</span>`;
}

function jobMeta(job) {
  const made = new Date(job.createdAt || Date.now());
  const parts = [
    `${made.toLocaleDateString()} ${made.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    esc(job.model || 'gemini'),
  ];
  const segs = jobSegments(job);
  if (segs.length) parts.push(`${segs.length} segments`);
  if (job.status === 'processing' && job.chunksTotal && job.chunksDone != null) {
    parts.push(`${job.chunksDone}/${job.chunksTotal} chunks`);
  }
  return parts.join(' · ');
}

function jobCard(job) {
  return `
    <button class="job-card" data-action="open-job" data-id="${esc(job.id)}">
      <span class="job-card-name">${esc(job.name)}</span>
      <span class="job-card-meta">${jobMeta(job)}</span>
      <span class="job-card-meta">${statusChip(job)}${job.error ? ' · ' + esc(job.error) : ''}</span>
    </button>`;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function jobSegments(job) {
  if (Array.isArray(job.segments) && job.segments.length) return job.segments;
  if (Array.isArray(job.chunkResults) && job.chunkResults.length) {
    const offsets = Array.isArray(job.chunkOffsets) ? job.chunkOffsets : [];
    const all = [];
    job.chunkResults.forEach((segs, i) => {
      if (!Array.isArray(segs)) return;
      const offset = offsets[i] || 0;
      for (const seg of segs) {
        all.push({
          speaker: seg.speaker,
          startTime: Math.max(0, (Number(seg.startTime) || 0) + offset),
          endTime: Math.max(0, (Number(seg.endTime) || 0) + offset),
          text: seg.text,
        });
      }
    });
    all.sort((a, b) => a.startTime - b.startTime);
    return all;
  }
  return [];
}

async function renderDashboard() {
  state.view = 'dashboard';
  state.activeJobId = null;
  stopSync();
  let jobs = [];
  try {
    jobs = await listJobs();
  } catch (err) {
    setView(`<div class="status-banner error">Could not load jobs: ${esc(err.message)}</div>`);
    return;
  }
  const hasKey = !!state.settings.apiKey;
  const queuable = jobs.filter((j) => j.status === 'draft' || j.status === 'paused' || j.status === 'failed');
  const grid = jobs.length
    ? `<div class="job-grid">${jobs.map(jobCard).join('')}</div>`
    : `<div class="empty-state">
         <h3>No transcription jobs yet</h3>
         <p>Create a job to upload or record audio and transcribe it locally with Gemini.</p>
       </div>`;
  setView(`
    <h1 class="view-title">Dashboard</h1>
    <p class="view-sub">Your jobs are stored privately in this browser. Audio is only sent to the Gemini API during transcription.</p>
    ${hasKey ? '' : '<div class="status-banner error">No API key set yet — add a key in Settings before transcribing.</div>'}
    <div class="app-actions-row">
      <button class="btn-primary" data-action="new-job">+ New job</button>
      <button class="app-btn-secondary" data-action="open-settings">Settings</button>
      ${queuable.length ? `<button class="btn-primary" data-action="transcribe-queue">Transcribe queue (${queuable.length})</button>` : ''}
    </div>
    ${grid}
  `);
}

function renderNewView() {
  state.view = 'new';
  stopSync();
  const files = state.draftFiles;
  const fileRows = files
    .map(
      (f) => `
      <div class="file-fact">
        <span class="file-fact-name">${esc(f.name)}</span>
        <span class="file-fact-size">${formatBytes(f.size)}</span>
      </div>`
    )
    .join('');
  const fileList = files.length
    ? `<div class="app-field"><span>Selected ${files.length} file(s)</span>${fileRows}<span class="app-hint">Each file becomes its own job. Jobs are processed one after another.</span></div>`
    : `<div class="dropzone" data-action="choose-file">
         <p>↑</p>
         <strong>Choose audio files</strong>
         <span>MP3, WAV, OGG, M4A, WebM… (multi-select supported)</span>
       </div>`;
  setView(`
    <button class="app-btn-secondary" data-action="dashboard">← All jobs</button>
    <h1 class="view-title" style="margin-top:1rem">New transcription job</h1>
    <p class="view-sub">Upload one or more audio files or record directly from your microphone. Everything stays in your browser until you start transcription.</p>
    <form class="app-form" data-new-form>
      <label class="app-field">
        <span>Model</span>
        <select id="new-job-model">
          ${MODELS.map((m) => `<option value="${m.id}" ${m.id === state.settings.model ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <span class="app-hint">Gemini <code>2.5 Flash</code> is a good default for speed. Use <code>2.5 Pro</code> for higher accuracy on noisy audio.</span>
      </label>
      ${files.length ? `<div style="display:flex;gap:0.75rem"><button type="button" class="app-btn-secondary" data-action="choose-file">Add more files</button><button type="button" class="app-btn-secondary" data-action="clear-file">Clear selection</button></div>` : ''}
      ${fileList}
      <div class="record-panel">
        <button type="button" class="rec-btn ${state.recording ? 'recording' : ''}" data-action="toggle-record">
          ${state.recording ? '&#9632;' : '&#9679;'}
        </button>
        <div class="rec-timer">${state.recording ? formatClock(state.recElapsed) : 'or record from microphone'}</div>
      </div>
      <div class="app-actions-row">
        <button type="submit" class="btn-primary" ${files.length ? '' : 'disabled'}>${files.length > 1 ? `Create ${files.length} jobs &amp; transcribe` : 'Create &amp; transcribe'}</button>
        <button type="button" class="app-btn-secondary" data-action="dashboard">Cancel</button>
      </div>
    </form>
  `);
}

async function toggleRecording() {
  if (state.recording) {
    if (state.recorder) state.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    toast('Recording is not supported in this browser.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeSupported = MediaRecorder.isTypeSupported('audio/webm;codecs=opus');
    const recorder = new MediaRecorder(stream, mimeSupported ? { mimeType: 'audio/webm;codecs=opus' } : undefined);
    state.recorder = recorder;
    state.recChunks = [];
    state.recording = true;
    state.recElapsed = 0;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.recChunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = state.recChunks[0]?.type || 'audio/webm';
      const file = new File(state.recChunks, `recording-${Date.now()}.webm`, { type, lastModified: Date.now() });
      state.draftFiles = [file];
      state.recording = false;
      state.recorder = null;
      clearInterval(state.recTimer);
      state.recTimer = null;
      toast('Recording saved.');
      renderNewView();
    };
    recorder.start(250);
    state.recTimer = setInterval(() => {
      state.recElapsed += 0.25;
      const t = document.querySelector('.rec-timer');
      if (t) t.textContent = formatClock(state.recElapsed);
    }, 250);
    renderNewView();
  } catch (err) {
    toast('Microphone access was denied: ' + err.message);
  }
}

async function createJobs() {
  if (!state.draftFiles.length) {
    toast('Choose or record an audio file first.');
    return;
  }
  if (!state.settings.apiKey) {
    toast('Add your Gemini API key in Settings before transcribing.');
    return;
  }
  const modelInput = document.getElementById('new-job-model');
  const model = modelInput ? modelInput.value : state.settings.model;

  const created = [];
  for (const file of state.draftFiles) {
    const name = (file.name.match(/[^.]+(?=\.[^.]+$)/) || [file.name])[0] || 'Untitled job';
    const job = {
      id: (crypto.randomUUID && crypto.randomUUID()) || `job-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      name,
      model,
      fileName: file.name,
      status: 'draft',
      segments: [],
      chunkResults: [],
      chunkOffsets: [],
      chunksDone: 0,
      chunksTotal: 0,
      progress: 0,
      error: '',
    };
    await saveJob(job, file);
    created.push(job.id);
  }
  state.draftFiles = [];
  if (created.length === 1) {
    state.activeJobId = created[0];
    await renderJobView(created[0]);
    startTranscription();
  } else {
    await processQueue(created);
  }
}

async function fetchAudioBlob(job) {
  if (job && job.audioUrl) {
    try {
      const res = await fetch(job.audioUrl);
      if (res.ok) return await res.blob();
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function runTranscription(jobId) {
  if (state.transcription) return;
  const job = await getJob(jobId);
  if (!job) return;
  if (!state.settings.apiKey) {
    toast('Add your Gemini API key in Settings first.');
    return;
  }
  const audioBlob = await fetchAudioBlob(job);
  if (!audioBlob) {
    toast('This job has no audio to transcribe.');
    return;
  }

  const wasResume = job.status === 'paused' && job.chunksDone > 0;
  if (!Array.isArray(job.chunkResults)) job.chunkResults = [];
  if (!Array.isArray(job.chunkOffsets)) job.chunkOffsets = [];

  state.transcription = { cancelled: false, pauseRequested: false };
  job.status = 'processing';
  job.error = '';
  job.progress = wasResume ? job.progress || 5 : 5;
  await updateJob(job);
  await renderJobView(jobId);

  try {
    setFfmpegLogger(() => {});
    const chunks = await splitAudioToChunks(audioBlob, CHUNK_SECONDS);
    if (state.transcription.cancelled) throw new Cancelled();
    if (state.transcription.pauseRequested) return await pauseJob(jobId);
    if (!chunks.length) throw new Error('The audio could not be split into chunks.');

    const total = chunks.length;
    job.chunksTotal = total;

    const offsets = [];
    let acc = 0;
    for (const chunk of chunks) {
      offsets.push(acc);
      acc += await measureDuration(chunk.blob);
      if (state.transcription.cancelled) throw new Cancelled();
      if (state.transcription.pauseRequested) {
        job.chunkOffsets = offsets;
        job.durationSec = acc;
        await updateJob(job);
        return await pauseJob(jobId);
      }
    }
    job.chunkOffsets = offsets;
    job.durationSec = acc;

    const startIdx = Math.min(job.chunksDone || 0, total);
    for (let i = startIdx; i < total; i++) {
      if (state.transcription.cancelled) throw new Cancelled();
      if (state.transcription.pauseRequested) {
        job.chunksDone = i;
        await updateJob(job);
        return await pauseJob(jobId);
      }
      job.progress = Math.round((i / total) * 90);
      await updateJob(job);
      updateProgress(i, total);
      const segs = await transcribeChunkInBrowser(chunks[i].blob, state.settings.apiKey, job.model);
      if (state.transcription.cancelled) throw new Cancelled();
      if (state.transcription.pauseRequested) {
        job.chunkResults[i] = segs;
        job.chunksDone = i + 1;
        await updateJob(job);
        return await pauseJob(jobId);
      }
      job.chunkResults[i] = segs;
      job.chunksDone = i + 1;
      await updateJob(job);
    }

    const all = [];
    for (let i = 0; i < total; i++) {
      const segs = job.chunkResults[i] || [];
      const offset = job.chunkOffsets[i] || 0;
      for (const seg of segs) {
        all.push({
          speaker: seg.speaker,
          startTime: Math.max(0, (Number(seg.startTime) || 0) + offset),
          endTime: Math.max(0, (Number(seg.endTime) || 0) + offset),
          text: seg.text,
        });
      }
    }
    all.sort((a, b) => a.startTime - b.startTime);

    job.segments = all;
    job.status = 'done';
    job.progress = 100;
    await updateJob(job);
    state.transcription = null;
    toast('Transcription complete.');
    renderJobView(jobId);
  } catch (err) {
    state.transcription = null;
    if (err instanceof Cancelled) {
      job.status = 'draft';
      job.error = '';
      job.chunkResults = [];
      job.chunkOffsets = [];
      job.chunksDone = 0;
      await updateJob(job);
      toast('Transcription cancelled.');
      renderJobView(jobId);
    } else {
      job.status = 'failed';
      job.error = err.message || 'Transcription failed';
      await updateJob(job);
      toast('Transcription failed.');
      renderJobView(jobId);
    }
  }
}

async function pauseJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return;
  job.status = 'paused';
  await updateJob(job);
  state.transcription = null;
  toast('Paused. Resume continues from the last chunk.');
  renderJobView(jobId);
}

class Cancelled extends Error {
  constructor() {
    super('Transcription cancelled');
    this.name = 'Cancelled';
  }
}

function resumeTranscription() {
  if (state.transcription) return;
  runTranscription(state.activeJobId);
}

function updateProgress(done, total) {
  const fill = document.querySelector('[data-progress]');
  const label = document.querySelector('[data-progress-label]');
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `Chunk ${Math.min(done + 1, total)} of ${total}`;
}

async function processQueue(jobIds) {
  if (state.queue) {
    toast('A queue is already running.');
    return;
  }
  state.queue = { ids: jobIds.slice(), aborted: false };
  try {
    for (const id of state.queue.ids) {
      if (state.queue.aborted) break;
      state.activeJobId = id;
      await renderJobView(id);
      await runTranscription(id);
      const job = await getJob(id);
      if (job && (job.status === 'paused' || job.status === 'processing')) break;
    }
  } finally {
    state.queue = null;
  }
  renderDashboard();
}

function abortQueue() {
  if (state.queue) state.queue.aborted = true;
  cancelTranscription();
}

function cancelTranscription() {
  if (state.transcription) state.transcription.cancelled = true;
}

function pauseTranscription() {
  if (state.transcription) state.transcription.pauseRequested = true;
  toast('Pausing after the current chunk…');
}

async function saveEdits(jobId) {
  const job = await getJob(jobId);
  if (!job) return;
  const rows = document.querySelectorAll('.seg-row');
  const segments = Array.from(rows).map((row) => ({
    speaker: row.querySelector('.seg-speaker').value.trim() || 'Speaker',
    text: row.querySelector('.seg-text').value,
    startTime: Number(row.dataset.start) || 0,
    endTime: Number(row.dataset.end) || 0,
  }));
  if (!segments.length) {
    toast('Nothing to save.');
    return;
  }
  job.segments = segments;
  job.chunkResults = [];
  job.chunkOffsets = [];
  await updateJob(job);
  toast('Edits saved.');
  renderJobView(jobId);
}

async function renderJobView(jobId) {
  state.view = 'job';
  state.activeJobId = jobId;
  stopSync();
  const job = await getJob(jobId);
  if (!job) {
    renderDashboard();
    return;
  }
  const segments = jobSegments(job);
  const status = job.status;
  const isProcessing = status === 'processing';
  const isPaused = status === 'paused';
  const isDone = status === 'done' && segments.length > 0;
  const failed = status === 'failed';

  const segHtml = segments
    .map(
      (seg, i) => `
      <div class="seg-row" data-start="${Number(seg.startTime || 0)}" data-end="${Number(seg.endTime || 0)}" tabindex="-1">
        <div class="segment-head">
          <button class="seg-seek" data-action="seek" data-sec="${Number(seg.startTime || 0)}" title="Play from here">▶</button>
          <span class="segment-time">${formatTime(seg.startTime)} – ${formatTime(seg.endTime)}</span>
        </div>
        <input class="seg-speaker" value="${esc(seg.speaker)}" aria-label="Speaker name" />
        <textarea class="seg-text" rows="2" aria-label="Transcript text">${esc(seg.text)}</textarea>
      </div>`,
    )
    .join('');

  const banner = failed ? `<div class="status-banner error">${esc(job.error || 'Transcription failed')}</div>` : '';

  const processingUI = isProcessing
    ? `<div class="status-banner">
         <div style="flex:1"><div class="progress-track"><div class="progress-fill" data-progress style="width:${job.progress || 0}%"></div></div></div>
         <span data-progress-label>Preparing audio…</span>
       </div>`
    : isPaused
      ? `<div class="status-banner"><strong style="color:var(--brand-blue)">Paused</strong><span>&nbsp;·&nbsp;Resume to continue from chunk ${job.chunksDone || 0} of ${job.chunksTotal || '?'}</span></div>`
      : '';

  const metaParts = [statusChip(job), esc(job.model)];
  if (segments.length) metaParts.push(`${segments.length} segments`);
  if (job.durationSec) metaParts.push(`${formatTime(job.durationSec)} audio`);
  if (job.chunksTotal) metaParts.push(`${job.chunksDone || 0}/${job.chunksTotal} chunks`);

  const manageButtons = isProcessing
    ? `<button class="app-btn-secondary" data-action="pause">Pause</button><button class="app-btn-secondary" data-action="cancel">Cancel</button>`
    : isPaused
      ? `<button class="btn-primary" data-action="resume">Resume</button><button class="app-btn-secondary" data-action="cancel">Cancel</button>`
      : `<button class="app-btn-secondary" data-action="start-transcribe" title="Run the model over the audio again">Transcribe</button>`;
  const manageOnDone = isDone ? `<button class="app-btn-secondary" data-action="save-edits">Save edits</button>` : '';
  const exportEnabled = isDone && !state.queue;

  setView(`
    <button class="app-btn-secondary" data-action="dashboard">← All jobs</button>
    <h1 class="view-title" style="margin-top:1rem">${esc(job.name)}</h1>
    <p class="view-sub">${metaParts.join(' · ')}</p>
    ${banner}
    ${processingUI}
    <div class="detail-grid">
      <div class="detail-side">
        ${job.audioUrl ? '<div class="audio-shell"><audio controls data-audio></audio></div>' : ''}
        <div>
          <h3>Export</h3>
          <p class="view-sub">Generated entirely in your browser. PDF uses an embedded Bangla font.</p>
          <div class="export-grid">
            <button class="export-btn" data-action="export" data-format="txt" ${exportEnabled ? '' : 'disabled'}>TXT</button>
            <button class="export-btn" data-action="export" data-format="srt" ${exportEnabled ? '' : 'disabled'}>SRT</button>
            <button class="export-btn" data-action="export" data-format="json" ${exportEnabled ? '' : 'disabled'}>JSON</button>
            <button class="export-btn" data-action="export" data-format="docx" ${exportEnabled ? '' : 'disabled'}>DOCX</button>
            <button class="export-btn" data-action="export" data-format="pdf" ${exportEnabled ? '' : 'disabled'}>PDF</button>
            <button class="export-btn" data-action="export" data-format="zip" ${exportEnabled ? '' : 'disabled'}>ZIP</button>
          </div>
        </div>
        <div>
          <h3>Manage</h3>
          <div class="app-actions-row">
            ${manageButtons}
            <button class="app-btn-secondary" data-action="delete-job" data-id="${esc(job.id)}">Delete</button>
          </div>
          ${isDone ? '<button class="app-btn-secondary" data-action="save-edits" style="margin-top:0.5rem">Save edits</button>' : ''}
        </div>
      </div>
      <div class="detail-main">
        ${failed ? `
          <div class="empty-state">
            <h3>Transcription failed</h3>
            <p>${esc(job.error)}</p>
            <p style="margin-top:1rem"><button class="btn-primary" data-action="start-transcribe">Try again</button></p>
          </div>` : ''}
        ${!failed && !isProcessing && !segments.length ? `
          <div class="empty-state">
            <h3>Ready to transcribe</h3>
            <p>Generate speaker-aware segments with the Gemini API.</p>
            <p style="margin-top:1rem"><button class="btn-primary" data-action="start-transcribe">Start transcription</button></p>
          </div>` : ''}
        ${segments.length ? `
          <div class="segments-list">${segHtml}</div>
          ${isDone ? `<div class="app-actions-row" style="margin-top:1rem"><button class="btn-primary" data-action="save-edits">Save edits</button></div>` : ''}
          ` : ''}
      </div>
    </div>
  `);

  const audioEl = document.querySelector('.audio-shell audio');
  if (audioEl) {
    audioEl.src = job.audioUrl;
    audioEl.addEventListener('play', () => startSync(audioEl, segments));
    audioEl.addEventListener('pause', () => stopSync());
    audioEl.addEventListener('ended', () => stopSync());
  }
}

function startSync(audioEl, segments) {
  stopSync();
  state.syncTimer = setInterval(() => {
    const t = audioEl.currentTime;
    let active = -1;
    for (let i = 0; i < segments.length; i++) {
      if (t >= segments[i].startTime - 0.25 && t <= segments[i].endTime + 0.25) {
        active = i;
        break;
      }
    }
    document.querySelectorAll('.seg-row').forEach((el, j) => el.classList.toggle('active', j === active));
  }, 250);
}

function stopSync() {
  if (state.syncTimer) {
    clearInterval(state.syncTimer);
    state.syncTimer = null;
  }
}

async function deleteJobAction(id) {
  if (!window.confirm('Delete this job and its stored audio? This cannot be undone.')) return;
  await deleteJob(id);
  toast('Deleted');
  renderDashboard();
}

async function handleExport(format) {
  const job = await getJob(state.activeJobId);
  if (!job || job.status !== 'done' || !Array.isArray(job.segments) || !job.segments.length) {
    toast('Export is available once the transcription is done.');
    return;
  }
  try {
    toast(`Exporting ${format.toUpperCase()}…`);
    await exportTranscript(job.segments, format, job.name);
    toast('Download started.');
  } catch (err) {
    toast('Export failed: ' + err.message);
  }
}

async function openSettings() {
  const stored = await getSettings();
  state.settings = { apiKey: stored.apiKey || '', model: stored.model || MODELS[1].id };
  apiKeyInput.value = state.settings.apiKey;
  modelSelect.innerHTML = MODELS.map(
    (m) => `<option value="${m.id}" ${m.id === state.settings.model ? 'selected' : ''}>${m.label}</option>`
  ).join('');
  dialogEl.showModal();
}

async function saveSettingsDialog() {
  const settings = { apiKey: apiKeyInput.value.trim(), model: modelSelect.value };
  await saveSettings(settings);
  state.settings = settings;
  dialogEl.close();
  toast('Settings saved');
  renderDashboard();
}

async function init() {
  const stored = await getSettings();
  state.settings = { apiKey: stored.apiKey || '', model: stored.model || MODELS[1].id };

  const jobs = await listJobs();
  for (const job of jobs) {
    if (job.status === 'processing') {
      job.status = 'paused';
      job.error = '';
      await updateJob(job);
    }
  }

  renderDashboard();
}

viewEl.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  switch (action) {
    case 'new-job':
      renderNewView();
      break;
    case 'dashboard':
      renderDashboard();
      break;
    case 'open-settings':
      openSettings();
      break;
    case 'transcribe-queue':
      listJobs()
        .then((jobs) => jobs.filter((j) => j.status === 'draft' || j.status === 'paused' || j.status === 'failed').map((j) => j.id))
        .then((ids) => ids.length && processQueue(ids));
      break;
    case 'open-job':
      renderJobView(target.dataset.id);
      break;
    case 'delete-job':
      deleteJobAction(target.dataset.id);
      break;
    case 'clear-file':
      state.draftFiles = [];
      renderNewView();
      break;
    case 'choose-file':
      fileInput.click();
      break;
    case 'toggle-record':
      toggleRecording();
      break;
    case 'start-transcribe':
      runTranscription(state.activeJobId);
      break;
    case 'resume':
      resumeTranscription();
      break;
    case 'pause':
      pauseTranscription();
      break;
    case 'cancel':
      cancelTranscription();
      break;
    case 'save-edits':
      saveEdits(state.activeJobId);
      break;
    case 'export':
      handleExport(target.dataset.format);
      break;
    case 'seek': {
      const audio = document.querySelector('.audio-shell audio');
      if (audio) {
        audio.currentTime = Number(target.dataset.sec || 0);
        audio.play().catch(() => {});
      }
      break;
    }
    default:
      break;
  }
});

viewEl.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-new-form]');
  if (form) {
    e.preventDefault();
    createJobs();
  }
});

dialogEl.addEventListener('click', async (e) => {
  if (e.target.closest('[data-dialog-save]')) {
    await saveSettingsDialog();
  }
});

init();