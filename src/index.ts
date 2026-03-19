import "dotenv/config";
import fs from "fs";
import path from "path";
// Polyfill all missing Web API globals for Node 16 in one shot
import { fetch, Headers, Request, Response, FormData } from "undici";
Object.assign(globalThis, { fetch, Headers, Request, Response, FormData });
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg as any;
import qrcode from "qrcode-terminal";
import chalk from "chalk";
import { addMessage } from "./store.js";
import { generateReport, queryMessages, detectSendIntent } from "./summarizer.js";
import { printReport } from "./reporter.js";
import type { StoredMessage } from "./types.js";

// ── Config ──────────────────────────────────────────────────────
const MY_NAME = (process.env.MY_NAME ?? "").toLowerCase();
const MY_PHONE = process.env.MY_PHONE ?? "";
const SUMMARY_HOURS = parseInt(process.env.SUMMARY_HOURS ?? "8", 10);
const WATCH_CHATS = process.env.WATCH_CHATS
  ? process.env.WATCH_CHATS.split(",").map((s) => s.trim().toLowerCase())
  : [];

const AI_PROVIDER = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
if (AI_PROVIDER === "claude" && !process.env.ANTHROPIC_API_KEY) {
  console.error(chalk.red("✗ ANTHROPIC_API_KEY is not set. Add it to .env to use Claude."));
  process.exit(1);
}
if (AI_PROVIDER !== "claude" && !process.env.OPENAI_API_KEY) {
  console.error(chalk.red("✗ OPENAI_API_KEY is not set. Add it to .env to use OpenAI."));
  process.exit(1);
}
console.log(chalk.gray(`  AI provider: ${AI_PROVIDER === "claude" ? "Claude (Anthropic)" : "GPT-4o-mini (OpenAI)"}`));

// ── WhatsApp client ─────────────────────────────────────────────
const wa = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wa-session" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  },
});

wa.on("qr", (qr: string) => {
  console.log(chalk.bold.cyan("\n📱 Scan this QR code with WhatsApp → Linked Devices:\n"));
  qrcode.generate(qr, { small: true });
});

wa.on("authenticated", () => {
  console.log(chalk.green("✓ Authenticated — session saved"));
});

wa.on("auth_failure", (msg: string) => {
  console.error(chalk.red("✗ Auth failed:", msg));
  process.exit(1);
});

wa.on("ready", async () => {
  console.log(chalk.bold.green("\n✓ WhatsApp connected and listening!"));
  await loadHistory();
  printHelp();
});

wa.on("disconnected", (reason: string) => {
  console.log(chalk.red("✗ Disconnected:", reason));
});

// ── Message handler ─────────────────────────────────────────────
wa.on("message", async (msg: any) => {
  try {
    const chat = await msg.getChat();
    const chatName = chat.name || msg.from;

    // Filter to watched chats if configured
    if (WATCH_CHATS.length > 0) {
      const normalised = chatName.toLowerCase();
      if (!WATCH_CHATS.some((w) => normalised.includes(w))) return;
    }

    const contact = await msg.getContact();
    const sender = contact.pushname || contact.name || msg.author || msg.from;
    const senderPhone = contact.number ?? msg.from.replace("@c.us", "");
    const body = msg.body;

    // Detect if the message mentions the user (by name or phone)
    const mentionedIds: string[] = msg.mentionedIds ?? [];
    const isMentionedById = MY_PHONE
      ? mentionedIds.some((id) => id.includes(MY_PHONE))
      : false;
    const isMentionedByName =
      MY_NAME.length > 0 && body.toLowerCase().includes(MY_NAME);
    const isMention = isMentionedById || isMentionedByName;

    const stored: StoredMessage = {
      id: msg.id._serialized,
      chatName,
      chatId: chat.id._serialized,
      sender,
      senderPhone,
      body,
      timestamp: msg.timestamp * 1000, // whatsapp-web gives seconds
      isMention,
      isGroupMsg: chat.isGroup,
    };

    addMessage(stored);

    // Notify immediately on mention
    if (isMention) {
      const timeStr = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      console.log(
        chalk.bold.yellow(`\n🔔 [${timeStr}] Mention in ${chatName}`) +
          chalk.cyan(` — ${sender}`) +
          ": " +
          chalk.white(body)
      );
    }
  } catch (err) {
    // Silently ignore message processing errors (e.g., status updates)
  }
});

// ── Pending send confirmation state ──────────────────────────────
let pendingSend: { to: string; message: string } | null = null;

