# autoScriber Website & Web App — Master Execution Blueprint

This document contains the complete, step-by-step architectural blueprint to overhaul the autoScriber hosted web project (`AutoScriber/website/`). It covers:
1. **Part A:** Restructuring & fixing the Vercel landing page with genuine information, light/dark theme toggle, modular CSS, and zero bluffing.
2. **Part B:** Building the zero-backend, browser-native web application (`/app`) using IndexedDB, WebAssembly FFmpeg, and direct client-side Gemini API calls.

---

## 🎯 Executive Summary & Guiding Principles

1. **Zero Bluffing / 100% Genuine Information**:
   - **Remove Soniox**: Not in the codebase.
   - **Remove Homebrew (`brew install --cask autoscriber`)**: Package does not exist in homebrew repository.
   - **Remove Winget (`winget install autoScriber`)**: Package does not exist in winget registry.
   - **Fix Model Count**: 6 Gemini AI models (2.5 Pro, 2.5 Flash, 2.5 Flash-Lite, 2.0 Flash, 1.5 Flash, 1.5 Pro). Differentiate Gemini API (Google AI Studio) vs. Google Cloud Vertex AI.
   - **Fix Version & Dates**: Version 2.0.1, Date: August 2026.

2. **UI & Code Quality Standards**:
   - **Light / Dark Mode System**: Fully tokenized CSS variables with system preference auto-detection + persistent manual toggle button.
   - **No Inline Styles & No Raw Emojis**: Clean SVG icons only (Lucide/Heroicons SVG paths).
   - **Modular Component Design**: CSS Modules / Scoped `.module.css` patterns with clean separation of layout, tokens, and components.
   - **Maximum Reusability**: Componentized UI blocks (buttons, badges, model cards, download cards, modal views).

---

## 📁 Repository Structure Target

```
AutoScribe/
└── AutoScriber/
    └── website/
        ├── vercel.json                 # Routing rules (/app -> /app/index.html, / -> /index.html)
        ├── assets/
        │   ├── logo.png
        │   └── favicon.ico
        ├── css/
        │   ├── tokens.css              # Design tokens (light & dark mode variables)
        │   ├── reset.css               # Base CSS reset
        │   └── global.css              # Global typography & layout rules
        ├── components/                 # Modular components for landing page
        │   ├── nav/
        │   │   ├── nav.html
        │   │   ├── nav.module.css
        │   │   └── nav.js
        │   ├── hero/
        │   │   ├── hero.html
        │   │   └── hero.module.css
        │   ├── features/
        │   │   ├── features.html
        │   │   └── features.module.css
        │   ├── models/
        │   │   ├── models.html
        │   │   └── models.module.css
        │   ├── pipeline/               # "How It Works" architecture
        │   │   ├── pipeline.html
        │   │   └── pipeline.module.css
        │   ├── download/
        │   │   ├── download.html
        │   │   ├── download.module.css
        │   │   └── download.js
        │   ├── about/
        │   │   ├── about.html
        │   │   └── about.module.css
        │   └── footer/
        │       ├── footer.html
        │       └── footer.module.css
        ├── js/
        │   ├── theme.js                # Theme switcher (Light/Dark mode)
        │   ├── os-detect.js            # Precise platform detection & download router
        │   └── main.js                 # App loader & IntersectionObserver initialization
        └── app/                        # Browser-Native App (No-Backend Studio)
            ├── index.html
            ├── css/
            │   └── app.module.css
            └── js/
                ├── db.js               # IndexedDB wrapper (jobs, settings, audio blobs)
                ├── ffmpeg-worker.js    # WebAssembly FFmpeg chunker integration
                ├── gemini-client.js    # Client-side Gemini API transcriber
                ├── exporter.js         # Client-side TXT, SRT, JSON, DOCX, PDF, ZIP generation
                └── app-main.js         # React / Vanilla SPA entry point
```

---

## 🎨 PART A: LANDING PAGE OVERHAUL PLAN

### 1. Tokenized Design System & Dual Theme (`tokens.css`)

```css
:root {
  /* Brand Tokens */
  --brand-teal: #00C9A7;
  --brand-blue: #0077B6;
  --grad-primary: linear-gradient(135deg, var(--brand-teal), var(--brand-blue));

  /* Dark Theme Defaults */
  --bg-main: #080d14;
  --bg-surface: #0d1520;
  --bg-raised: #111c2a;
  --bg-glass: rgba(255, 255, 255, 0.04);
  --border-color: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(0, 201, 167, 0.3);

  --text-main: #e8f0fe;
  --text-muted: #7a8fa6;
  --text-inverse: #080d14;

  --shadow-subtle: 0 4px 20px rgba(0, 0, 0, 0.25);
  --shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 32px rgba(0, 201, 167, 0.2);

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 9999px;

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

[data-theme="light"] {
  --bg-main: #f8fafc;
  --bg-surface: #ffffff;
  --bg-raised: #f1f5f9;
  --bg-glass: rgba(0, 0, 0, 0.03);
  --border-color: rgba(0, 0, 0, 0.08);
  --border-hover: rgba(0, 201, 167, 0.4);

  --text-main: #0f172a;
  --text-muted: #64748b;
  --text-inverse: #ffffff;

  --shadow-subtle: 0 4px 20px rgba(0, 0, 0, 0.06);
  --shadow-elevated: 0 16px 48px rgba(15, 23, 42, 0.12);
  --shadow-glow: 0 0 32px rgba(0, 201, 167, 0.15);
}
```

