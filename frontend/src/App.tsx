import React, { useEffect, useRef, useState } from "react";
import { v4 as randomUUID } from "uuid";

type Sender = "user" | "ai";

interface ChatSession {
  id: string;
  preview: string;
  timestamp: number;
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
const CHAT_HISTORY_KEY = "spur-chat-history";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

function apiUrl(path: string) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

export const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat sessions and current session from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedSessions) {
      setChatSessions(JSON.parse(savedSessions));
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const id = saved;
      setSessionId(id);
      fetch(apiUrl(`/chat/history/${id}`))
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load history");
          const data: HistoryResponse = await res.json();
          setMessages(data.messages);
        })
        .catch((err) => {
          console.error(err);
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
          sessionId: sessionId ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const friendlyError =
          data?.error ||
          "Something went wrong while sending your message. Please try again.";
        setError(friendlyError);
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

  const startNewChat = () => {
    if (messages.length > 0) {
      const newSession = {
        id: sessionId || randomUUID(),
        preview: messages[0]?.text || "New Chat",
        timestamp: Date.now(),
      };

      const updatedSessions = [
        newSession,
        ...chatSessions.filter((s) => s.id !== newSession.id),
      ].slice(0, 5);
      setChatSessions(updatedSessions);
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updatedSessions));
    }

    setSessionId(null);
    setMessages([]);
    window.localStorage.removeItem(STORAGE_KEY);
    setError(null);
    setShowHistory(false);
  };

  const handleChatHistoryClick = (session: ChatSession) => {
    const updatedSession = {
      ...session,
      timestamp: Date.now(),
    };

    // Move the clicked session to the top
    const otherSessions = chatSessions.filter((s) => s.id !== session.id);
    const updatedSessions = [updatedSession, ...otherSessions];

    setChatSessions(updatedSessions);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updatedSessions));

    setSessionId(session.id);
    setMessages([]);
    window.localStorage.setItem(STORAGE_KEY, session.id);
    setShowHistory(false);

    fetch(apiUrl(`/chat/history/${session.id}`))
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
        }
      });
  };

  // Close history when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".chat-history-container") &&
        !target.closest(".new-chat-button")
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="app-root">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <div className="site-shell">
        <header className="site-header">
          <div className="site-brand">
            <div className="site-logo-orb">
              <img
                src="/assets/spur-logo.jpg"
                alt="Spur Logo"
                style={{ width: "45px", height: "45px", objectFit: "fill" }}
              />
            </div>
            <div className="site-brand-text">
              <div className="site-brand-name">SPUR Chat Agent</div>
              <div className="site-brand-subtitle">Your AI Shopping Assistant</div>
            </div>
          </div>

          <div className="site-header-meta">
            <span className="status-pill">
              <span className="status-dot"></span>
              Online
            </span>
          </div>
        </header>

        {/* Main content: hero + chat */}
        <main className="site-main">
          {/* Left side: marketing / context */}
          <section className="hero-section">
            
            <h1 className="hero-title">
              Spur Support Agent
              <span className="title-accent">(Demo)</span>
            </h1>

            <p className="hero-subtitle">
              Sell more. Support better. Automate everything.
            </p>

            <p className="hero-description">
              The Spur assistant replies instantly — like a teammate who knows
              your entire catalog. Get instant answers 24/7.
            </p>

            <div className="hero-highlights">
              <div className="hero-card">
                
                <h3>What you can ask</h3>
                <ul>
                  <li onClick={() => setInput("What is your return policy?")}>
                    <span className="list-icon">→</span>What is your return policy?
                  </li>
                  <li onClick={() => setInput("Do you ship to the USA?")}>
                    <span className="list-icon">→</span>Do you ship to the USA?
                  </li>
                  <li onClick={() => setInput("How long do refunds take?")}>
                    <span className="list-icon">→</span>How long do refunds take?
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Right side: the actual chat app */}
          <section className="chat-section">
            <div className="chat-container">
              <header className="chat-header">
                <div className="chat-header-main">
                  <div className="chat-avatar-badge">
                    <span className="avatar-icon">🤖</span>
                  </div>
                  <div>
                   <h2>Spur Store Support</h2>
      <div className="chat-session-info">
        <span>Web Chat</span>
        <span className="divider">•</span>
        <span>Session #{sessionId ? sessionId.substring(0, 4).toUpperCase() : 'NEW'}</span>
       
      </div>
    </div>
  </div>

                <div className="header-actions">
                  <div className="chat-history-container">
                    <button
                      className="new-chat-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHistory(!showHistory);
                      }}
                    >
                      <span className="button-icon">💬</span>
                      {sessionId ? "Chats" : "New Chat"}
                    </button>
                    {showHistory && (
                      <div className="chat-history-dropdown">
                        <div
                          className="chat-history-item new-chat"
                          onClick={startNewChat}
                        >
                          <span className="new-chat-icon">+</span>
                          Start New Chat
                        </div>
                        {chatSessions.map((session) => (
                          <div
                            key={`${session.id}-${session.timestamp}`}
                            className={`chat-history-item ${
                              session.id === sessionId ? "active" : ""
                            }`}
                            onClick={() => handleChatHistoryClick(session)}
                          >
                            <div className="chat-preview">
                              {session.preview.length > 40
                                ? `${session.preview.substring(0, 40)}...`
                                : session.preview}
                            </div>
                            <div className="chat-time">
                              {new Date(
                                session.timestamp
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="chat-body">
                <div className="messages-list">
                  {messages.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">👋</div>
                      <p className="empty-title">Hi, How can we help today?</p>
                      
                      
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
                        {m.sender === "user" ? "👤" : "🤖"}
                      </div>
                      <div className="bubble">
                        <p>{m.text}</p>
                        <span className="message-time">
                          {new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {isSending && (
                    <div className="message-row from-ai typing">
                      <div className="avatar">🤖</div>
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

              {error && (
                <div className="error-banner">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              <form
                className="chat-input-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <textarea
                  className="chat-input"
                  placeholder="Type your message here..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={isSending || !input.trim()}
                >
                  {isSending ? (
                    <>
                      <span className="button-spinner"></span>
                      Sending
                    </>
                  ) : (
                    <>
                      Send
                      <span className="send-icon">→</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-content">
            <span>© {new Date().getFullYear()} Spur — AI Chat Agent</span>
           
          </div>
        </footer>
      </div>
    </div>
  );
};