import Database from 'better-sqlite3';
import path from 'path';

// Store the SQLite database file in the project workspace root
const dbPath = path.resolve(process.cwd(), 'medvis.db');
const db = new Database(dbPath);

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
    suggest_model TEXT, -- 'heart' | 'brain' | 'lungs'
    suggest_label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`);

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

// Database helper functions
export const getSessions = (): DbSession[] => {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
  return stmt.all() as DbSession[];
};

export const createSession = (id: string, title: string, modelType: string = 'general'): DbSession => {
  const stmt = db.prepare('INSERT INTO sessions (id, title, model_type) VALUES (?, ?, ?)');
  stmt.run(id, title, modelType);
  return { id, title, model_type: modelType, created_at: new Date().toISOString() };
};

export const deleteSession = (id: string) => {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(id);
};

export const getMessagesBySession = (sessionId: string): DbMessage[] => {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId) as DbMessage[];
};

export const addMessage = (
  id: string,
  sessionId: string,
  sender: 'user' | 'ai',
  text: string,
  suggestModel: string | null = null,
  suggestLabel: string | null = null
): DbMessage => {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, sender, text, suggest_model, suggest_label) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, sessionId, sender, text, suggestModel, suggestLabel);
  return {
    id,
    session_id: sessionId,
    sender,
    text,
    suggest_model: suggestModel,
    suggest_label: suggestLabel,
    created_at: new Date().toISOString()
  };
};

export const updateSessionTitle = (id: string, title: string) => {
  const stmt = db.prepare('UPDATE sessions SET title = ? WHERE id = ?');
  stmt.run(title, id);
};

export default db;
