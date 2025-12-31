import "dotenv/config";
import express from "express";
import cors from "cors";
import { db } from "./db";
import { generateReply, ChatMessage } from "./llm";
import { randomUUID } from "crypto";

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = [
  "http://localhost:5173",  // Local development
  "https://spur-chat-n0mct4ovq-sharanya-bhat-ns-projects.vercel.app"  // Your Vercel URL
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
  }));
app.use(express.json());

interface ChatRequestBody {
  message: string;
  sessionId?: string;
}

app.post("/chat/message", async (req, res) => {
  try {
    const body: ChatRequestBody = req.body;
    const rawMessage = body.message ?? "";

    const message = rawMessage.trim();
    if (!message) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error:
          "Message is too long. Please keep it under 4000 characters so our agent can handle it."
      });
    }

    let sessionId = body.sessionId;
    const now = Date.now();

    // Create conversation if needed
    if (!sessionId) {
      sessionId = randomUUID();
      const stmt = db.prepare(
        "INSERT INTO conversations (id, created_at) VALUES (?, ?)"
      );
      stmt.run(sessionId, now);
    }

    // Insert user message
    const insertMessageStmt = db.prepare(
      "INSERT INTO messages (conversation_id, sender, text, created_at) VALUES (?, ?, ?, ?)"
    );
    insertMessageStmt.run(sessionId, "user", message, now);

    // Fetch some history for context
    const historyStmt = db.prepare(
      "SELECT sender, text FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20"
    );
    const rows = historyStmt.all(sessionId) as {
      sender: string;
      text: string;
    }[];

    const history: ChatMessage[] = rows.map((row) => ({
      role: row.sender === "user" ? "user" : "assistant",
      content: row.text
    }));

    const replyText = await generateReply(history, message);

    // Save AI reply
    insertMessageStmt.run(sessionId, "ai", replyText, Date.now());

    return res.json({ reply: replyText, sessionId });
  } catch (err) {
    console.error("Error in /chat/message:", err);
    return res.status(500).json({
      error:
        "Something went wrong on our side while processing your message. Please try again in a moment."
    });
  }
});

// Fetch conversation history by sessionId
app.get("/chat/history/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;

    const convStmt = db.prepare(
      "SELECT id, created_at FROM conversations WHERE id = ?"
    );
    const conv = convStmt.get(sessionId) as
      | { id: string; created_at: number }
      | undefined;
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const msgsStmt = db.prepare(
      "SELECT sender, text, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    );
    const rows = msgsStmt.all(sessionId) as {
      sender: string;
      text: string;
      created_at: number;
    }[];

    return res.json({
      sessionId,
      createdAt: conv.created_at,
      messages: rows
    });
  } catch (err) {
    console.error("Error in /chat/history:", err);
    return res.status(500).json({
      error:
        "Something went wrong while loading your past messages. Please refresh and try again."
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});


