import { NextResponse } from 'next/server';

// Dynamic import for SQLite — gracefully skipped on Vercel serverless
let addMessage: any = null;
try {
  const db = require('@/lib/db');
  addMessage = db.addMessage;
} catch (_) {
  // SQLite unavailable (Vercel serverless) — chat still works, just no persistence
}

export async function POST(req: Request) {
  try {
    const { sessionId, messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.sender !== 'user') {
      return NextResponse.json({ error: 'No user message found to process' }, { status: 400 });
    }

    // Save user message to SQLite (if available)
    if (addMessage && sessionId) {
      try {
        addMessage(lastMessage.id || 'msg_user_' + Date.now(), sessionId, 'user', lastMessage.text, null, null);
      } catch (_) {}
    }

    // ── API Key: loaded ONLY from server-side environment, NEVER exposed to frontend ──
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        choices: [{ message: { content: '### ⚠️ Configuration Error\n\nXAI_API_KEY environment variable is not set.\n\n**Local:** Add it to `.env.local`\n**Vercel:** Add it in Project Settings → Environment Variables' } }],
        aiMsgId: 'err_' + Date.now(),
      });
    }

    // ── Comprehensive clinical system prompt ──
    const systemPrompt = {
      role: 'system',
      content: `You are MedVis AI — an elite-tier Clinical AI Assistant. You must provide EXTREMELY detailed, academically rigorous, and scientifically precise explanations for ANY medical, clinical, physiological, anatomical, pharmacological, pathological, or health-related query.

RESPONSE REQUIREMENTS:
1. **Depth & Detail**: Every answer must be comprehensive. Explain the underlying mechanisms at molecular, cellular, tissue, organ, and systemic levels where applicable. Include specific numerical values (pressures in mmHg, concentrations in mEq/L, dimensions in micrometers, etc.).
2. **Scientific Rigor**: Use precise medical terminology throughout — e.g., "glomerular filtration rate", "juxtaglomerular apparatus", "countercurrent multiplication", "electrochemical gradient", "ligand-gated ion channels", "Frank-Starling mechanism".
3. **Structured Format**: Always organize your response with clean Markdown:
   - Use ### headers for major sections
   - Use **bold** for key medical terms and structures
   - Use bullet points (* ) for detailed sub-explanations
   - Use numbered lists for sequential processes
4. **Clinical Correlation**: When relevant, mention clinical significance, common pathologies, diagnostic markers, and therapeutic approaches.
5. **Comprehensive Coverage**: Cover ALL aspects of the topic — anatomy, histology, physiology, biochemistry, pathophysiology, and clinical relevance. Never give a short or superficial answer.
6. **Universal Scope**: You must answer ANY medical topic — kidneys, liver, GI tract, endocrine system, musculoskeletal system, reproductive system, immune system, dermatology, hematology, oncology, pharmacology, microbiology, and every other medical discipline with equal depth.`
    };

    const formattedMessages = [
      systemPrompt,
      ...messages.map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    ];

    let aiResponseText = '';
    let data: any = null;

    // ── Call xAI Grok API: model grok-4.20-0309-reasoning ──
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-4.20-0309-reasoning',
          messages: formattedMessages,
          temperature: 0.4,
        }),
      });

      if (response.ok) {
        data = await response.json();
        aiResponseText = data.choices?.[0]?.message?.content || '';
      } else {
        const errorText = await response.text();
        console.error(`[MedVis] Grok API error (${response.status}):`, errorText);
        aiResponseText = `### ⚠️ Grok API Error (${response.status})\n\n${errorText}`;
        data = { choices: [{ message: { content: aiResponseText } }] };
      }
    } catch (fetchErr: any) {
      console.error('[MedVis] Network error:', fetchErr);
      aiResponseText = `### ⚠️ Network Error\n\nCould not reach the xAI servers: ${fetchErr.message}`;
      data = { choices: [{ message: { content: aiResponseText } }] };
    }

    // ── Determine 3D model suggestion based on keywords ──
    let modelSuggestion: string | null = null;
    let labelSuggestion: string | null = null;

    // 1. Check direct user query intent first
    const lowerQuery = lastMessage.text.toLowerCase();
    
    if (lowerQuery.includes('lung') || lowerQuery.includes('respir') || lowerQuery.includes('breath') || lowerQuery.includes('pulmonary') || lowerQuery.includes('alveoli') || lowerQuery.includes('trachea')) {
      modelSuggestion = 'lungs';
      labelSuggestion = 'Trachea & Pulmonary Lobes';
    } else if (lowerQuery.includes('urinary') || lowerQuery.includes('kidney') || lowerQuery.includes('renal') || lowerQuery.includes('nephron') || lowerQuery.includes('bladder') || lowerQuery.includes('urethra') || lowerQuery.includes('ureter')) {
      modelSuggestion = 'kidneys';
      labelSuggestion = 'Urinary System';
    } else if (lowerQuery.includes('brain') || lowerQuery.includes('cerebral') || lowerQuery.includes('synap') || lowerQuery.includes('neural') || lowerQuery.includes('cortex') || lowerQuery.includes('neuron') || lowerQuery.includes('nervous')) {
      modelSuggestion = 'brain';
      labelSuggestion = 'Cerebral Cortex';
    } else if (lowerQuery.includes('heart') || lowerQuery.includes('cardio') || lowerQuery.includes('coronary') || lowerQuery.includes('myocardium') || lowerQuery.includes('ventricle') || lowerQuery.includes('atrium') || lowerQuery.includes('aorta') || lowerQuery.includes('circulation')) {
      modelSuggestion = 'heart';
      labelSuggestion = 'Aorta & Ventricles';
    }

    // 2. Fallback to AI response text keywords if query is neutral
    if (!modelSuggestion) {
      const lowerResponse = aiResponseText.toLowerCase();
      
      if (lowerResponse.includes('lung') || lowerResponse.includes('respir') || lowerResponse.includes('breath') || lowerResponse.includes('pulmonary') || lowerResponse.includes('alveoli') || lowerResponse.includes('trachea')) {
        modelSuggestion = 'lungs';
        labelSuggestion = 'Trachea & Pulmonary Lobes';
      } else if (lowerResponse.includes('urinary') || lowerResponse.includes('kidney') || lowerResponse.includes('renal') || lowerResponse.includes('nephron') || lowerResponse.includes('bladder') || lowerResponse.includes('urethra') || lowerResponse.includes('ureter')) {
        modelSuggestion = 'kidneys';
        labelSuggestion = 'Urinary System';
      } else if (lowerResponse.includes('brain') || lowerResponse.includes('cerebral') || lowerResponse.includes('synap') || lowerResponse.includes('neural') || lowerResponse.includes('cortex') || lowerResponse.includes('neuron') || lowerResponse.includes('nervous')) {
        modelSuggestion = 'brain';
        labelSuggestion = 'Cerebral Cortex';
      } else if (lowerResponse.includes('heart') || lowerResponse.includes('cardio') || lowerResponse.includes('coronary') || lowerResponse.includes('myocardium') || lowerResponse.includes('ventricle') || lowerResponse.includes('atrium') || lowerResponse.includes('aorta') || lowerResponse.includes('circulation')) {
        modelSuggestion = 'heart';
        labelSuggestion = 'Aorta & Ventricles';
      } else {
        // General custom dynamic body part extraction fallback
        const systemMatches = lastMessage.text.match(/([a-zA-Z]+ system)/i);
        const organMatches = lastMessage.text.match(/(liver|stomach|intestine|pancreas|spleen|gallbladder|thyroid|prostate|uterus|ovaries|bones|muscles|skin|skeletal)/i);
        if (systemMatches) {
          modelSuggestion = 'kidneys'; // Default 3D canvas container to kidneys/renal for custom ones
          labelSuggestion = systemMatches[0].charAt(0).toUpperCase() + systemMatches[0].slice(1).toLowerCase();
        } else if (organMatches) {
          modelSuggestion = 'kidneys';
          const organ = organMatches[0].charAt(0).toUpperCase() + organMatches[0].slice(1).toLowerCase();
          labelSuggestion = `${organ} System`;
        }
      }
    }

    // ── Save AI response to SQLite (if available) ──
    const aiMsgId = 'msg_ai_' + Date.now();
    if (addMessage && sessionId) {
      try {
        addMessage(aiMsgId, sessionId, 'ai', aiResponseText, modelSuggestion, labelSuggestion);
      } catch (_) {}
    }

    return NextResponse.json({
      ...data,
      dbSaved: !!addMessage,
      aiMsgId,
      suggestModel: modelSuggestion,
      suggestLabel: labelSuggestion
    });
  } catch (error: any) {
    console.error('Error in MedVis chat API route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
