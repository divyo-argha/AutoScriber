# Multi-Source Audio Upload Implementation

## Features Implemented

### 1. ZIP File Upload
- Extract audio files recursively from ZIP archives
- Automatically discovers all audio files in nested folders
- Validates file types and sizes

### 2. Folder Upload
- Native folder selection via `<input type="directory">`
- Recursively scans for audio files
- Supports nested directory structures

### 3. Google Drive Integration
- OAuth 2.0 authentication
- List audio files from Google Drive
- Multi-select file picker
- Download selected files directly

## Files Created/Modified

### New Files
- `src/lib/file-utils.ts` - ZIP extraction and folder scanning utilities
- `src/lib/google-drive.ts` - Google Drive OAuth and API integration

### Modified Files
- `src/components/app/upload-area.tsx` - Added 5 tabs (Upload, ZIP, Folder, Drive, Record)
- `src/app/layout.tsx` - Added Google API script
- `.env.local` - Added NEXT_PUBLIC_GOOGLE_CLIENT_ID placeholder

## Setup Instructions

### For Google Drive Integration
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs: `http://localhost:3000`
6. Copy Client ID to `.env.local`:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
   ```

## Architecture

### File Discovery
- `isAudioFile()` - Checks file extension against supported formats
- `extractAudioFilesFromZip()` - Recursively extracts audio from ZIP
- `extractAudioFilesFromDirectory()` - Recursively scans folder for audio

### Google Drive
- `initGoogleAuth()` - Initializes Google Auth2
- `signInWithGoogle()` - OAuth sign-in flow
- `listDriveAudioFiles()` - Lists audio files in Drive
- `downloadDriveFile()` - Downloads file from Drive

### UI
- 5-tab interface: Upload, ZIP, Folder, Drive, Record
- Responsive design with mobile-friendly tab labels
- Multi-select for Drive files
- Progress indicators for async operations

## Supported Audio Formats
- MP3, WAV, OGG, FLAC, M4A, WEBM, AAC, WMA

## Workflow
1. User selects source (Upload, ZIP, Folder, or Drive)
2. Files are discovered/extracted recursively
3. Audio files are validated and added to pending queue
4. User can add more files or start batch transcription
5. All files are processed sequentially in batch view

## Notes
- ZIP extraction uses JSZip (already installed)
- Folder upload uses FileSystem API (browser native)
- Google Drive uses official Google APIs
- All file discovery is recursive to handle nested structures
- No server-side file processing needed for ZIP/Folder
