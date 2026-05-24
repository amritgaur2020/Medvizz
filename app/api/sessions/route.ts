import { NextResponse } from 'next/server';

// Dynamic import for SQLite — gracefully skipped on Vercel serverless
let getSessions: any = null;
let createSession: any = null;
let deleteSession: any = null;
try {
  const db = require('@/lib/db');
  getSessions = db.getSessions;
  createSession = db.createSession;
  deleteSession = db.deleteSession;
} catch (_) {}

export async function GET() {
  try {
    if (!getSessions) {
      // Vercel mode: return a default session in-memory
      return NextResponse.json({
        sessions: [{
          id: 'session_default',
          title: 'MedVis AI Clinical Sandbox',
          model_type: 'general',
          created_at: new Date().toISOString()
        }]
      });
    }

    let sessions = getSessions();
    if (sessions.length === 0) {
      const defaultSessionId = 'session_' + Date.now();
      createSession(defaultSessionId, 'MedVis AI Clinical Sandbox', 'general');
      const { addMessage } = require('@/lib/db');
      addMessage(
        'msg_welcome_' + Date.now(),
        defaultSessionId,
        'ai',
        "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
        null, null
      );
      sessions = getSessions();
    }
    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, title, modelType } = await req.json();
    if (!createSession) {
      return NextResponse.json({ session: { id, title, model_type: modelType || 'general', created_at: new Date().toISOString() } });
    }
    const session = createSession(id, title, modelType || 'general');
    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (deleteSession && id) deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
