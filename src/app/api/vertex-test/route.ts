import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { testVertexConnection } from '@/lib/transcriber/vertex';
import { getGcpCredentialsInfo, getGcpCredentialsInfoFromJson, validateGcpCredentialsJson } from '@/lib/transcriber/gcp-credentials';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await db.appSettings.findUnique({ where: { id: 'default' } });

    const location = body.gcpLocation || settings?.gcpLocation || 'us-central1';
    const modelId = body.modelId || body.gcpModelId || 'gemini-2.5-flash';

    // Pasted JSON takes precedence (used in-memory only — never written to disk).
    const rawJson = typeof body.gcpCredentialsJson === 'string' ? body.gcpCredentialsJson.trim() : '';
    const storedJson = settings?.gcpCredentialsJson || '';

    const activeJson = rawJson || storedJson || '';
    if (rawJson) {
      const validation = validateGcpCredentialsJson(rawJson);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            validation,
            error: validation.error,
          },
          { status: 400 }
        );
      }
    }

    const credsInfo = activeJson
      ? getGcpCredentialsInfoFromJson(activeJson, location)
      : getGcpCredentialsInfo(settings?.gcpCredentialsPath, location);

    // Pasted/detected service account JSON project_id takes precedence over manual overrides
    const projectId = credsInfo.projectId || body.gcpProjectId || settings?.gcpProjectId || '';

    if (!credsInfo.exists && !projectId && !process.env.GCP_PROJECT_ID) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No GCP service account credentials found. Paste the full contents of your service account key JSON ' +
            '(Google Cloud Console → IAM & Admin → Service Accounts → Keys → Add Key → Create new key → JSON) into the field above, ' +
            'or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.',
        },
        { status: 400 }
      );
    }

    const testResult = await testVertexConnection(
      {
        projectId,
        location,
        credentialsPath: settings?.gcpCredentialsPath || credsInfo.filePath,
        credentialsJson: activeJson || undefined,
      },
      modelId
    );

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully connected to Vertex AI! (Project: ${testResult.projectId}, Region: ${testResult.location}, Model: ${testResult.model})`,
        projectId: testResult.projectId,
        location: testResult.location,
        model: testResult.model,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: testResult.error || 'Failed to connect to Vertex AI.',
          projectId: testResult.projectId,
          location: testResult.location,
          model: testResult.model,
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