// ── CLI commands ─────────────────────────────────────────────────
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (raw) => {
  const input = String(raw).trim();
  const lower = input.toLowerCase();

  // ── Confirmation step for pending send ─────────────────────────
  if (pendingSend) {
    if (lower === "y" || lower === "yes") {
      await executeSend(pendingSend.to, pendingSend.message);
    } else {
      console.log(chalk.gray("  Cancelled.\n"));
    }
    pendingSend = null;
    return;
  }

  if (lower === "s" || lower === "summary") {
    await runSummary(SUMMARY_HOURS);
  } else if (lower.startsWith("s ") || lower.startsWith("summary ")) {
    const hours = parseInt(lower.split(" ")[1], 10);
    if (isNaN(hours) || hours < 1) {
      console.log(chalk.red("Usage: summary <hours>  (e.g., summary 4)"));
    } else {
      await runSummary(hours);
    }
  } else if (lower === "m" || lower === "mentions") {
    await runMentionsOnly(SUMMARY_HOURS);
  } else if (lower.startsWith("send ") && lower.includes("|")) {
    // Explicit: send <name> | <message or filepath> | <optional caption>
    const parts = input.slice(5).split("|");
    const to = parts[0].trim();
    const second = parts[1]?.trim() ?? "";
    const caption = parts[2]?.trim() ?? "";
    if (!to || !second) {
      console.log(chalk.red("Usage: send <name> | <message>  or  send <name> | /path/to/file | caption"));
    } else {
      await confirmSend(to, second, caption || undefined);
    }
  } else if (lower === "h" || lower === "help") {
    printHelp();
  } else if (lower === "q" || lower === "quit") {
    console.log(chalk.gray("Shutting down…"));
    await wa.destroy();
    process.exit(0);
  } else if (input.length > 0) {
    // ── Natural language — check for send intent first ──────────
    const intent = await detectSendIntent(input);
    if (intent.isSend) {
      await confirmSend(intent.to, intent.message, (intent as any).caption);
    } else {
      await runQuery(input);
    }
  }
});

async function runSummary(hours: number): Promise<void> {
  console.log(chalk.gray(`\nGenerating summary for last ${hours}h… (this takes a moment)`));
  try {
    const report = await generateReport(hours);
    if (report.totalMessages === 0) {
      console.log(chalk.yellow(`\n  No messages found in the last ${hours} hours.\n`));
      return;
    }
    printReport(report);
  } catch (err) {
    console.error(chalk.red("Failed to generate summary:"), err);
  }
}

async function runMentionsOnly(hours: number): Promise<void> {
  const { getMentions } = await import("./store.js");
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  const mentions = getMentions(sinceMs);

  console.log(chalk.bold.yellow(`\n🔔  Your mentions in the last ${hours}h:`));
  if (mentions.length === 0) {
    console.log(chalk.green("  ✓ No mentions\n"));
    return;
  }
  for (const m of mentions) {
    const t = new Date(m.timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      chalk.yellow(`  [${t}] `) +
        chalk.bold(m.chatName) +
        " › " +
        chalk.cyan(m.sender) +
        ": " +
        m.body
    );
  }
  console.log();
}

/**
 * On startup, load the last SUMMARY_HOURS of messages from all chats
 * so the user can query history immediately without waiting.
 */
async function loadHistory(): Promise<void> {
  const cutoffMs = Date.now() - SUMMARY_HOURS * 60 * 60 * 1000;
  console.log(chalk.gray(`  Loading last ${SUMMARY_HOURS}h of messages from WhatsApp…`));

  try {
    const chats = await wa.getChats();
    let total = 0;

    for (const chat of chats) {
      try {
        // Fetch up to 50 recent messages per chat
        const msgs = await chat.fetchMessages({ limit: 50 });

        for (const msg of msgs) {
          // Skip non-text messages and anything older than cutoff
          if (!msg.body || msg.timestamp * 1000 < cutoffMs) continue;

          const contact = await msg.getContact();
          const sender = contact.pushname || contact.name || msg.author || msg.from;
          const senderPhone = contact.number ?? msg.from.replace("@c.us", "");
          const body = msg.body as string;

          const mentionedIds: string[] = (msg as any).mentionedIds ?? [];
          const isMentionedById = MY_PHONE
            ? mentionedIds.some((id: string) => id.includes(MY_PHONE))
            : false;
          const isMentionedByName =
            MY_NAME.length > 0 && body.toLowerCase().includes(MY_NAME);

          addMessage({
            id: msg.id._serialized,
            chatName: chat.name || msg.from,
            chatId: chat.id._serialized,
            sender,
            senderPhone,
            body,
            timestamp: msg.timestamp * 1000,
            isMention: isMentionedById || isMentionedByName,
            isGroupMsg: chat.isGroup,
          });
          total++;
        }
      } catch {
        // Skip chats that fail (e.g., archived or broadcast lists)
      }
    }

    console.log(chalk.green(`  ✓ Loaded ${total} messages from the last ${SUMMARY_HOURS}h\n`));
  } catch (err) {
    console.log(chalk.yellow("  ⚠ Could not load history — will collect from now onwards\n"));
  }
}

