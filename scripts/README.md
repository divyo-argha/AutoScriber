# Database Maintenance Scripts

## `fix-transcriptions.ts`

Scans all completed transcription jobs and repairs malformed result data in the database.

### What it fixes

| Issue | Action |
|-------|--------|
| Excessive whitespace | Collapses multiple spaces to one |
| Encoding problems | Corrects common UTF-8 issues |
| Missing fields | Adds default values for missing speaker / timestamps |
| Empty segments | Removes segments with no text |
| Malformed JSON | Attempts structural repair |
| Incorrect `fullText` | Rebuilds from cleaned segments |

### How to run

```bash
cd AutoScriber

# Using bun (recommended)
bunx tsx scripts/fix-transcriptions.ts

# Or with npx
npx tsx scripts/fix-transcriptions.ts
```

### Example output

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

### When to run

- After importing old transcriptions
- If the UI shows raw JSON instead of formatted text
- After database migrations
- When segments appear malformed

### Troubleshooting

**`Cannot find module '@prisma/client'`**
```bash
cd AutoScriber
bun install
bun run db:generate
```

**`Database connection failed`**
- Ensure `prisma/dev.db` exists
- Run `bun run db:push` to initialise the schema

**`Permission denied`**
```bash
chmod +x scripts/fix-transcriptions.ts
```
