import { NextResponse } from 'next/server';
import { getMetadataFromR2, uploadMetadataToR2 } from '@/lib/r2';

export const maxDuration = 60; // Allow Grok Reasoning up to 60 seconds

function getXaiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) console.warn('[Env] XAI_API_KEY is not defined.');
  return key || '';
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { modelId, topic, prompt, imageUrl } = body;

    if (!modelId || !topic) {
      return NextResponse.json({ error: 'Missing modelId or topic' }, { status: 400 });
    }

    const xaiKey = getXaiKey();
    if (!xaiKey) {
      return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 500 });
    }

    let absoluteImageUrl = imageUrl;
    if (absoluteImageUrl && absoluteImageUrl.startsWith('/')) {
      const host = req.headers.get('host') || 'medvizzz.vercel.app';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      absoluteImageUrl = `${protocol}://${host}${absoluteImageUrl}`;
    }

    console.log('[Grok] Generating dynamic anatomical labels for existing model:', topic, '| Vision Image:', absoluteImageUrl || 'None');
    
    let messages = [
      {
        role: 'system',
        content: `You are a medical 3D visualizer assistant. Given an anatomical organ or structure, generate EXACTLY 12 specific, highly detailed, medically accurate anatomical labels for it.
For each label, provide a short 1-sentence description, approximate 3D spatial coordinates (x, y, z) to position the label on a 3D model, and 2D screen offsets (dx, dy).
- 3D coordinates (x, y, z) should be floats between -1.5 and 1.5.
- 2D offsets (dx, dy) should be integers between -35 and 35, distributed in a circle around the organ so labels don't overlap.
Output EXACTLY a valid JSON object matching this schema, with no markdown, no quotes, no extra text:
{
  "structures": ["Label 1", "Label 2", "Label 3", "...", "Label 12"],
  "info": {
    "Label 1": "Description...",
    "Label 2": "Description..."
  },
  "positions": {
    "Label 1": { "x": 0.5, "y": 0.5, "z": 0.2 },
    "Label 2": { "x": -0.5, "y": -0.5, "z": -0.1 }
  },
  "offsets": {
    "Label 1": { "dx": 25, "dy": -15 },
    "Label 2": { "dx": -25, "dy": 15 }
  }
}`
      },
      { 
        role: 'user', 
        content: absoluteImageUrl ? [
          { type: 'text', text: `Topic: ${topic}\nPrompt used to generate model: ${prompt || 'None'}\n\nVisually analyze this specific 3D render snapshot and map the exact coordinates to the visual structures you see in this specific image. If the topic name is generic (like 'Model_123'), infer the actual organ purely from the image and the prompt.` },
          { type: 'image_url', image_url: { url: absoluteImageUrl } }
        ] : `Topic: ${topic}\nPrompt used to generate model: ${prompt || 'None'}\n\nIf the topic name is generic (like 'Model_123'), infer the actual organ purely from the prompt text.`
      }
    ];

    let grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${xaiKey}` },
      body: JSON.stringify({
        model: 'grok-4.20-0309-reasoning',
        messages
      })
    });
    
    if (!grokRes.ok) {
      const errText = await grokRes.text();
      console.warn('[Grok] Primary fetch failed:', errText);
      
      if (absoluteImageUrl && (errText.includes('image') || errText.includes('404') || errText.includes('400'))) {
        console.log('[Grok] Retrying without Vision due to image fetch failure...');
        messages[1].content = `Topic: ${topic}\nPrompt used to generate model: ${prompt || 'None'}\n\nIf the topic name is generic (like 'Model_123'), infer the actual organ purely from the prompt text.`;
        grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${xaiKey}` },
          body: JSON.stringify({
            model: 'grok-4.20-0309-reasoning',
            messages
          })
        });
      }
      
      if (!grokRes.ok) {
        console.error('[Grok] Final label generation failed:', await grokRes.text());
        return NextResponse.json({ error: 'Failed to generate labels via Grok' }, { status: 500 });
      }
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