function isFilePath(str: string): boolean {
  // Treat as file if it starts with / ~ . or contains a file extension
  return (
    str.startsWith("/") ||
    str.startsWith("~/") ||
    str.startsWith("./") ||
    /\.[a-zA-Z0-9]{2,5}$/.test(str)
  );
}

async function confirmSend(to: string, content: string, caption?: string): Promise<void> {
  pendingSend = { to, message: content + (caption ? `|||${caption}` : "") };
  const isFile = isFilePath(content);
  const label = isFile ? "File:    " : "Message: ";
  let preview = isFile ? chalk.cyan(path.basename(content)) : chalk.white(content);
  if (isFile && caption) preview += chalk.gray(`  (caption: ${caption})`);

  console.log(
    chalk.bold.yellow(`\n📤 Send ${isFile ? "file" : "message"}?`) +
    "\n  To:      " + chalk.cyan(to) +
    `\n  ${label}` + preview +
    "\n\n  " + chalk.bold("y") + " to confirm, anything else to cancel\n"
  );
}

async function executeSend(to: string, rawContent: string): Promise<void> {
  // Split caption back out if present
  const [content, caption] = rawContent.split("|||");

  try {
    // Find the chat
    const chats = await wa.getChats();
    let chat = chats.find((c: any) =>
      (c.name ?? "").toLowerCase().includes(to.toLowerCase())
    );

    if (!chat) {
      const contacts = await wa.getContacts();
      const contact = contacts.find((c: any) =>
        (c.pushname ?? c.name ?? "").toLowerCase().includes(to.toLowerCase())
      );
      if (!contact) {
        console.log(chalk.red(`\n  ✗ Could not find "${to}" in your chats or contacts.\n`));
        return;
      }
      chat = await contact.getChat();
    }

    // Send file or text
    if (isFilePath(content)) {
      const resolved = content.startsWith("~/")
        ? path.join(process.env.HOME ?? "", content.slice(2))
        : path.resolve(content);

      if (!fs.existsSync(resolved)) {
        console.log(chalk.red(`\n  ✗ File not found: ${resolved}\n`));
        return;
      }

      const media = MessageMedia.fromFilePath(resolved);
      await chat.sendMessage(media, caption ? { caption } : {});
      console.log(chalk.green(`\n  ✓ File "${path.basename(resolved)}" sent to ${to}\n`));
    } else {
      await chat.sendMessage(content);
      console.log(chalk.green(`\n  ✓ Message sent to ${to}\n`));
    }
  } catch (err) {
    console.error(chalk.red("  ✗ Failed to send:"), err);
  }
}

async function runQuery(question: string): Promise<void> {
  console.log(chalk.gray("\nThinking…"));
  try {
    const answer = await queryMessages(question);
    console.log("\n" + chalk.bold.cyan("🤖 ") + answer + "\n");
  } catch (err) {
    console.error(chalk.red("Failed to answer:"), err);
  }
}

function printHelp(): void {
  console.log(chalk.bold("\nCommands:"));
  console.log("  " + chalk.cyan("s") + "                           Generate summary (last " + SUMMARY_HOURS + "h)");
  console.log("  " + chalk.cyan("summary <hours>") + "            Generate summary for custom window");
  console.log("  " + chalk.cyan("m") + "                           Show only your mentions");
  console.log("  " + chalk.cyan("send <name> | <message>") + "           Send a text message");
  console.log("  " + chalk.cyan("send <name> | /path/file.jpg") + "      Send an image or file");
  console.log("  " + chalk.cyan("send <name> | /path/file.pdf | caption") + "  File with caption");
  console.log("  " + chalk.cyan("h") + "                           Show this help");
  console.log("  " + chalk.cyan("q") + "                           Quit");
  console.log("\n  " + chalk.bold("Or just type naturally:"));
  console.log("  " + chalk.yellow("what did Rahul say today?"));
  console.log("  " + chalk.yellow("send Chandreyee Ki korchis?"));
  console.log("  " + chalk.yellow("send /home/user/photo.jpg to John with caption check this"));
  console.log("  " + chalk.yellow("tell John the meeting is at 3pm"));
  console.log("  " + chalk.yellow("any messages about the deployment?\n"));
  console.log(chalk.gray("Messages are collected automatically. Mentions notify instantly.\n"));
}

// ── Start ────────────────────────────────────────────────────────
console.log(chalk.bold.cyan("\n🤖 WhatsApp Agent starting…\n"));
wa.initialize();
