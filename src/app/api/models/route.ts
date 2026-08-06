import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS, VERTEX_MODELS } from '@/lib/transcriber/types';

export async function GET() {
  return NextResponse.json({ models: AVAILABLE_MODELS, vertexModels: VERTEX_MODELS });
}
