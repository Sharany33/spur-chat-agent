import { db } from "./index";

// Simple migration script to create tables if they don't exist
const createConversations = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
`;

const createMessages = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
`;

db.exec("BEGIN");
db.exec(createConversations);
db.exec(createMessages);
db.exec("COMMIT");

console.log("Migrations applied successfully.");


