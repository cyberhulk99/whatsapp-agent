# 🤖 WhatsApp AI Agent

> Stop reading every message. Just ask what matters.

An AI-powered WhatsApp agent that summarizes your chats, alerts you when someone mentions you, and lets you search messages in plain English — all from your terminal.

![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- **📋 Smart Summaries** — Get bullet-point summaries of any chat on demand
- **🔔 Instant Mention Alerts** — Know the moment someone tags you, in any group
- **🔍 Natural Language Search** — Ask anything in plain English
- **📅 Loads History on Startup** — Query past messages the moment it connects
- **🔀 Your Choice of AI** — Claude (Anthropic) or GPT-4o-mini (OpenAI)

---

## 💡 Who Is This For?

Anyone who deals with too many WhatsApp groups:

- Professionals juggling multiple team or client groups
- Students in dozens of college and project groups
- Community admins managing large groups
- Freelancers tracking client conversations
- Anyone tired of scrolling through hundreds of messages

---

## 🚀 Quick Install

```bash
# 1. Clone the repo
git clone https://github.com/cyberhulk99/whatsapp-agent.git
cd whatsapp-agent

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# → Open .env and fill in your details (see Configuration below)

# 4. Run
npm run dev
```

A QR code will appear — scan it with WhatsApp → **Linked Devices → Link a Device**.

---

## ⚙️ Configuration

Open `.env` and fill in:

```env
# ── AI Provider ──────────────────────────────────────────────────
# Choose: "claude" or "openai"
AI_PROVIDER=openai

# OpenAI key → https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Anthropic key → https://console.anthropic.com (only if AI_PROVIDER=claude)
ANTHROPIC_API_KEY=sk-ant-...

# ── WhatsApp ──────────────────────────────────────────────────────
# Your WhatsApp display name — used to detect when someone mentions you
MY_NAME=YourName

# Your phone number with country code (no + or spaces)
# Example: 919876543210 for India, 14155550123 for US
MY_PHONE=919876543210

# How many hours of history to load on startup (default: 8)
SUMMARY_HOURS=8

# Chats to monitor — comma separated. Leave empty to watch ALL chats.
# Example: "Friends,Work Team,Project Alpha"
WATCH_CHATS=
```

---

## 💬 Commands

Once running, type in the terminal:

| Command | What it does |
|---------|-------------|
| `s` | Summarize all chats (last 8h) |
| `summary 4` | Summarize last 4 hours |
| `m` | Show only your mentions |
| `h` | Help |
| `q` | Quit |
| *anything else* | Ask in plain English |

### Ask Anything

```
what did John say today?
any important messages in the last 2 hours?
show messages from the Project Alpha group
did anyone mention the deadline?
what's happening in the family group?
any unread messages about payment?
```

---

## 🧠 AI Providers

| Provider | Model | Cost estimate |
|----------|-------|--------------|
| OpenAI | gpt-4o-mini | ~$0.15 per 1M tokens — very cheap |
| Anthropic | claude-opus-4-6 | $5 per 1M tokens — more powerful |

Switch anytime by changing `AI_PROVIDER` in `.env` and restarting.

> **Tip:** Start with OpenAI — it handles summarization very well at almost zero cost.

---

## 🛠 Tech Stack

- **[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)** — WhatsApp Web automation
- **[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-node)** — Claude API
- **[openai](https://github.com/openai/openai-node)** — OpenAI API
- **TypeScript** + **Node.js**

---

## ⚠️ Requirements

- Node.js ≥ 16 (18+ recommended)
- Google Chrome installed on your machine
- An active WhatsApp account
- An OpenAI or Anthropic API key

---

## ❓ FAQ

**Does this work with WhatsApp Business?**
Yes, it works with both regular and Business accounts.

**Is my data sent anywhere?**
Messages are sent to the AI provider (OpenAI or Anthropic) only when you request a summary or ask a question. Nothing is stored outside your machine.

**Will WhatsApp ban my account?**
This uses WhatsApp Web — the same connection your browser uses. Risk is low but use responsibly.

**Does it work on Windows/Mac?**
Yes, as long as Node.js and Chrome are installed.

---

## ⚠️ Disclaimer

This project is built for **personal productivity use only**.

- This tool uses an unofficial WhatsApp Web client and is **not affiliated with, endorsed, or authorized by WhatsApp or Meta** in any way.
- Use this tool **only on your own WhatsApp account**. Do not use it to monitor, scrape, or send messages on behalf of others without their consent.
- The author is **not responsible for any misuse**, account bans, data breaches, privacy violations, or any other consequences arising from the use of this software.
- By using this project, you agree to comply with [WhatsApp's Terms of Service](https://www.whatsapp.com/legal/terms-of-service) and all applicable laws in your region.
- **Use responsibly. Use ethically.**

---

## 📄 License

MIT — free to use, modify, and share.
