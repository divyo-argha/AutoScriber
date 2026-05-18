import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const { modelId, ollamaUrl } = await request.json();

    if (!modelId) {
      return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const pullProcess = spawn('ollama', ['pull', modelId]);

          pullProcess.stdout.on('data', (data) => {
            const message = data.toString();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'progress', message })}\n\n`));
          });

          pullProcess.stderr.on('data', (data) => {
            const message = data.toString();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'progress', message })}\n\n`));
          });

          pullProcess.on('close', (code) => {
            if (code === 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'complete' })}\n\n`));
            } else {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: `Process exited with code ${code}` })}\n\n`));
            }
            controller.close();
          });

          pullProcess.on('error', (err) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`));
            controller.close();
          });
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })}\n\n`));
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
