import React, { useEffect, useRef, useState } from "react";

type Sender = "user" | "ai";

 const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
   ?.trim()
   .replace(/\/+$/, "");

 function apiUrl(path: string) {
   if (!API_BASE_URL) return path;
   return `${API_BASE_URL}${path}`;
 }

interface Message {
  sender: Sender;
  text: string;
  created_at?: number;
}

interface HistoryResponse {
  sessionId: string;
  createdAt: number;
  messages: Message[];
}

const STORAGE_KEY = "spur-chat-session-id";

export const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load previous session from localStorage
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const id = saved;
      setSessionId(id);
      fetch(apiUrl(`/chat/history/${id}`))
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("Failed to load history");
          }
          const data: HistoryResponse = await res.json();
          setMessages(data.messages);
        })
        .catch((err) => {
          console.error(err);
          // If history fails, just clear session
          window.localStorage.removeItem(STORAGE_KEY);
          setSessionId(null);
        });
    }
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);

    // Optimistically add user message to UI
    const optimisticMessage: Message = { sender: "user", text: trimmed };
    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");

    try {
      const res = await fetch(apiUrl("/chat/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionId ?? undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        const friendlyError =
          data?.error ||
          "Something went wrong while sending your message. Please try again.";
        setError(friendlyError);
        // Roll back optimistic message? For now, keep it but mark error.
        return;
      }

      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
        window.localStorage.setItem(STORAGE_KEY, data.sessionId);
      }

      const aiMessage: Message = { sender: "ai", text: data.reply };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      setError(
        "Network error while talking to the agent. Please check your connection and try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-root">
      <div className="chat-container">
        <header className="chat-header">
          <div>
            <h1>Spur Store Support</h1>
            <p>Ask about shipping, returns, refunds, or anything else.</p>
          </div>
          <span className="status-pill">Online</span>
        </header>

        <div className="chat-body">
          <div className="messages-list">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>Welcome! Ask something like:</p>
                <ul>
                  <li>“What is your return policy?”</li>
                  <li>“Do you ship to the USA?”</li>
                  <li>“How long do refunds take?”</li>
                </ul>
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`message-row ${
                  m.sender === "user" ? "from-user" : "from-ai"
                }`}
              >
                <div className="avatar">
                  {m.sender === "user" ? "You" : "AI"}
                </div>
                <div className="bubble">
                  <p>{m.text}</p>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="message-row from-ai typing">
                <div className="avatar">AI</div>
                <div className="bubble typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            className="chat-input"
            placeholder="Type your question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            type="submit"
            className="send-button"
            disabled={isSending || !input.trim()}
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </form>
        <footer className="chat-footer">
          <small>Powered by Spur demo agent</small>
        </footer>
      </div>
    </div>
  );
};


