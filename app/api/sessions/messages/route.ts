import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJsonFromR2, uploadJsonToR2 } from '@/lib/r2';

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

    const { userId } = await auth();
    const accountId = userId || 'anon';
    const messagesKey = `sessions/${accountId}/messages_${sessionId}.json`;

    // 1. Try reading from R2 first
    const r2Messages = await getJsonFromR2(messagesKey);
    if (r2Messages && Array.isArray(r2Messages)) {
      return NextResponse.json({ messages: r2Messages });
    }

    // 2. Fallback to SQLite if not found on R2
    if (!getMessagesBySession) {
      // Vercel fallback: return default welcome message
      const defaultWelcome = [{
        id: 'msg_welcome_' + sessionId,
        session_id: sessionId,
        sender: 'ai',
        text: "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
        suggest_model: null,
        suggest_label: null,
        created_at: new Date().toISOString()
      }];
      await uploadJsonToR2(messagesKey, defaultWelcome);
      return NextResponse.json({ messages: defaultWelcome });
    }

    const messages = getMessagesBySession(sessionId);
    // Sync to R2 for future accesses
    await uploadJsonToR2(messagesKey, messages);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, sessionId, sender, text, suggestModel, suggestLabel, imageUrl } = await req.json();
    const { userId } = await auth();
    const accountId = userId || 'anon';
    const messagesKey = `sessions/${accountId}/messages_${sessionId}.json`;

    const newMsg: any = {
      id,
      session_id: sessionId,
      sender,
      text,
      suggest_model: suggestModel || null,
      suggest_label: suggestLabel || null,
      image_url: imageUrl || null,
      created_at: new Date().toISOString()
    };

    // 1. Add to SQLite if available
    if (addMessage) {
      try { addMessage(id, sessionId, sender, text, suggestModel || null, suggestLabel || null); } catch (_) {}
    }

    // 2. Append and upload to R2
    let messages = await getJsonFromR2(messagesKey);
    if (!messages || !Array.isArray(messages)) {
      messages = [];
    }
    
    // Avoid double posting same message
    if (!messages.some((m: any) => m.id === id)) {
      messages = [...messages, newMsg];
      await uploadJsonToR2(messagesKey, messages);
    }

    return NextResponse.json({ message: newMsg });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

