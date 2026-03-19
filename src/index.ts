import "dotenv/config";
// Polyfill all missing Web API globals for Node 16 in one shot
import { fetch, Headers, Request, Response, FormData } from "undici";
Object.assign(globalThis, { fetch, Headers, Request, Response, FormData });
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg as any;
import qrcode from "qrcode-terminal";
import chalk from "chalk";
import { addMessage } from "./store.js";
import { generateReport, queryMessages } from "./summarizer.js";
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

// ── CLI commands ─────────────────────────────────────────────────
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (raw) => {
  const input = String(raw).trim();
  const lower = input.toLowerCase();

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
  } else if (lower === "h" || lower === "help") {
    printHelp();
  } else if (lower === "q" || lower === "quit") {
    console.log(chalk.gray("Shutting down…"));
    await wa.destroy();
    process.exit(0);
  } else if (input.length > 0) {
    // ── Natural language query ──────────────────────────────────
    await runQuery(input);
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
  console.log("  " + chalk.cyan("s") + "                      Generate summary (last " + SUMMARY_HOURS + "h)");
  console.log("  " + chalk.cyan("summary <hours>") + "       Generate summary for custom window");
  console.log("  " + chalk.cyan("m") + "                      Show only your mentions");
  console.log("  " + chalk.cyan("h") + "                      Show this help");
  console.log("  " + chalk.cyan("q") + "                      Quit");
  console.log("\n  " + chalk.bold("Or just ask anything:"));
  console.log("  " + chalk.yellow("what did Rahul say today?"));
  console.log("  " + chalk.yellow("any messages about the deployment?"));
  console.log("  " + chalk.yellow("show messages from the DevOps group"));
  console.log("  " + chalk.yellow("did anyone mention the server issue?\n"));
  console.log(chalk.gray("Messages are collected automatically. Mentions notify instantly.\n"));
}

// ── Start ────────────────────────────────────────────────────────
console.log(chalk.bold.cyan("\n🤖 WhatsApp Agent starting…\n"));
wa.initialize();
