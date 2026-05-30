import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ollamaUrl = searchParams.get('ollamaUrl') || process.env.OLLAMA_URL || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return NextResponse.json({ connected: false, models: [] });
    }
    
    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    
    return NextResponse.json({ connected: true, models });
  } catch {
    return NextResponse.json({ connected: false, models: [] });
  }
}
