import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
      take: 50,
    });
    
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
