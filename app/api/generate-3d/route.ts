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
      try {
        console.log(`[MedVis] Requesting Grok for 3D prompt engineering for topic: "${topic}"...`);
        const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'grok-4.20-0309-reasoning',
            messages: [{
              role: 'system',
              content: 'You are a master 3D prompt engineer. Write a single, highly detailed paragraph describing the anatomical structure for a Text-to-3D model generator. The description MUST include veins, blood streams, the natural color of the organ, and both the inside and outside of the organ. Keep it under 100 words.'
            }, {
              role: 'user',
              content: `Write a text-to-3D prompt for: ${topic}`
            }]
          })
        });

        if (grokResponse.ok) {
          const grokData = await grokResponse.json();
          n4dPrompt = grokData.choices?.[0]?.message?.content || '';
        } else {
          console.error("[MedVis] Grok call failed with status:", grokResponse.status);
        }
      } catch (err) {
        console.error("[MedVis] Grok call error:", err);
      }
    }
    
    if (!n4dPrompt) {
      n4dPrompt = `A highly detailed, medically accurate 3D model of ${topic} showing veins, blood streams, natural colors, showing both inside and outside details, photorealistic.`;
    }

    console.log("[MedVis] Engineered 3D prompt to send to Neural4D:", n4dPrompt);

    // 2. Call Neural4D API to start generation
    const neural4dKey = process.env.NEURAL4D_API_KEY;
    
    if (!neural4dKey) {
      console.warn("[Neural4D] NEURAL4D_API_KEY environment variable is missing. Reverting to simulation.");
      return NextResponse.json({
        success: true,
        promptUsed: n4dPrompt,
        modelUrl: 'fallback' // Simulated fallback
      });
    }

    try {
      console.log("[Neural4D] Initiating Text-to-3D via generateModelWithText...");
      const n4dResponse = await fetch('https://alb.neural4d.com:3000/api/generateModelWithText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${neural4dKey}`
        },
        body: JSON.stringify({
          prompt: n4dPrompt,
          modelCount: 1,
          disablePbr: 0
        })
      });

      if (n4dResponse.ok) {
        const n4dData = await n4dResponse.json();
        const uuid = n4dData.uuids?.[0];
        
        if (uuid) {
          console.log(`[Neural4D] Model generation job initiated. UUID: ${uuid}`);
          return NextResponse.json({
            success: true,
            promptUsed: n4dPrompt,
            uuid
          });
        } else {
          console.error("[Neural4D] No UUID returned in generate response:", n4dData);
        }
      } else {
        console.error("[Neural4D] Generate API Error status:", n4dResponse.status, await n4dResponse.text());
      }
    } catch (err) {
      console.error("[Neural4D] Request failed:", err);
    }

    // Default to fallback if Neural4D initiation failed
    return NextResponse.json({
      success: true,
      promptUsed: n4dPrompt,
      modelUrl: 'fallback'
    });

  } catch (err: any) {
    console.error("Error in generate-3d POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json({ error: 'UUID is required' }, { status: 400 });
    }

    const neural4dKey = process.env.NEURAL4D_API_KEY;
    if (!neural4dKey) {
      console.warn("[Neural4D] NEURAL4D_API_KEY missing during GET status retrieval.");
      return NextResponse.json({ success: true, codeStatus: -3, error: 'API key missing' });
    }

    console.log(`[Neural4D] Polling status for UUID: ${uuid}...`);
    const retrieveRes = await fetch('https://alb.neural4d.com:3000/api/retrieveModel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${neural4dKey}`
      },
      body: JSON.stringify({ uuid })
    });

    if (retrieveRes.ok) {
      const statusData = await retrieveRes.json();
      console.log(`[Neural4D] Retrieve response:`, statusData);
      
      if (statusData.codeStatus === 0) {
        const modelUrl = statusData.modelUrl || statusData.glbUrl || statusData.url;
        console.log(`[Neural4D] Generation complete! URL: ${modelUrl}`);
        return NextResponse.json({
          success: true,
          codeStatus: 0,
          modelUrl
        });
      } else {
        return NextResponse.json({
          success: true,
          codeStatus: statusData.codeStatus
        });
      }
    } else {
      const errText = await retrieveRes.text();
      console.error(`[Neural4D] Poll request failed:`, errText);
      return NextResponse.json({ success: false, error: errText }, { status: 500 });
    }

  } catch (err: any) {
    console.error("Error in generate-3d GET:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
