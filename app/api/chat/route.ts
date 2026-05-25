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
    const { sessionId, messages, mode } = await req.json();

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

    // ── Construct system prompt based on the chosen mode ──
    let systemPromptContent = '';
    
    if (mode === 'simple') {
      systemPromptContent = `You are MedVis AI — an elite-tier Clinical AI Assistant. You must explain medical, clinical, physiological, and anatomical systems to a NON-MEDICAL field user in a simple language so that they can understand in easy language.
      
RESPONSE REQUIREMENTS:
1. **Layperson-Friendly / Simple Language**: Do not use complex medical jargon or clinical terms. If you must use a technical term, define it immediately in plain, simple English. Your explanation must be easy to read and understand by a general public user.
2. **Analogies & Real-World Examples**: Use simple everyday analogies (e.g. comparing the heart to a household water pump, or blood vessels to plumbing pipes) to make abstract biological processes concrete.
3. **Structured Markdown**: Organize the answer with simple:
   - ### headings
   - **bold text** for important terms
   - Bullet points (* ) for easy reading
4. **Friendly Tone**: Keep explanations welcoming, clear, and reassuring.`;
    } else {
      // default to 'deep' mode: MBBS Doctor / Clinician explanation
      systemPromptContent = `You are MedVis AI — an elite-tier Clinical AI Assistant. You must explain medical, clinical, physiological, pharmacological, and pathological systems in depth, like an MBBS doctor explaining details to a medical colleague or professional using precise medical terminology.
      
RESPONSE REQUIREMENTS:
1. **MBBS Doctor Level Depth & Terminology**: Use exact, rigorous medical terminology (e.g. "isovolumetric contraction", "juxtaglomerular cells", "action potentials", "sarcoplasmic reticulum"). Explain the underlying pathophysiology, biochemistry, and hemodynamics.
2. **Deep and Brief**: Be highly concise and high-density. Avoid conversational intro filler, pleasantries, or superficial summaries. Provide maximum diagnostic and academic depth in minimal words.
3. **Clinical Significance**: Highlight clinical correlations, common pathologies, diagnostic indicators, and relevant pharmacology.
4. **Structured Markdown**: Organise into clear ### sections, with **bold** terminology and detailed * bullet points.`;
    }

    const systemPrompt = {
      role: 'system',
      content: systemPromptContent
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

    // ── Call xAI Grok API ──
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
        console.error(`[MedVis] API error (${response.status}):`, errorText);
        aiResponseText = `### ⚠️ MedVis Engine Error (${response.status})\n\nThe MedVis clinical reasoning engine was unable to process the request. This usually occurs if the upstream API key lacks active billing or permissions.\n\n**Server Response:** ${errorText}`;
        data = { choices: [{ message: { content: aiResponseText } }] };
      }
    } catch (fetchErr: any) {
      console.error('[MedVis] Network error:', fetchErr);
      aiResponseText = `### ⚠️ Network Error\n\nCould not reach the MedVis reasoning clusters: ${fetchErr.message}`;
      data = { choices: [{ message: { content: aiResponseText } }] };
    }

    // ── Determine 3D model suggestion based on keywords ──
    // PRIORITY: User query always wins. AI response is only used as a last resort.
    let modelSuggestion: string | null = null;
    let labelSuggestion: string | null = null;

    // Helper: detect model from text
    function detectModel(text: string): { model: string; label: string } | null {
      const t = text.toLowerCase();
      if (t.includes('urinary') || t.includes('kidney') || t.includes('renal') || t.includes('nephron') || t.includes('bladder') || t.includes('urethra') || t.includes('ureter') || t.includes('glomerulus') || t.includes('glomeruli')) {
        return { model: 'kidneys', label: 'Urinary System' };
      }
      if (t.includes('lung') || t.includes('respir') || t.includes('breath') || t.includes('pulmonary') || t.includes('alveoli') || t.includes('trachea') || t.includes('bronch')) {
        return { model: 'lungs', label: 'Pulmonary System' };
      }
      if (t.includes('brain') || t.includes('cerebral') || t.includes('synap') || t.includes('neuron') || t.includes('cerebellum') || t.includes('nervous system') || t.includes('cortex')) {
        return { model: 'brain', label: 'Nervous System' };
      }
      if (t.includes('heart') || t.includes('cardio') || t.includes('coronary') || t.includes('myocardium') || t.includes('ventricle') || t.includes('atrium') || t.includes('aorta') || t.includes('circulation')) {
        return { model: 'heart', label: 'Cardiovascular System' };
      }
      // General body part / system extraction
      const systemMatch = text.match(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+system\b/i);
      if (systemMatch) {
        const sysName = systemMatch[1].trim();
        const label = sysName.charAt(0).toUpperCase() + sysName.slice(1).toLowerCase() + ' System';
        return { model: 'kidneys', label };
      }
      const organMatch = text.match(/\b(liver|stomach|intestine|pancreas|spleen|gallbladder|thyroid|prostate|uterus|ovaries|bone|muscle|skin|skeletal|lymph|immune|digestive|endocrine|reproductive|musculoskeletal)\b/i);
      if (organMatch) {
        const organ = organMatch[1].charAt(0).toUpperCase() + organMatch[1].slice(1).toLowerCase();
        return { model: 'kidneys', label: `${organ} System` };
      }
      return null;
    }

    // 1. User query has absolute priority
    const queryDetection = detectModel(lastMessage.text);
    if (queryDetection) {
      modelSuggestion = queryDetection.model;
      labelSuggestion = queryDetection.label;
    }

    // 2. Only fall back to AI response if query gave no match
    if (!modelSuggestion && aiResponseText && !aiResponseText.includes('⚠️')) {
      const responseDetection = detectModel(aiResponseText);
      if (responseDetection) {
        modelSuggestion = responseDetection.model;
        labelSuggestion = responseDetection.label;
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
