import { NextResponse } from 'next/server';
import { getMetadataFromR2, uploadMetadataToR2 } from '@/lib/r2';

function getXaiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) console.warn('[Env] XAI_API_KEY is not defined.');
  return key || '';
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { modelId, topic, prompt } = body;

    if (!modelId || !topic) {
      return NextResponse.json({ error: 'Missing modelId or topic' }, { status: 400 });
    }

    const xaiKey = getXaiKey();
    if (!xaiKey) {
      return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 500 });
    }

    console.log('[Grok] Generating dynamic anatomical labels for existing model:', topic);
    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${xaiKey}` },
      body: JSON.stringify({
        model: 'grok-4.20-0309-reasoning',
        messages: [
          {
            role: 'system',
            content: `You are a medical 3D visualizer assistant. Given an anatomical organ or structure, generate EXACTLY 4 specific, medically accurate anatomical labels for it.
For each label, provide a short 1-sentence description, approximate 3D spatial coordinates (x, y, z) to position the label on a 3D model, and 2D screen offsets (dx, dy).
- 3D coordinates (x, y, z) should be floats between -1.5 and 1.5.
- 2D offsets (dx, dy) should be integers between -25 and 25.
Output EXACTLY a valid JSON object matching this schema, with no markdown, no quotes, no extra text:
{
  "structures": ["Label 1", "Label 2", "Label 3", "Label 4"],
  "info": {
    "Label 1": "Description...",
    "Label 2": "Description...",
    "Label 3": "Description...",
    "Label 4": "Description..."
  },
  "positions": {
    "Label 1": { "x": 0.5, "y": 0.5, "z": 0.2 },
    "Label 2": { "x": -0.5, "y": -0.5, "z": -0.1 },
    "Label 3": { "x": 0.0, "y": 1.0, "z": 0.0 },
    "Label 4": { "x": -1.0, "y": 0.0, "z": 0.5 }
  },
  "offsets": {
    "Label 1": { "dx": 18, "dy": -12 },
    "Label 2": { "dx": -18, "dy": 15 },
    "Label 3": { "dx": 20, "dy": -10 },
    "Label 4": { "dx": -20, "dy": 10 }
  }
}`
          },
          { role: 'user', content: `Topic: ${topic}\nPrompt used to generate model: ${prompt || 'None'}` }
        ]
      })
    });
    
    if (!grokRes.ok) {
      console.error('[Grok] Failed to generate labels:', await grokRes.text());
      return NextResponse.json({ error: 'Failed to generate labels via Grok' }, { status: 500 });
    }

    const d = await grokRes.json();
    let content = d.choices?.[0]?.message?.content?.trim() || '';
    
    // Safely extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }
    
    const dynamicLabels = JSON.parse(content.trim());

    // ── Fetch existing metadata from R2, update it, and save it back ──
    const existingData = await getMetadataFromR2(modelId);
    if (existingData) {
      const updatedMetadata = { ...existingData, dynamicLabels };
      await uploadMetadataToR2(modelId, updatedMetadata);
      console.log(`[R2] Metadata for ${modelId} successfully updated with dynamic labels.`);
    }

    return NextResponse.json({ success: true, dynamicLabels });
  } catch (err: any) {
    console.error('[generate-labels POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
