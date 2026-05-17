import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ollamaUrl = searchParams.get('ollamaUrl') || 'http://localhost:11434';
  
  const models = [...AVAILABLE_MODELS];
  
  // Check Ollama connection and add available local models
  let ollamaConnected = false;
  let ollamaModels: string[] = [];
  
  try {
    const ollamaRes = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    if (ollamaRes.ok) {
      ollamaConnected = true;
      const ollamaData = await ollamaRes.json();
      ollamaModels = (ollamaData.models || []).map((m: { name: string }) => m.name);
      
      // Add any Ollama models not already in the list
      for (const modelName of ollamaModels) {
        const alreadyExists = models.some(m => m.id === modelName);
        if (!alreadyExists) {
          const isGemma = modelName.toLowerCase().includes('gemma');
          models.push({
            id: modelName,
            name: `${modelName} (Local)`,
            provider: 'ollama',
            description: `Local model via Ollama. ${isGemma ? 'Gemma model with multimodal capabilities.' : 'Community model.'}`,
            maxAudioLength: isGemma ? 300 : 120,
            supportsDiarization: false,
            supportsTimestamps: true,
          });
        }
      }
    }
  } catch {
    ollamaConnected = false;
  }
  
  return NextResponse.json({
    models,
    ollamaConnected,
    ollamaModels,
  });
}
