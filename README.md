# Spur – Mini AI Live Chat Agent

This repo implements the take-home assignment for a founding full‑stack engineer at Spur: a small web app with a live chat widget where an AI support agent answers customer questions.

The stack is:

- **Backend**: Node.js, TypeScript, Express, SQLite (via `better-sqlite3`)
- **Frontend**: React + Vite (similar concepts to the React part of MERN)
- **LLM**: OpenAI Chat Completions API

---

## 1. How to Run It Locally

### 1.1. Prerequisites

- Node.js 18+ installed
- An OpenAI API key (for example from the `gpt-4o-mini` model family)

### 1.2. Backend (API + DB + LLM)

From the project root:

```bash
cd backend
npm install
```

Create a `.env` file inside `backend`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
PORT=4000
```

Run the DB migration (creates SQLite tables):

```bash
npm run migrate
```

Start the backend in dev mode:

```bash
npm run dev
```

The API will run at `http://localhost:4000`.

### 1.3. Frontend (Chat UI)

In a second terminal, from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`) in your browser.

You should see the **Spur Store Support** chat panel. Type messages like:

- “What is your return policy?”
- “Do you ship to USA?”
- “How long do refunds take?”

The AI should answer using the seeded FAQ knowledge.

---

## 2. API Endpoints

### `POST /chat/message`

- **Request body**:

```json
{
  "message": "What is your return policy?",
  "sessionId": "optional-session-id"
}
```

- **Response**:

```json
{
  "reply": "AI reply text here",
  "sessionId": "generated-or-existing-session-id"
}
```

Behavior:

- Creates a new conversation if `sessionId` is missing.
- Persists the user message and AI reply to SQLite.
- Calls OpenAI with a system prompt + last N messages as history.
- Returns a friendly error message (still 200) if the LLM call fails OR if the API key is not set.

### `GET /chat/history/:sessionId`

- **Response** (example):

```json
{
  "sessionId": "abc-123",
  "createdAt": 1735532610000,
  "messages": [
    { "sender": "user", "text": "Do you ship to USA?", "created_at": 1735532610000 },
    { "sender": "ai", "text": "Yes, we ship worldwide...", "created_at": 1735532611000 }
  ]
}
```

Used by the frontend on page load to restore the previous chat given a stored `sessionId`.

### `GET /health`

Simple health check (`{ "status": "ok" }`).

---

## 3. Data Model & Persistence

Database: **SQLite** file at `backend/data/chat.sqlite`.

Tables (created in `backend/src/db/migrate.ts`):

- **`conversations`**
  - `id` (TEXT, primary key, sessionId)
  - `created_at` (INTEGER, timestamp in ms)

- **`messages`**
  - `id` (INTEGER, primary key autoincrement)
  - `conversation_id` (TEXT, FK → `conversations.id`)
  - `sender` (TEXT: `"user"` or `"ai"`)
  - `text` (TEXT)
  - `created_at` (INTEGER, timestamp in ms)

On **every request** to `POST /chat/message`:

1. Validate message (non-empty, max length).
2. Create a conversation row if there is no `sessionId`.
3. Insert the user message into `messages`.
4. Load recent `messages` for this conversation as history.
5. Call the LLM with `(system prompt + history + latest user message)`.
6. Insert the AI reply into `messages`.
7. Return `{ reply, sessionId }`.

---

## 4. LLM Integration & FAQ Knowledge

File: `backend/src/llm.ts`

- Uses the official `openai` Node SDK.
- Wraps calls in a single function:

```ts
generateReply(history, userMessage) => Promise<string>
```

**System prompt** (summarized):

- “You are a helpful support agent for a small e‑commerce store called Spur Store.”
- Answer clearly and concisely.
- Contains fixed FAQ knowledge about:
  - Shipping: worldwide, 5–7 business days domestic, 7–14 international.
  - Returns: 30 days, unused items, refunds in 5–7 business days.
  - Refunds to original payment method.
  - Support hours: Mon–Fri, 9am–6pm IST, email `support@spurstore.test`.
- If the question is unrelated to shopping, tell the user you’re a simple support bot and suggest talking to human support.

**Guardrails / error handling**:

- If `OPENAI_API_KEY` is missing, `generateReply` returns a static “AI unavailable” message instead of throwing.
- Any thrown errors from the OpenAI client are caught and transformed into a user-friendly error string.
- Max tokens and temperature are capped for predictable and inexpensive responses.

---

## 5. Frontend Chat UI

Location: `frontend/src`

Key component: `App.tsx`

- Maintains:
  - `messages` (array of `{ sender, text, created_at? }`)
  - `sessionId` (string | null) – persisted in `localStorage`
  - `input`, `isSending`, `error`
- On initial load:
  - Reads `sessionId` from `localStorage`.
  - If found, calls `GET /chat/history/:sessionId` and pre-populates `messages`.
  - If history fetch fails (e.g., server cleared DB), it clears the stored `sessionId`.
- On send:
  - Validates the input is not empty.
  - Shows the user message immediately (optimistic UI).
  - Disables the send button and shows an “AI typing…” indicator while waiting.
  - Calls `POST /chat/message`.
  - On success:
    - Stores the new `sessionId` (if any) in `localStorage`.
    - Appends the AI’s reply to `messages`.
  - On error:
    - Shows a clear error banner above the input.
- UX niceties:
  - Auto-scroll to the latest message.
  - Distinct visual styling for user vs AI messages.
  - Examples shown when the chat is empty.
  - “Online” status pill in the header.

---

## 6. Robustness & Input Validation

- **Backend**:
  - Rejects empty messages with `400` and a JSON error.
  - Rejects messages > 4000 characters with a friendly validation error.
  - Wraps LLM calls in try/catch and always returns a safe fallback message.
  - Never throws unhandled errors for malformed input.
- **Frontend**:
  - Disables send button while a message is in flight.
  - Trims whitespace-only messages and prevents sending them.
  - Shows a red error banner for validation or network errors.
  - Continues to work even if LLM fails (because backend sends a friendly fallback string).

**No secrets are committed** – you must supply your own `OPENAI_API_KEY` in `.env`.

---

## 7. Architecture Overview

High-level layering:

- **Routes / HTTP**
  - `backend/src/index.ts` – Express app, defines:
    - `POST /chat/message`
    - `GET /chat/history/:sessionId`
    - `GET /health`
- **LLM Service**
  - `backend/src/llm.ts` – contains all OpenAI-specific logic behind `generateReply`.
  - Makes it easy to swap in Anthropic/Claude or other providers later.
- **Data / Persistence**
  - `backend/src/db/index.ts` – opens the SQLite database.
  - `backend/src/db/migrate.ts` – creates tables.
  - Routes use prepared statements for inserts/selects.
- **Frontend UI**
  - `frontend/src/App.tsx` – the chat widget UI, relatively self-contained.
  - `frontend/src/styles.css` – styling and layout (widget-like panel in the center).

This makes it straightforward to:

- Add more channels (WhatsApp, IG) by reusing the same LLM and DB services with new route handlers.
- Swap or augment the LLM (e.g., add tools, retrieval) inside `llm.ts` without touching UI or routing.

---

## 8. LLM Notes

- **Provider**: OpenAI
- **Model**: `gpt-4o-mini` (small, fast, good enough for support-style answers)
- **Prompting**:
  - Single system prompt for persona + FAQ.
  - Append last N messages + current user message.
  - Moderate temperature for stable, support‑like responses.
- **Trade-offs**:
  - SQLite is simple and file-based – perfect for a take-home and easy local setup; in production we’d likely use PostgreSQL.
  - For time reasons, I avoided a full ORM like Prisma and used `better-sqlite3` directly to keep the data layer compact and explicit.
  - The chat UI is a single-page widget instead of a full multi-page app, focusing effort on the core experience.

---

## 9. If I Had More Time…

- Add **pagination** or a “load earlier messages” control for very long conversations.
- Improve **typing indicators** using server-sent events or WebSockets for more real-time feel.
- Add **streaming responses** from the LLM so tokens appear gradually.
- Implement **rate limiting** and basic abuse protection on the backend.
- Extract a small **SDK-style client** for the chat API so other channels (WhatsApp, Instagram, etc.) can call the same backend cleanly.


