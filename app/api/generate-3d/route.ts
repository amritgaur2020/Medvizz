import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();
    
    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // 1. Ask Grok to create a highly detailed prompt for Neural4D
    const apiKey = process.env.XAI_API_KEY;
    let n4dPrompt = '';
    
    if (apiKey) {
      const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'grok-4.20-0309-reasoning',
          messages: [{
            role: 'system',
            content: 'You are a master 3D prompt engineer. Write a single, highly detailed paragraph describing the anatomical structure for a Text-to-3D model generator. Include exact colors, lighting, textures, and anatomical accuracy. Keep it under 100 words.'
          }, {
            role: 'user',
            content: `Write a text-to-3D prompt for: ${topic}`
          }]
        })
      });
      const grokData = await grokResponse.json();
      n4dPrompt = grokData.choices?.[0]?.message?.content || `A highly detailed, medically accurate 3D model of ${topic}, photorealistic textures, volumetric lighting.`;
    } else {
      n4dPrompt = `A highly detailed, medically accurate 3D model of ${topic}, photorealistic textures, volumetric lighting.`;
    }

    // 2. Call Neural4D API
    const neural4dKey = process.env.NEURAL4D_API_KEY;
    let modelUrl = null;

    if (neural4dKey) {
      try {
        console.log("[Neural4D] Initiating Text-to-3D with prompt:", n4dPrompt);
        // Attempting to hit Neural4D text-to-3d endpoint
        const n4dResponse = await fetch('https://api.neural4d.com/v1/text-to-3d', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${neural4dKey}`
          },
          body: JSON.stringify({ prompt: n4dPrompt })
        });

        if (n4dResponse.ok) {
          const n4dData = await n4dResponse.json();
          modelUrl = n4dData.model_url || n4dData.asset_url || n4dData.url || n4dData.glb_url;
        } else {
          console.error("Neural4D API Error:", await n4dResponse.text());
        }
      } catch (err) {
        console.error("Neural4D fetch failed", err);
      }
    }

    // Fallback if Neural4D endpoint differs or fails
    if (!modelUrl) {
      // Simulate Neural4D async generation delay
      await new Promise(r => setTimeout(r, 3500));
      modelUrl = 'fallback'; // Tell frontend to use a procedural fallback or placeholder
    }

    return NextResponse.json({ 
      success: true, 
      promptUsed: n4dPrompt,
      modelUrl 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