### 2. Theme Toggle Controller (`js/theme.js`)

```javascript
export function initTheme() {
  const storedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');

  setTheme(initialTheme);

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="toggle-theme"]')) {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    }
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const iconContainer = document.querySelector('#theme-toggle-icon');
  if (!iconContainer) return;
  // Inline SVG Sun for dark mode, Moon for light mode
  iconContainer.innerHTML = theme === 'dark'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}
```

### 3. Content Corrections & Genuine Information Matrix

| Section | Old Content (Remove / Fix) | Corrected Genuine Content |
|---|---|---|
| **Hero Description** | "Gemini & Soniox" | "Google Gemini 2.5/2.0 API & Google Cloud Vertex AI support" |
| **Features Card** | "Soniox for native Bangla STT" | **Vertex AI Enterprise Support**: Use GCP Service Account credentials for secure high-scale inference |
| **Features Card** | Generic overview | **Job Control**: Pause, Resume, and Cancel transcription jobs in real time |
| **Features Card** | Generic overview | **Batch Queueing**: Queue multiple files simultaneously with individual progress tracking |
| **Features Card** | Generic overview | **Browser Recording**: Record high-quality audio directly via microphone without file uploads |
| **Download macOS** | `brew install --cask autoscriber` | Direct DMG & ZIP downloads for Apple Silicon (arm64) and Intel (x64) |
| **Download Windows**| `winget install autoScriber` | Direct NSIS Universal Installer (.exe), 64-bit standalone installer, and Portable Edition |
| **Download Linux**  | Generic Linux notes | AppImage executable (universal Linux support across Ubuntu, Debian, Fedora, Arch) |
| **Models Grid** | "5 AI Models" (Vague) | **6 Verified Models**: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro |
| **Version & Date** | Version 1.0.0 / May 2026 | Version 2.0.1 / August 2026 |

---

## 🌐 PART B: BROWSER-NATIVE WEB APPLICATION (`/app`)

### 1. High-Level Architecture (Zero-Backend SPA)

The `/app` endpoint hosted on Vercel acts as a full-fledged client-side workstation. It requires **no backend server, no database server, and no user authentication**. All audio processing, storage, and API integration happen inside the client's browser using standard modern browser APIs.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER APPLICATION SPA                         │
│                                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │   Microphone / File  │  │ IndexedDB Database   │  │ LocalStorage │  │
│  │     Media Capture    │  │ (Audio, Jobs, State) │  │  (API Keys)  │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────┬───────┘  │
│             │                         │                     │          │
│             ▼                         ▼                     │          │
│  ┌──────────────────────────────────────────────────────┐   │          │
│  │            WebAssembly FFmpeg Audio Chunker          │   │          │
│  │      (Splits long audio into overlapping segments)   │   │          │
│  └──────────────────────────┬───────────────────────────┘   │          │
│                             │                               │          │
│                             ▼                               ▼          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │               Client-Side Gemini API Engine                  │      │
│  │        (Direct HTTPS fetch to Google AI Studio API)          │      │
│  └──────────────────────────┬───────────────────────────────────┘      │
│                             │                                          │
│                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              Interactive Viewer & Audio Sync                 │      │
│  │    (Word-level highlighting, playback speed, speaker editor) │      │
│  └──────────────────────────┬───────────────────────────────────┘      │
│                             │                                          │
│                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │               Pure Client-Side Exporter                      │      │
│  │         (Generates TXT, SRT, JSON, DOCX, PDF, ZIP)           │      │
│  └──────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Client-Side Database Engine (`js/db.js`)

Using browser `IndexedDB` to handle persistent storage without any remote database:

```javascript
import { openDB } from 'idb';

const DB_NAME = 'autoScriber_ClientDB';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('jobs')) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
        jobStore.createIndex('createdAt', 'createdAt');
        jobStore.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('audioBlobs')) {
        db.createObjectStore('audioBlobs', { keyPath: 'jobId' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });
}

export async function saveJob(job, audioBlob = null) {
  const db = await getDB();
  await db.put('jobs', job);
  if (audioBlob) {
    await db.put('audioBlobs', { jobId: job.id, blob: audioBlob });
  }
}

export async function getJob(jobId) {
  const db = await getDB();
  const job = await db.get('jobs', jobId);
  if (job) {
    const audioRecord = await db.get('audioBlobs', jobId);
    if (audioRecord) {
      job.audioUrl = URL.createObjectURL(audioRecord.blob);
    }
  }
  return job;
}
```

### 3. Client-Side WebAssembly Audio Chunker (`js/ffmpeg-worker.js`)

Using `@ffmpeg/ffmpeg` WASM to split long audio files directly inside browser memory:

