import type { StoredMessage, ChatSummary, SummaryReport } from "./types.js";
import { getMessages, getAllChats, getMentions } from "./store.js";

const PROVIDER = (process.env.AI_PROVIDER ?? "openai").toLowerCase();

const SYSTEM_PROMPT =
  "You are a concise assistant that summarizes WhatsApp group conversations for a busy engineering team lead. " +
  "Focus on: decisions made, blockers, action items, and important updates. " +
  "Keep the summary under 150 words. Use bullet points. Be direct and skip filler.";

const QUERY_SYSTEM_PROMPT =
  "You are a helpful assistant for a dev team lead. You have access to their WhatsApp messages. " +
  "Answer their questions accurately based only on the messages provided. " +
  "If the answer is not in the messages, say so clearly. Be concise and direct. " +
  "When listing messages, include the time, chat name, and sender.";

// ── Lazy-load the right client ───────────────────────────────────
async function callAI(userPrompt: string, systemPrompt: string = SYSTEM_PROMPT): Promise<string> {
  if (PROVIDER === "claude") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const msg = await stream.finalMessage();
    const block = msg.content.find((b) => b.type === "text");
    return block?.type === "text" ? block.text : "Could not generate response.";
  } else {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return res.choices[0]?.message?.content ?? "Could not generate response.";
  }
}

// ── Public API ───────────────────────────────────────────────────
export async function generateReport(hoursBack: number): Promise<SummaryReport> {
  const sinceMs = Date.now() - hoursBack * 60 * 60 * 1000;
  const chatNames = getAllChats();
  const allMentions = getMentions(sinceMs);

  const chatSummaries: ChatSummary[] = [];
  let totalMessages = 0;

  for (const chatName of chatNames) {
    const msgs = getMessages(sinceMs, chatName);
    if (msgs.length === 0) continue;

    totalMessages += msgs.length;
    const mentions = msgs.filter((m) => m.isMention);
    const summary = await summarizeChat(chatName, msgs);

    chatSummaries.push({ chatName, messageCount: msgs.length, summary, mentions });
  }

  return { generatedAt: new Date(), hoursBack, totalMessages, chatSummaries, allMentions };
}

async function summarizeChat(chatName: string, msgs: StoredMessage[]): Promise<string> {
  if (msgs.length === 0) return "No messages.";

  const formatted = msgs
    .map((m) => {
      const time = new Date(m.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `[${time}] ${m.sender}: ${m.body}`;
    })
    .join("\n");

  return callAI(`Summarize the following WhatsApp conversation from "${chatName}":\n\n${formatted}`);
}

export interface SendIntent {
  isSend: true;
  to: string;
  message: string;
}
export interface QueryIntent {
  isSend: false;
}

/**
 * Detect if the user's input is a send-message request.
 * Returns the recipient and message body if so.
 */
export async function detectSendIntent(input: string): Promise<SendIntent | QueryIntent> {
  const prompt =
    `The user typed: "${input}"\n\n` +
    `Is this a request to SEND a WhatsApp message or file to someone?\n` +
    `If YES, reply with ONLY valid JSON:\n` +
    `  Text: {"isSend": true, "to": "<name>", "message": "<text>"}\n` +
    `  File: {"isSend": true, "to": "<name>", "message": "<filepath>", "caption": "<optional caption>"}\n` +
    `If NO, reply with ONLY: {"isSend": false}\n` +
    `No explanation. JSON only.`;

  const system = "You extract send-message intent from user input. Reply only with JSON.";
  const raw = await callAI(prompt, system);

  try {
    const parsed = JSON.parse(raw.trim());
    return parsed as SendIntent | QueryIntent;
  } catch {
    return { isSend: false };
  }
}

/**
 * Answer a free-form question about stored messages (last 24h).
 */
export async function queryMessages(question: string): Promise<string> {
  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  const allMsgs = getMessages(sinceMs);

  if (allMsgs.length === 0) {
    return "No messages collected yet. Messages are stored as they arrive after the agent starts.";
  }

  // Format all messages with chat context
  const formatted = allMsgs
    .map((m) => {
      const time = new Date(m.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const tag = m.isGroupMsg ? `[${m.chatName}]` : "[DM]";
      return `${tag} [${time}] ${m.sender}: ${m.body}`;
    })
    .join("\n");

  const prompt =
    `You have the following WhatsApp messages from the last 24 hours:\n\n${formatted}\n\n` +
    `User's question: ${question}`;

  return callAI(prompt, QUERY_SYSTEM_PROMPT);
}
