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
