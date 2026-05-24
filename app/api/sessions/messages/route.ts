import { NextResponse } from 'next/server';

// Dynamic import for SQLite — gracefully skipped on Vercel serverless
let getMessagesBySession: any = null;
let addMessage: any = null;
try {
  const db = require('@/lib/db');
  getMessagesBySession = db.getMessagesBySession;
  addMessage = db.addMessage;
} catch (_) {}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    if (!getMessagesBySession) {
      // Vercel mode: return default welcome message
      return NextResponse.json({
        messages: [{
          id: 'msg_welcome',
          session_id: sessionId,
          sender: 'ai',
          text: "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
          suggest_model: null,
          suggest_label: null,
          created_at: new Date().toISOString()
        }]
      });
    }

    const messages = getMessagesBySession(sessionId);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, sessionId, sender, text, suggestModel, suggestLabel } = await req.json();
    if (addMessage) {
      try { addMessage(id, sessionId, sender, text, suggestModel || null, suggestLabel || null); } catch (_) {}
    }
    return NextResponse.json({ message: { id, session_id: sessionId, sender, text } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
