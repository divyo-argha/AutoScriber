/**
 * Script to fix malformed transcription data in the database
 * 
 * This script:
 * 1. Reads all transcription jobs from the database
 * 2. Parses and validates the result JSON
 * 3. Fixes any malformed text or data
 * 4. Updates the database with cleaned data
 * 
 * Run with: npx tsx scripts/fix-transcriptions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TranscriptionSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  duration: number;
  language: string;
  model: string;
}

function cleanText(text: string): string {
  if (!text) return '';
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Fix common encoding issues
  text = text.replace(/â€™/g, "'");
  text = text.replace(/â€œ/g, '"');
  text = text.replace(/â€/g, '"');
  text = text.replace(/â€"/g, '—');
  
  return text;
}

function validateAndFixSegment(segment: any): TranscriptionSegment | null {
  try {
    // Ensure required fields exist
    if (!segment || typeof segment !== 'object') {
      console.warn('Invalid segment object:', segment);
      return null;
    }
    
    const speaker = segment.speaker || 'Unknown Speaker';
    const text = cleanText(segment.text || '');
    const startTime = typeof segment.startTime === 'number' ? segment.startTime : 0;
    const endTime = typeof segment.endTime === 'number' ? segment.endTime : startTime + 1;
    
    // Skip empty segments
    if (!text) {
      console.warn('Empty text in segment, skipping');
      return null;
    }
    
    return {
      speaker,
      text,
      startTime,
      endTime,
    };
  } catch (err) {
    console.error('Error validating segment:', err);
    return null;
  }
}

function validateAndFixResult(resultStr: string): string | null {
  try {
    const result: TranscriptionResult = JSON.parse(resultStr);
    
    if (!result || typeof result !== 'object') {
      console.error('Invalid result object');
      return null;
    }
    
    if (!Array.isArray(result.segments)) {
      console.error('Segments is not an array');
      return null;
    }
    
    // Fix each segment
    const fixedSegments: TranscriptionSegment[] = [];
    for (const segment of result.segments) {
      const fixed = validateAndFixSegment(segment);
      if (fixed) {
        fixedSegments.push(fixed);
      }
    }
    
    if (fixedSegments.length === 0) {
      console.error('No valid segments after fixing');
      return null;
    }
    
    // Rebuild fullText from fixed segments
    const fullText = fixedSegments
      .map(seg => `[${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}] ${seg.speaker}: ${seg.text}`)
      .join('\n');
    
    const fixedResult: TranscriptionResult = {
      segments: fixedSegments,
      fullText,
      duration: result.duration || 0,
      language: result.language || 'bn',
      model: result.model || 'unknown',
    };
    
    return JSON.stringify(fixedResult);
  } catch (err) {
    console.error('Error parsing result JSON:', err);
    return null;
  }
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '00:00.000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

async function main() {
  console.log('🔍 Scanning database for transcription jobs...\n');
  
  const jobs = await prisma.transcriptionJob.findMany({
    where: {
      status: 'completed',
      result: { not: null },
    },
  });
  
  console.log(`Found ${jobs.length} completed jobs\n`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const job of jobs) {
    console.log(`\n📄 Processing job: ${job.id}`);
    console.log(`   File: ${job.fileName}`);
    
    if (!job.result) {
      console.log('   ⚠️  No result data, skipping');
      continue;
    }
    
    try {
      // Try to parse the existing result
      const parsed = JSON.parse(job.result);
      console.log(`   ✓ Valid JSON with ${parsed.segments?.length || 0} segments`);
      
      // Validate and fix
      const fixed = validateAndFixResult(job.result);
      
      if (!fixed) {
        console.log('   ❌ Could not fix result');
        errorCount++;
        continue;
      }
      
      // Check if anything changed
      if (fixed !== job.result) {
        console.log('   🔧 Fixing malformed data...');
        
        await prisma.transcriptionJob.update({
          where: { id: job.id },
          data: { result: fixed },
        });
        
        console.log('   ✅ Fixed and updated');
        fixedCount++;
      } else {
        console.log('   ✓ Already valid, no changes needed');
      }
    } catch (err) {
      console.log('   ❌ Error processing:', err instanceof Error ? err.message : String(err));
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Total jobs: ${jobs.length}`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Already valid: ${jobs.length - fixedCount - errorCount}`);
  console.log('='.repeat(50) + '\n');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
