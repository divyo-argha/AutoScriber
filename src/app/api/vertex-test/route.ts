import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { testVertexConnection } from '@/lib/transcriber/vertex';
import { getGcpCredentialsInfo } from '@/lib/transcriber/gcp-credentials';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await db.appSettings.findUnique({ where: { id: 'default' } });

    const credentialsPath = body.gcpCredentialsPath || settings?.gcpCredentialsPath;
    const location = body.gcpLocation || settings?.gcpLocation || 'us-central1';
    const projectId = body.gcpProjectId || settings?.gcpProjectId;

    const credsInfo = getGcpCredentialsInfo(credentialsPath, location);

    if (!credsInfo.exists && !projectId && !process.env.GCP_PROJECT_ID) {
      return NextResponse.json(
        {
          success: false,
          error: 'No GCP credentials file (gcp-credentials.json) or GCP project ID detected.',
        },
        { status: 400 }
      );
    }

    const testResult = await testVertexConnection({
      projectId: projectId || credsInfo.projectId,
      location,
      credentialsPath: credentialsPath || credsInfo.filePath,
    });

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully connected to Vertex AI! (Project: ${testResult.projectId}, Region: ${testResult.location})`,
        projectId: testResult.projectId,
        location: testResult.location,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: testResult.error || 'Failed to connect to Vertex AI.',
          projectId: testResult.projectId,
          location: testResult.location,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Vertex test error: ${err?.message || String(err)}`,
      },
      { status: 500 }
    );
  }
}
