import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJsonFromR2, uploadJsonToR2, deleteJsonFromR2 } from '@/lib/r2';

// Dynamic import for SQLite — gracefully skipped on Vercel serverless
let getSessions: any = null;
let createSession: any = null;
let deleteSession: any = null;
let updateSessionTitle: any = null;
try {
  const db = require('@/lib/db');
  getSessions = db.getSessions;
  createSession = db.createSession;
  deleteSession = db.deleteSession;
  updateSessionTitle = db.updateSessionTitle;
} catch (_) {}

export async function GET() {
  try {
    const { userId } = await auth();
    const accountId = userId || 'anon';
    const r2Key = `sessions/${accountId}/sessions.json`;

    // Try reading from R2 first
    const r2Sessions = await getJsonFromR2(r2Key);
    if (r2Sessions && Array.isArray(r2Sessions)) {
      return NextResponse.json({ sessions: r2Sessions });
    }

    // Fallback to SQLite if not found on R2
    if (!getSessions) {
      // Vercel fallback: return a default session in-memory
      const defaultSessions = [{
        id: 'session_default',
        title: 'MedVis AI Clinical Sandbox',
        model_type: 'general',
        created_at: new Date().toISOString()
      }];
      await uploadJsonToR2(r2Key, defaultSessions);
      return NextResponse.json({ sessions: defaultSessions });
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
    
    // Backup SQLite sessions to R2 for consistency
    await uploadJsonToR2(r2Key, sessions);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, title, modelType } = await req.json();
    const { userId } = await auth();
    const accountId = userId || 'anon';
    const r2Key = `sessions/${accountId}/sessions.json`;

    const newSession = {
      id,
      title,
      model_type: modelType || 'general',
      created_at: new Date().toISOString()
    };

    // 1. Update SQLite if available
    if (createSession) {
      try { createSession(id, title, modelType || 'general'); } catch (_) {}
    }

    // 2. Update R2 (True Serverless DB)
    let sessions = await getJsonFromR2(r2Key);
    if (!sessions || !Array.isArray(sessions)) {
      sessions = [];
    }
    sessions = [newSession, ...sessions];
    await uploadJsonToR2(r2Key, sessions);

    return NextResponse.json({ session: newSession });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const { userId } = await auth();
    const accountId = userId || 'anon';
    const r2Key = `sessions/${accountId}/sessions.json`;

    // 1. Delete from SQLite if available
    if (deleteSession) {
      try { deleteSession(id); } catch (_) {}
    }

    // 2. Delete from R2 (Sessions list)
    let sessions = await getJsonFromR2(r2Key);
    if (sessions && Array.isArray(sessions)) {
      sessions = sessions.filter((s: any) => s.id !== id);
      await uploadJsonToR2(r2Key, sessions);
    }

    // 3. Delete messages file for this session from R2
    const messagesKey = `sessions/${accountId}/messages_${id}.json`;
    await deleteJsonFromR2(messagesKey);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, title } = await req.json();
    if (!id || !title) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { userId } = await auth();
    const accountId = userId || 'anon';
    const r2Key = `sessions/${accountId}/sessions.json`;

    // 1. Update SQLite if available
    if (updateSessionTitle) {
      try { updateSessionTitle(id, title); } catch (_) {}
    }

    // 2. Update R2
    let sessions = await getJsonFromR2(r2Key);
    if (sessions && Array.isArray(sessions)) {
      sessions = sessions.map((s: any) => s.id === id ? { ...s, title } : s);
      await uploadJsonToR2(r2Key, sessions);
    }

    return NextResponse.json({ success: true, id, title });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

