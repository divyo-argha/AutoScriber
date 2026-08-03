import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (jobId) {
      const job = await db.transcriptionJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(job);
    }

    // List all jobs
    const jobs = await db.transcriptionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

/**
 * Control an in-flight transcription job: pause, resume, or cancel.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body || {};

    if (!id || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request. Expected { id, action } with action in pause|resume|cancel.' }, { status: 400 });
    }

    const job = await db.transcriptionJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!['pending', 'uploading', 'chunking', 'processing'].includes(job.status)) {
      return NextResponse.json({ error: `Cannot ${action} a job that is already "${job.status}"` }, { status: 400 });
    }

    const controlStatus =
      action === 'pause' ? 'paused' :
      action === 'resume' ? 'running' :
      'cancel_requested';

    const updated = await db.transcriptionJob.update({
      where: { id },
      data: { controlStatus },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error controlling job:', err);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await db.transcriptionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Delete associated audio file
    if (job.audioPath) {
      try {
        if (fs.existsSync(job.audioPath)) {
          fs.unlinkSync(job.audioPath);
        }
      } catch (err) {
        console.error('Failed to delete audio file:', err);
      }
    }

    // Delete the job from database
    await db.transcriptionJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting job:', err);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