```javascript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;

export async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  await ffmpeg.load();
  return ffmpeg;
}

export async function chunkAudioInBrowser(file, chunkDurationSeconds = 300) {
  const instance = await loadFFmpeg();
  const inputName = 'input_audio' + file.name.substring(file.name.lastIndexOf('.'));
  
  await instance.writeFile(inputName, await fetchFile(file));

  const segmentPattern = 'chunk_%03d.mp3';
  await instance.exec([
    '-i', inputName,
    '-f', 'segment',
    '-segment_time', chunkDurationSeconds.toString(),
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    segmentPattern
  ]);

  const files = await instance.readdir('.');
  const chunkFiles = files.filter(f => f.name.startsWith('chunk_') && f.name.endsWith('.mp3'));
  
  const chunks = [];
  for (const cFile of chunkFiles) {
    const data = await instance.readFile(cFile.name);
    const blob = new Blob([data.buffer], { type: 'audio/mp3' });
    chunks.push(blob);
    await instance.deleteFile(cFile.name);
  }

  await instance.deleteFile(inputName);
  return chunks;
}
```

### 4. Client-Side Gemini Transcriber (`js/gemini-client.js`)

Direct REST call from browser to Google AI Studio Gemini API (`generativelanguage.googleapis.com`):

```javascript
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function transcribeChunkInBrowser(audioBlob, apiKey, modelId = 'gemini-2.0-flash') {
  const base64Audio = await blobToBase64(audioBlob);
  
  const prompt = `You are an elite, highly detailed Bangla-English speech transcription and speaker diarization engine. Your ONLY job is to output a valid JSON array of transcribed speech segments.

OUTPUT FORMAT (JSON ARRAY ONLY):
[
  {"speaker": "Speaker 1", "startTime": 0.0, "endTime": 5.2, "text": "আমি মনে করি এই বিষয়ে আমাদের কথা বলা দরকার।"},
  {"speaker": "Speaker 2", "startTime": 5.5, "endTime": 10.1, "text": "হ্যাঁ, I completely agree with you."}
]`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'audio/mp3',
              data: base64Audio
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(`${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Gemini API call failed');
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawText);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = result.substring(result.indexOf(',') + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### 5. Pure Client-Side Document Exporter (`js/exporter.js`)

Generating export files dynamically in browser memory without server endpoints:

```javascript
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

export async function exportTranscript(result, format = 'txt', fileName = 'transcript') {
  switch (format) {
    case 'txt': {
      const content = result.segments
        .map(s => `[${formatTime(s.startTime)} - ${formatTime(s.endTime)}] ${s.speaker}: ${s.text}`)
        .join('\n\n');
      downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${fileName}.txt`);
      break;
    }
    case 'srt': {
      const content = result.segments
        .map((s, idx) => `${idx + 1}\n${formatSrtTime(s.startTime)} --> ${formatSrtTime(s.endTime)}\n${s.speaker}: ${s.text}\n`)
        .join('\n');
      downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${fileName}.srt`);
      break;
    }
    case 'json': {
      const content = JSON.stringify(result, null, 2);
      downloadBlob(new Blob([content], { type: 'application/json' }), `${fileName}.json`);
      break;
    }
    case 'docx': {
      const doc = new Document({
        sections: [{
          children: result.segments.map(s => 
            new Paragraph({
              children: [
                new TextRun({ text: `[${formatTime(s.startTime)}] ${s.speaker}: `, bold: true }),
                new TextRun({ text: s.text })
              ]
            })
          ]
        }]
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${fileName}.docx`);
      break;
    }
    case 'pdf': {
      const doc = new jsPDF();
      let y = 10;
      result.segments.forEach(s => {
        if (y > 280) { doc.addPage(); y = 10; }
        doc.setFontSize(10);
        doc.text(`[${formatTime(s.startTime)}] ${s.speaker}: ${s.text}`, 10, y);
        y += 8;
      });
      doc.save(`${fileName}.pdf`);
      break;
    }
    case 'zip': {
      const zip = new JSZip();
      zip.file(`${fileName}.txt`, result.segments.map(s => `${s.speaker}: ${s.text}`).join('\n'));
      zip.file(`${fileName}.json`, JSON.stringify(result, null, 2));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${fileName}.zip`);
      break;
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatSrtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}
```

---

## 🚀 Step-by-Step Execution Sequence

1. **Step 1 — Landing Page Cleanup**: Replace non-existent claims (Soniox, Homebrew, Winget) with verified facts.
2. **Step 2 — Design System & Theme Engine**: Create `tokens.css` and `theme.js` to implement seamless Light/Dark mode switching using clean SVG icons.
3. **Step 3 — Landing Page Modularization**: Break `index.html` into scoped `.module.css` components (`nav`, `hero`, `features`, `models`, `pipeline`, `download`, `about`, `footer`).
4. **Step 4 — Vercel Route Configuration**: Update `vercel.json` to handle routing for `/app`.
5. **Step 5 — Browser App Engine (`/app`)**: Create the client-side workstation powered by `IndexedDB`, `@ffmpeg/ffmpeg` WebAssembly, and direct Gemini API requests.
