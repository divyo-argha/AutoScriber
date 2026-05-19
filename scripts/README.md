# Database Maintenance Scripts

## Fix Transcriptions Script

This script fixes malformed transcription data in your database.

### What it does:

1. ✅ Scans all completed transcription jobs
2. ✅ Validates JSON structure
3. ✅ Cleans up text (removes extra whitespace, fixes encoding)
4. ✅ Validates segment data (speaker, text, timestamps)
5. ✅ Removes empty or invalid segments
6. ✅ Rebuilds fullText from cleaned segments
7. ✅ Updates database with fixed data

### How to run:

```bash
# Install tsx if you haven't already
npm install -g tsx

# Run the script
npx tsx scripts/fix-transcriptions.ts
```

### What gets fixed:

- **Excessive whitespace**: Multiple spaces reduced to single space
- **Encoding issues**: Common UTF-8 encoding problems
- **Missing fields**: Adds default values for missing speaker/timestamps
- **Empty segments**: Removes segments with no text
- **Invalid JSON**: Attempts to repair malformed JSON structures

### Example output:

```
🔍 Scanning database for transcription jobs...

Found 5 completed jobs

📄 Processing job: clxyz123
   File: interview.mp3
   ✓ Valid JSON with 45 segments
   🔧 Fixing malformed data...
   ✅ Fixed and updated

📄 Processing job: clxyz456
   File: meeting.aac
   ✓ Valid JSON with 120 segments
   ✓ Already valid, no changes needed

==================================================
📊 Summary:
   Total jobs: 5
   Fixed: 2
   Errors: 0
   Already valid: 3
==================================================
```

### Safety:

- ✅ Only updates jobs that need fixing
- ✅ Validates data before updating
- ✅ Logs all changes
- ✅ Non-destructive (keeps original data structure)

### When to run:

- After importing old transcriptions
- If you see raw JSON in the UI
- After database migrations
- When segments appear malformed

### Troubleshooting:

**Error: Cannot find module '@prisma/client'**
```bash
npm install
npx prisma generate
```

**Error: Database connection failed**
- Check that `prisma/dev.db` exists
- Run `npx prisma migrate dev` if needed

**Error: Permission denied**
```bash
chmod +x scripts/fix-transcriptions.ts
```
