# AutoScribe Desktop App - Quick Start Guide

## Installation

### macOS
1. Download the appropriate DMG or ZIP for your Mac (Intel or Apple Silicon)
2. Open the DMG and drag AutoScribe to Applications, or extract the ZIP
3. **Important:** On first launch, right-click the app and select "Open" (required because the app is not code-signed)
4. Click "Open" in the security dialog

### Windows
1. Download the installer (.exe file)
2. Run the installer
3. If Windows Defender shows a warning, click "More info" → "Run anyway"
4. Follow the installation wizard
5. Launch AutoScribe from the Start Menu or Desktop shortcut

### Linux
1. Download the AppImage file
2. Make it executable:
   ```bash
   chmod +x AutoScribe-1.0.0.AppImage
   ```
3. Run the app:
   ```bash
   ./AutoScribe-1.0.0.AppImage
   ```
4. (Optional) Move to `/usr/local/bin` for system-wide access

## What the Desktop App Does

The AutoScribe desktop app is a **lightweight wrapper** that opens the AutoScribe web application in a dedicated window. It provides:

- ✅ Native desktop experience
- ✅ Standalone window (no browser tabs)
- ✅ System tray integration
- ✅ Offline-ready (once loaded)
- ✅ Cross-platform consistency

## First Launch

When you first open AutoScribe:

1. The app will load the AutoScribe web interface
2. You'll need to configure your settings:
   - Add your **Gemini API Key** (get one free at https://aistudio.google.com/app/apikey)
   - Or configure **Ollama** for local processing
3. Start transcribing!

## Using AutoScribe

### Upload Audio
1. Click the upload area or drag & drop audio files
2. Supported formats: MP3, WAV, M4A, WEBM, OGG, FLAC
3. No file size limit

### Configure Settings
- Click the gear icon (⚙️) in the header
- Set your API key
- Choose your preferred AI model
- Adjust chunk size and overlap if needed

### Transcribe
1. Upload your audio file
2. Select the language (Bangla/English/Mixed)
3. Click "Start Transcription"
4. Watch real-time progress
5. View results in the interactive viewer

### Export Results
- TXT (plain text)
- SRT (subtitles)
- JSON (structured data)
- DOCX (Word document)
- PDF (printable)
- ZIP (all formats)

## Troubleshooting

### macOS: "App can't be opened because it is from an unidentified developer"
**Solution:** Right-click the app → Open → Click "Open" in the dialog

### Windows: "Windows protected your PC"
**Solution:** Click "More info" → "Run anyway"

### Linux: "Permission denied"
**Solution:** Make the AppImage executable: `chmod +x AutoScribe-1.0.0.AppImage`

### App won't start
1. Check if you have an active internet connection (required for first load)
2. Try restarting your computer
3. Check if port 3000 is available (the app runs a local server)

### Transcription fails
1. Verify your Gemini API key is correct
2. Check your internet connection
3. Ensure FFmpeg is installed (required for audio processing)
   - macOS: `brew install ffmpeg`
   - Windows: Download from https://ffmpeg.org
   - Linux: `sudo apt install ffmpeg`

## Data Storage

All your data is stored locally:
- **Audio files:** `data/audio/` in the app directory
- **Database:** `prisma/dev.db` (SQLite)
- **No cloud storage** - everything stays on your machine

## Updating

To update to a new version:
1. Download the latest release
2. Install over the existing version
3. Your data and settings will be preserved

## Uninstalling

### macOS
1. Drag AutoScribe from Applications to Trash
2. (Optional) Delete data: `~/Library/Application Support/AutoScribe`

### Windows
1. Use "Add or Remove Programs" in Windows Settings
2. (Optional) Delete data: `%APPDATA%\AutoScribe`

### Linux
1. Delete the AppImage file
2. (Optional) Delete data: `~/.config/AutoScribe`

## Need Help?

- Check the main README for detailed documentation
- Review the RELEASES.md file for version-specific information
- Report issues on the GitHub repository

---

**Enjoy transcribing with AutoScribe! 🎙️**
