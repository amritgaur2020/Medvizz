/**
 * lib/db.ts
 *
 * This file is kept for backwards compatibility with dynamic imports across existing routes.
 * We have migrated all 3D model storage and query metadata directly to Cloudflare R2 (100% serverless).
 * All chat history and session persistence are seamlessly synchronized in the client's `localStorage`
 * for an offline-first, highly reliable, and zero-maintenance architecture.
 */

export interface DbSession {
  id: string;
  title: string;
  model_type: string;
  created_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  sender: 'user' | 'ai';
  text: string;
  suggest_model: string | null;
  suggest_label: string | null;
  created_at: string;
}

export interface DbGeneratedModel {
  id: string;
  topic: string;
  prompt: string;
  model_url: string;
  image_url: string | null;
  title: string | null;
  user_id: string | null;
  created_at: string;
}

// Simple in-memory fallbacks for routes that dynamically load these helpers on startup
let inMemorySessions: DbSession[] = [];
let inMemoryMessages: DbMessage[] = [];

console.log('[Database] Migrated from local SQLite file storage to serverless Cloudflare R2 + client-side LocalStorage.');

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS HELPERS (In-Memory fallback; Client handles full LocalStorage sync)
// ─────────────────────────────────────────────────────────────────────────────
export const getSessions = (): DbSession[] => {
  if (inMemorySessions.length === 0) {
    inMemorySessions.push({
      id: 'session_default',
      title: 'MedVis AI Clinical Sandbox',
      model_type: 'general',
      created_at: new Date().toISOString()
    });
  }
  return inMemorySessions;
};

export const createSession = (id: string, title: string, modelType: string = 'general'): DbSession => {
  const newSession: DbSession = {
    id,
    title,
    model_type: modelType,
    created_at: new Date().toISOString()
  };
  inMemorySessions = [newSession, ...inMemorySessions];
  return newSession;
};

export const deleteSession = (id: string): void => {
  inMemorySessions = inMemorySessions.filter(s => s.id !== id);
  inMemoryMessages = inMemoryMessages.filter(m => m.session_id !== id);
};

export const updateSessionTitle = (id: string, title: string): void => {
  inMemorySessions = inMemorySessions.map(s => s.id === id ? { ...s, title } : s);
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES HELPERS (In-Memory fallback; Client handles full LocalStorage sync)
// ─────────────────────────────────────────────────────────────────────────────
export const getMessagesBySession = (sessionId: string): DbMessage[] => {
  const filtered = inMemoryMessages.filter(m => m.session_id === sessionId);
  if (filtered.length === 0) {
    return [{
      id: 'msg_welcome_' + sessionId,
      session_id: sessionId,
      sender: 'ai',
      text: "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
      suggest_model: null,
      suggest_label: null,
      created_at: new Date().toISOString()
    }];
  }
  return filtered;
};

export const addMessage = (
  id: string,
  sessionId: string,
  sender: 'user' | 'ai',
  text: string,
  suggestModel: string | null = null,
  suggestLabel: string | null = null
): DbMessage => {
  const newMsg: DbMessage = {
    id,
    session_id: sessionId,
    sender,
    text,
    suggest_model: suggestModel,
    suggest_label: suggestLabel,
    created_at: new Date().toISOString()
  };
  inMemoryMessages.push(newMsg);
  return newMsg;
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATED MODELS HELPERS (Deprecated — routes now use direct R2 metadata)
// ─────────────────────────────────────────────────────────────────────────────
export const getGeneratedModels = (): DbGeneratedModel[] => {
  console.warn('[Database] getGeneratedModels is deprecated. Please fetch from `/api/models` (R2).');
  return [];
};

export const createGeneratedModel = (
  id: string,
  topic: string,
  prompt: string,
  modelUrl: string,
  imageUrl: string | null = null,
  title: string | null = null,
  userId: string | null = null
): DbGeneratedModel => {
  console.warn('[Database] createGeneratedModel is deprecated. Please write directly to R2.');
  return {
    id,
    topic,
    prompt,
    model_url: modelUrl,
    image_url: imageUrl,
    title,
    user_id: userId,
    created_at: new Date().toISOString()
  };
};

export const deleteGeneratedModel = (id: string): void => {
  console.warn('[Database] deleteGeneratedModel is deprecated. Please delete directly from R2.');
};

export default null;
