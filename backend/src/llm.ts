import OpenAI from "openai";

const SYSTEM_PROMPT = `
You are a helpful support agent for a small e-commerce store called Spur Store.
Answer clearly and concisely in 2-4 sentences.

Store FAQs:
- Shipping: We ship worldwide. Standard shipping takes 5-7 business days within the country and 7-14 business days for international orders.
- Returns: We accept returns within 30 days of delivery for unused items in original packaging. Refunds are processed within 5-7 business days after we receive the returned item.
- Refunds: Refunds are issued to the original payment method only.
- Support Hours: Our live support is available Monday to Friday, 9am–6pm IST. You can email us any time at support@spurstore.test.

If you are unsure or the user asks something unrelated to shopping, politely say you are a simple support bot and suggest contacting human support.
`;

// Lazily create the OpenAI client only if the API key is present,
// so the server can still start without crashing.
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateReply(
  history: ChatMessage[],
  userMessage: string
): Promise<string> {
  if (!openai || !process.env.OPENAI_API_KEY) {
    return "Our AI agent is currently unavailable because the API key is not configured. Please contact human support at support@spurstore.test.";
  }

  // Basic guardrails on input length
  const truncatedUserMessage =
    userMessage.length > 1000 ? userMessage.slice(0, 1000) : userMessage;

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.slice(-10), // keep last 10 exchanges
    { role: "user" as const, content: truncatedUserMessage }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.4
    });

    const reply =
      response.choices[0]?.message?.content ??
      "Sorry, I couldn't generate a response just now. Please try again.";

    return reply;
  } catch (err) {
    console.error("LLM error:", err);
    return "Sorry, our AI agent ran into a problem. Please try again in a moment or contact human support at support@spurstore.test.";
  }
}


