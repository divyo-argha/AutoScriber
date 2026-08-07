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
  draftBlob: null,
  draftFileName: '',
  recording: false,
  recorder: null,
  recChunks: [],
  recTimer: null,
  recElapsed: 0,
  transcription: null,
  syncTimer: null,
};

const viewEl = document.getElementById('app-view');
const dialogEl = document.getElementById('app-settings-dialog');
const modelSelect = document.getElementById('setting-model');
const apiKeyInput = document.getElementById('setting-api-key');

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'audio/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    state.draftBlob = fileInput.files[0];
    state.draftFileName = fileInput.files[0].name;
    renderNewView();
  }
});

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
  if (Array.isArray(job.segments) && job.segments.length) parts.push(`${job.segments.length} segments`);
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
  const grid = jobs.length
    ? `<div class="job-grid">${jobs.map(jobCard).join('')}</div>`
    : `<div class="empty-state">
         <h3>No transcription jobs yet</h3>
         <p>Create a job to upload or record audio and transcribe it locally with Gemini.</p>
       </div>`;
  setView(`
    <h1 class="view-title">Dashboard</h1>
    <p class="view-sub">Your jobs are stored privately in this browser. Audio is only sent to the Gemini API during transcription.</p>
    ${hasKey ? '' : '<div class="status-banner error">No API key set yet — add one in Settings before transcribing.</div>'}
    <div class="app-actions-row">
      <button class="btn-primary" data-action="new-job">+ New job</button>
      <button class="app-btn-secondary" data-action="open-settings">Settings</button>
    </div>
    ${grid}
  `);
}

