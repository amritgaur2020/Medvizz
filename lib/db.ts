import path from 'path';

let db: any = null;

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

// In-memory fallbacks for serverless environments (Vercel)
let inMemorySessions: DbSession[] = [];
let inMemoryMessages: DbMessage[] = [];
let inMemoryModels: DbGeneratedModel[] = [];

try {
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(process.cwd(), 'medvis.db');
  db = new Database(dbPath);

  // Enable WAL mode for high performance and concurrent read/writes
  db.pragma('journal_mode = WAL');

  // Initialize schema on startup
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model_type TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sender TEXT NOT NULL, -- 'user' or 'ai'
      text TEXT NOT NULL,
      suggest_model TEXT, -- 'heart' | 'brain' | 'lungs' | 'kidneys'
      suggest_label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_models (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model_url TEXT NOT NULL,
      image_url TEXT,
      title TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema migration: Add image_url, title, and user_id columns if they don't exist
  try {
    db.exec(`ALTER TABLE generated_models ADD COLUMN image_url TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE generated_models ADD COLUMN title TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE generated_models ADD COLUMN user_id TEXT;`);
  } catch (_) {}

  console.log('[SQLite] Connected and schema initialized successfully.');
} catch (err) {
  console.warn('[SQLite] Warning: better-sqlite3 not loaded. Running in in-memory serverless mode.', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const getSessions = (): DbSession[] => {
  if (!db) {
    if (inMemorySessions.length === 0) {
      // Seed a default session if empty
      inMemorySessions.push({
        id: 'session_default',
        title: 'MedVis AI Clinical Sandbox',
        model_type: 'general',
        created_at: new Date().toISOString()
      });
    }
    return inMemorySessions;
  }
  try {
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    return stmt.all() as DbSession[];
  } catch (err) {
    console.error('Error in getSessions:', err);
    return inMemorySessions;
  }
};

export const createSession = (id: string, title: string, modelType: string = 'general'): DbSession => {
  const newSession: DbSession = {
    id,
    title,
    model_type: modelType,
    created_at: new Date().toISOString()
  };
  if (!db) {
    inMemorySessions = [newSession, ...inMemorySessions];
    return newSession;
  }
  try {
    const stmt = db.prepare('INSERT INTO sessions (id, title, model_type) VALUES (?, ?, ?)');
    stmt.run(id, title, modelType);
    return newSession;
  } catch (err) {
    console.error('Error in createSession:', err);
    inMemorySessions = [newSession, ...inMemorySessions];
    return newSession;
  }
};

export const deleteSession = (id: string): void => {
  if (!db) {
    inMemorySessions = inMemorySessions.filter(s => s.id !== id);
    inMemoryMessages = inMemoryMessages.filter(m => m.session_id !== id);
    return;
  }
  try {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  } catch (err) {
    console.error('Error in deleteSession:', err);
    inMemorySessions = inMemorySessions.filter(s => s.id !== id);
    inMemoryMessages = inMemoryMessages.filter(m => m.session_id !== id);
  }
};

export const updateSessionTitle = (id: string, title: string): void => {
  if (!db) {
    inMemorySessions = inMemorySessions.map(s => s.id === id ? { ...s, title } : s);
    return;
  }
  try {
    const stmt = db.prepare('UPDATE sessions SET title = ? WHERE id = ?');
    stmt.run(title, id);
  } catch (err) {
    console.error('Error in updateSessionTitle:', err);
    inMemorySessions = inMemorySessions.map(s => s.id === id ? { ...s, title } : s);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const getMessagesBySession = (sessionId: string): DbMessage[] => {
  if (!db) {
    const filtered = inMemoryMessages.filter(m => m.session_id === sessionId);
    if (filtered.length === 0) {
      // Seed default welcome message
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
  }
  try {
    const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
    return stmt.all(sessionId) as DbMessage[];
  } catch (err) {
    console.error('Error in getMessagesBySession:', err);
    return inMemoryMessages.filter(m => m.session_id === sessionId);
  }
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
  if (!db) {
    inMemoryMessages.push(newMsg);
    return newMsg;
  }
  try {
    const stmt = db.prepare(`
      INSERT INTO messages (id, session_id, sender, text, suggest_model, suggest_label) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, sender, text, suggestModel, suggestLabel);
    return newMsg;
  } catch (err) {
    console.error('Error in addMessage:', err);
    inMemoryMessages.push(newMsg);
    return newMsg;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATED MODELS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const getGeneratedModels = (): DbGeneratedModel[] => {
  if (!db) {
    return inMemoryModels;
  }
  try {
    const stmt = db.prepare('SELECT * FROM generated_models ORDER BY created_at DESC');
    return stmt.all() as DbGeneratedModel[];
  } catch (err) {
    console.error('Error in getGeneratedModels:', err);
    return inMemoryModels;
  }
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
  const newModel: DbGeneratedModel = {
    id,
    topic,
    prompt,
    model_url: modelUrl,
    image_url: imageUrl,
    title,
    user_id: userId,
    created_at: new Date().toISOString()
  };
  if (!db) {
    inMemoryModels = [newModel, ...inMemoryModels];
    return newModel;
  }
  try {
    const stmt = db.prepare('INSERT INTO generated_models (id, topic, prompt, model_url, image_url, title, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, topic, prompt, modelUrl, imageUrl, title, userId);
    return newModel;
  } catch (err) {
    console.error('Error in createGeneratedModel:', err);
    inMemoryModels = [newModel, ...inMemoryModels];
    return newModel;
  }
};

export const deleteGeneratedModel = (id: string): void => {
  if (!db) {
    inMemoryModels = inMemoryModels.filter(m => m.id !== id);
    return;
  }
  try {
    const stmt = db.prepare('DELETE FROM generated_models WHERE id = ?');
    stmt.run(id);
  } catch (err) {
    console.error('Error in deleteGeneratedModel:', err);
    inMemoryModels = inMemoryModels.filter(m => m.id !== id);
  }
};

export default db;
