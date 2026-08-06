# AutoScribe Desktop App — Installation Guide

## Installation

### 🍎 macOS

1. Download the appropriate DMG for your Mac (Intel or Apple Silicon)
2. Open the DMG → drag **AutoScribe** to **Applications**
3. **First launch:** Right-click the app → **Open** (required because the app is not code-signed)
4. Click **Open** in the security dialog

### 🪟 Windows

1. Download the installer (`.exe`)
2. Run the installer
3. If Windows Defender shows a warning, click **More info** → **Run anyway**
4. Follow the installation wizard
5. Launch AutoScribe from the Start Menu or Desktop shortcut

### 🐧 Linux

1. Download the AppImage
2. Make it executable:
   ```bash
   chmod +x autoScriber-2.0.1.AppImage
   ```
3. Run:
   ```bash
   ./autoScriber-2.0.1.AppImage
   ```
4. *(Optional)* Move to `/usr/local/bin` for system-wide access

---

## What the Desktop App Does

The AutoScribe desktop app bundles the full Next.js web application inside an Electron window. It runs a local server on port 3000 and opens it in a dedicated native window.

- ✅ Native desktop experience — no browser required
- ✅ Persistent local SQLite database (survives app updates)
- ✅ Microphone access via Electron permissions
- ✅ Cross-platform: macOS, Windows, Linux

---

## First Launch

1. The app starts a local server and loads the AutoScribe interface
2. Open **Settings** (gear icon ⚙️) and configure:
   - **Gemini API Key** — get one free at https://aistudio.google.com/app/apikey
   - Or set **Ollama URL** for fully local/offline processing
3. Start transcribing!

---

## Using AutoScribe

### Upload Audio
- Click the upload area or drag & drop audio files
- Supported: MP3, WAV, M4A, WEBM, OGG, FLAC
- No file size limit

### Settings (gear icon ⚙️)
| Setting | Default | Description |
|---------|---------|-------------|
| Gemini API Key | — | Your Google AI Studio key |
| Gemini Base URL | — | Optional proxy |
| Default Model | `gemini-2.0-flash` | AI model |
| Chunk Duration | 300 s | Audio chunk size |
| Overlap Duration | 10 s | Overlap between chunks |
| Ollama URL | `http://localhost:11434` | Local Ollama server |

### Transcribe
1. Upload an audio file
2. Select language (Bangla / English / Mixed)
3. Click **Start Transcription**
4. Watch real-time progress
5. View and interact with results in the viewer

### Export Formats
| Format | Contents |
|--------|----------|
| TXT | Plain text transcript |
| SRT | Subtitle file with timestamps |
| JSON | Full structured data (segments, speakers, words) |
| DOCX | Formatted Word document |
| PDF | Printable PDF |
| ZIP | All formats bundled |

---

## Troubleshooting

### macOS: "App can't be opened because it is from an unidentified developer"
**Solution:** Right-click the app → **Open** → click **Open** in the dialog

### Windows: "Windows protected your PC"
**Solution:** Click **More info** → **Run anyway**

### Linux: "Permission denied"
**Solution:** `chmod +x autoScriber-2.0.1.AppImage`

### App won't start / blank screen
1. Wait 10–15 seconds — the bundled server takes a moment to start
2. Check that port 3000 is not in use by another process
3. Restart the app

### Transcription fails
1. Verify your Gemini API key in Settings
2. Check your internet connection (required for Gemini; Ollama works offline)
3. Ensure **FFmpeg** is installed:
   - macOS: `brew install ffmpeg`
   - Windows: download from https://ffmpeg.org
   - Linux: `sudo apt install ffmpeg`

---

## Data Storage

All data is stored locally on your machine:

| What | Where |
|------|-------|
| Audio files | `userData/audio/` (OS app data dir) |
| Database | `userData/dev.db` (SQLite) |
| Settings | Stored in SQLite `AppSettings` table |

No data is sent to any cloud storage. The only network requests are to the AI model API you configure.

---

## Updating

1. Download the latest release
2. Install over the existing version
3. Your database and settings are preserved (stored in the OS user data directory, not the app bundle)

---

## Uninstalling

### macOS
1. Drag **AutoScribe** from Applications to Trash
2. *(Optional)* Delete app data: `~/Library/Application Support/autoScriber`

### Windows
1. **Add or Remove Programs** → **autoScriber** → Uninstall
2. *(Optional)* Delete app data: `%APPDATA%\autoScriber`

### Linux
1. Delete the AppImage file
2. *(Optional)* Delete app data: `~/.config/autoScriber`

---

**Enjoy transcribing with AutoScribe! 🎙️**
