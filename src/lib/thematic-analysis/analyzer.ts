import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ThematicAnalysisResult, Code, Theme, Quote } from './types';

const THEMATIC_ANALYSIS_PROMPT = `You are a qualitative research assistant specializing in HCI thematic analysis following Braun & Clarke methodology.

TASK: Perform inductive thematic coding on interview transcripts.

PROCESS:
1. Read all transcripts carefully
2. Identify meaningful units and assign descriptive codes
3. Group related codes into coherent themes
4. Provide supporting quotes for each code

RULES:
- Use inductive approach (codes emerge from data, not predefined)
- Codes should be descriptive and specific
- Themes should be patterns across multiple codes
- Every code must have at least one supporting quote
- Preserve original language (Bangla/English as spoken)
- Be transparent: only identify themes actually present in data

OUTPUT FORMAT (JSON):
{
  "codes": [
    {
      "id": "code_1",
      "label": "Brief code label",
      "description": "What this code represents",
      "quotes": [
        {"text": "exact quote from transcript", "source": "filename or speaker"}
      ],
      "frequency": 3
    }
  ],
  "themes": [
    {
      "id": "theme_1",
      "name": "Theme name",
      "description": "What this theme represents and why it matters",
      "codes": ["code_1", "code_2"],
      "prevalence": 75
    }
  ],
  "summary": "Brief overview of key findings"
}

CRITICAL: Output ONLY valid JSON. No markdown. No explanation outside JSON.`;

export async function analyzeThemes(
  transcripts: Array<{ content: string; fileName: string }>,
  researchQuestion?: string
): Promise<ThematicAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const context = researchQuestion 
    ? `RESEARCH QUESTION: ${researchQuestion}\n\n` 
    : '';

  const transcriptText = transcripts
    .map(t => `=== ${t.fileName} ===\n${t.content}\n`)
    .join('\n');

  const fullPrompt = `${THEMATIC_ANALYSIS_PROMPT}\n\n${context}TRANSCRIPTS:\n${transcriptText}`;

  const result = await model.generateContent(fullPrompt);
  const text = result.response.text();

  return parseAnalysisResponse(text);
}

function parseAnalysisResponse(text: string): ThematicAnalysisResult {
  let jsonStr = text.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) {
    jsonStr = objMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    
    return {
      codes: (parsed.codes || []).map((c: any) => ({
        id: c.id || crypto.randomUUID(),
        label: c.label || 'Unnamed Code',
        description: c.description || '',
        quotes: (c.quotes || []).map((q: any) => ({
          text: q.text || '',
          source: q.source || 'Unknown',
          speaker: q.speaker,
          timestamp: q.timestamp,
        })),
        frequency: c.frequency || c.quotes?.length || 0,
      })),
      themes: (parsed.themes || []).map((t: any) => ({
        id: t.id || crypto.randomUUID(),
        name: t.name || 'Unnamed Theme',
        description: t.description || '',
        codes: t.codes || [],
        prevalence: t.prevalence || 0,
      })),
      summary: parsed.summary || 'No summary provided',
    };
  } catch (err) {
    console.error('[thematic] Parse error:', err);
    console.error('[thematic] Response:', jsonStr.substring(0, 500));
    throw new Error('Failed to parse thematic analysis response');
  }
}