function renderNewView() {
  state.view = 'new';
  stopSync();
  const hasAudio = !!state.draftBlob;
  setView(`
    <button class="app-btn-secondary" data-action="dashboard">← All jobs</button>
    <h1 class="view-title" style="margin-top:1rem">New transcription job</h1>
    <p class="view-sub">Upload an audio file or record directly from your microphone. Everything stays in your browser until you start transcription.</p>
    <form class="app-form" data-new-form>
      <label class="app-field">
        <span>Job name</span>
        <input id="new-job-name" type="text" placeholder="e.g. Interview with Rahim" value="${esc(state.draftFileName.replace(/\.[^.]+$/, ''))}" />
      </label>
      <label class="app-field">
        <span>Model</span>
        <select id="new-job-model">
          ${MODELS.map((m) => `<option value="${m.id}" ${m.id === state.settings.model ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <span class="app-hint">Gemini <code>2.5 Flash</code> is a good default for speed. Use <code>2.5 Pro</code> for higher accuracy on noisy audio.</span>
      </label>
      ${hasAudio
        ? `<div class="file-fact">
             <span class="file-fact-name">${esc(state.draftFileName)}</span>
             <span class="file-fact-size">${formatBytes(state.draftBlob.size)}</span>
             <span class="app-actions-row" style="margin-left:auto;margin-bottom:0">
               <button type="button" class="app-btn-secondary" data-action="choose-file">Replace</button>
               <button type="button" class="app-btn-secondary" data-action="clear-file">Remove</button>
             </span>
           </div>`
        : `<div class="dropzone" data-action="choose-file">
             <p>↑</p>
             <strong>Choose an audio file</strong>
             <span>MP3, WAV, OGG, M4A, WebM…</span>
           </div>`}
      <div class="record-panel">
        <button type="button" class="rec-btn ${state.recording ? 'recording' : ''}" data-action="toggle-record">
          ${state.recording ? '&#9632;' : '&#9679;'}
        </button>
        <div class="rec-timer">${state.recording ? formatClock(state.recElapsed) : 'Tap to record from microphone'}</div>
      </div>
      <div class="app-actions-row">
        <button type="submit" class="btn-primary" ${hasAudio ? '' : 'disabled'}>Create &amp; transcribe</button>
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
      state.draftBlob = new Blob(state.recChunks, { type });
      state.draftFileName = `recording-${Date.now()}.webm`;
      state.recording = false;
      state.recorder = null;
      clearInterval(state.recTimer);
      state.recTimer = null;
      toast('Recording saved. You can now create the job.');
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

async function createJob() {
  if (!state.draftBlob) {
    toast('Choose or record an audio file first.');
    return;
  }
  if (!state.settings.apiKey) {
    toast('Add your Gemini API key in Settings before transcribing.');
    return;
  }
  const nameInput = document.getElementById('new-job-name');
  const modelInput = document.getElementById('new-job-model');
  const name = (nameInput ? nameInput.value : '').trim() || 'Untitled job';
  const model = modelInput ? modelInput.value : state.settings.model;

  const job = {
    id: (crypto.randomUUID && crypto.randomUUID()) || `job-${Date.now()}`,
    createdAt: Date.now(),
    name,
    model,
    fileName: state.draftFileName,
    status: 'draft',
    segments: [],
    progress: 0,
    error: '',
  };
  await saveJob(job, state.draftBlob);
  state.draftBlob = null;
  state.draftFileName = '';
  state.activeJobId = job.id;
  await renderJobView(job.id);
  startTranscription();
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

async function startTranscription() {
  const jobId = state.activeJobId;
  if (!jobId || state.transcription) return;
  const job = await getJob(jobId);
  if (!job) return;
  if (!state.settings.apiKey) {
    toast('Add your Gemini API key in Settings first.');
    renderJobView(jobId);
    return;
  }
  const audioBlob = await fetchAudioBlob(job);
  if (!audioBlob) {
    toast('This job has no audio to transcribe.');
    return;
  }

  state.transcription = { cancelled: false };
  job.status = 'processing';
  job.error = '';
  job.progress = 5;
  await updateJob(job);
  await renderJobView(jobId);

  try {
    setFfmpegLogger(() => {});
    const chunks = await splitAudioToChunks(audioBlob, CHUNK_SECONDS);
    if (state.transcription.cancelled) throw new Cancelled();
    if (!chunks.length) throw new Error('The audio could not be split into chunks.');

    const offsets = [];
    let acc = 0;
    for (const chunk of chunks) {
      offsets.push(acc);
      acc += await measureDuration(chunk.blob);
      if (state.transcription.cancelled) throw new Cancelled();
    }
    job.durationSec = acc;

    const total = chunks.length;
    const all = [];
    for (let i = 0; i < total; i++) {
      if (state.transcription.cancelled) throw new Cancelled();
      job.progress = Math.round((i / total) * 90);
      await updateJob(job);
      updateProgress(i, total);
      const segs = await transcribeChunkInBrowser(chunks[i].blob, state.settings.apiKey, job.model);
      if (state.transcription.cancelled) throw new Cancelled();
      const offset = offsets[i];
      for (const seg of segs) {
        all.push({
          speaker: seg.speaker,
          startTime: Math.max(0, seg.startTime + offset),
          endTime: Math.max(0, seg.endTime + offset),
          text: seg.text,
        });
      }
    }
    all.sort((a, b) => a.startTime - b.startTime);
    if (state.transcription.cancelled) throw new Cancelled();

    job.segments = all;
    job.status = 'done';
    job.progress = 100;
    state.transcription = null;
    await updateJob(job);
    toast('Transcription complete.');
    renderJobView(jobId);
  } catch (err) {
    state.transcription = null;
    if (err instanceof Cancelled) {
      job.status = 'draft';
      job.error = '';
      toast('Transcription cancelled.');
    } else {
      job.status = 'failed';
      job.error = err.message || 'Transcription failed';
      toast('Transcription failed.');
    }
    await updateJob(job);
    renderJobView(jobId);
  }
}

class Cancelled extends Error {
  constructor() {
    super('Transcription cancelled');
    this.name = 'Cancelled';
  }
}

function cancelTranscription() {
  if (state.transcription) state.transcription.cancelled = true;
}

function updateProgress(done, total) {
  const fill = document.querySelector('[data-progress]');
  const label = document.querySelector('[data-progress-label]');
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `Chunk ${Math.min(done + 1, total)} of ${total}`;
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
  const segments = Array.isArray(job.segments) ? job.segments : [];
  const isProcessing = job.status === 'processing';
  const hasSegments = segments.length > 0;
  const readyEmpty = !isProcessing && !hasSegments && job.status !== 'failed';

  const segHtml = segments
    .map(
      (seg) => `
      <button class="segment" data-action="seek" data-sec="${Number(seg.startTime || 0)}">
        <span class="segment-time">${formatTime(seg.startTime)} – ${formatTime(seg.endTime)}</span>
        <span class="segment-speaker">${esc(seg.speaker)}</span>
        <span class="segment-text">${esc(seg.text)}</span>
      </button>`,
    )
    .join('');

  const banner =
    job.status === 'failed'
      ? `<div class="status-banner error">${esc(job.error || 'Transcription failed')}</div>`
      : '';

  const processingUI = isProcessing
    ? `<div class="status-banner">
         <div style="flex:1"><div class="progress-track"><div class="progress-fill" data-progress style="width:${job.progress || 0}%"></div></div></div>
         <span data-progress-label>Preparing audio…</span>
       </div>`
    : '';

  const metaParts = [statusChip(job), esc(job.model)];
  if (hasSegments) metaParts.push(`${job.segments.length} segments`);
  if (job.durationSec) metaParts.push(`${formatTime(job.durationSec)} audio`);

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
          <p class="view-sub">Generated entirely in your browser.</p>
          <div class="export-grid">
            <button class="export-btn" data-action="export" data-format="txt" ${hasSegments ? '' : 'disabled'}>TXT</button>
            <button class="export-btn" data-action="export" data-format="srt" ${hasSegments ? '' : 'disabled'}>SRT</button>
            <button class="export-btn" data-action="export" data-format="json" ${hasSegments ? '' : 'disabled'}>JSON</button>
            <button class="export-btn" data-action="export" data-format="docx" ${hasSegments ? '' : 'disabled'}>DOCX</button>
            <button class="export-btn" data-action="export" data-format="pdf" ${hasSegments ? '' : 'disabled'}>PDF</button>
            <button class="export-btn" data-action="export" data-format="zip" ${hasSegments ? '' : 'disabled'}>ZIP</button>
          </div>
        </div>
        <div>
          <h3>Manage</h3>
          <div class="app-actions-row">
            <button class="app-btn-secondary" data-action="start-transcribe" title="Run the model over the audio again">Transcribe</button>
            <button class="app-btn-secondary" data-action="delete-job" data-id="${esc(job.id)}">Delete</button>
          </div>
        </div>
      </div>
      <div class="detail-main">
        ${readyEmpty ? `
          <div class="empty-state">
            <h3>Ready to transcribe</h3>
            <p>Generate speaker-aware segments with the Gemini API.</p>
            <p style="margin-top:1rem"><button class="btn-primary" data-action="start-transcribe">Start transcription</button></p>
          </div>` : ''}
        ${hasSegments ? `<div class="segments-list">${segHtml}</div>` : ''}
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
    document.querySelectorAll('.segment').forEach((el, j) => el.classList.toggle('active', j === active));
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
  toast('Deleted.');
  renderDashboard();
}

async function handleExport(format) {
  const job = await getJob(state.activeJobId);
  if (!job || !Array.isArray(job.segments) || !job.segments.length) {
    toast('Nothing to export yet.');
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
  toast('Settings saved.');
  renderDashboard();
}

async function init() {
  const stored = await getSettings();
  state.settings = { apiKey: stored.apiKey || '', model: stored.model || MODELS[1].id };

  const jobs = await listJobs();
  for (const job of jobs) {
    if (job.status === 'processing') {
      job.status = 'draft';
      job.error = 'Previous transcription was interrupted. You can start it again.';
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
    case 'open-job':
      renderJobView(target.dataset.id);
      break;
    case 'delete-job':
      deleteJobAction(target.dataset.id);
      break;
    case 'clear-file':
      state.draftBlob = null;
      state.draftFileName = '';
      renderNewView();
      break;
    case 'choose-file':
      fileInput.click();
      break;
    case 'toggle-record':
      toggleRecording();
      break;
    case 'start-transcribe':
      startTranscription();
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
    createJob();
  }
});

dialogEl.addEventListener('click', async (e) => {
  if (e.target.closest('[data-dialog-save]')) {
    await saveSettingsDialog();
  }
});

init();