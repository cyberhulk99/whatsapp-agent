# 🤖 WhatsApp AI Agent

> An AI-powered WhatsApp agent for busy engineering team leads — get instant message summaries, mention alerts, and natural language search across all your group chats.

![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- **📋 Smart Summaries** — Summarize any chat in seconds using Claude or GPT-4o-mini
- **🔔 Instant Mention Alerts** — Get notified the moment someone tags you
- **🔍 Natural Language Search** — Ask anything: *"what did Rahul say about the deployment?"*
- **📅 Historical Load** — Loads the last 8 hours of messages on startup
- **🔀 AI Provider Choice** — Switch between Claude (Anthropic) and GPT-4o-mini (OpenAI)

---

## 🚀 Quick Install

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/whatsapp-agent.git
cd whatsapp-agent

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# → Edit .env with your API key and WhatsApp name

# 4. Run
npm run dev
```

Scan the QR code that appears → WhatsApp → Linked Devices → Link a Device.

---

## ⚙️ Configuration

Edit `.env`:

```env
# Choose: "claude" or "openai"
AI_PROVIDER=openai

# OpenAI key  →  https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Anthropic key  →  https://console.anthropic.com  (if using claude)
ANTHROPIC_API_KEY=sk-ant-...

# Your WhatsApp display name (for mention detection)
MY_NAME=Suman

# Your phone number with country code
MY_PHONE=919876543210

# Hours of history to load on startup (default: 8)
SUMMARY_HOURS=8

# Specific chats to monitor — leave empty to watch ALL
WATCH_CHATS=Team Alpha,DevOps,Backend
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
| *anything else* | Ask in natural language |

### Natural Language Examples

```
what did Rahul say today?
any messages about the server issue?
show messages from the DevOps group
did anyone talk about the release?
check last message from Ayushi
```

---

## 🧠 AI Providers

| Provider | Model | Cost |
|----------|-------|------|
| OpenAI | gpt-4o-mini | ~$0.15/1M tokens (very cheap) |
| Anthropic | claude-opus-4-6 | $5/1M tokens (more powerful) |

Switch anytime by changing `AI_PROVIDER` in `.env` and restarting.

---

## 🛠 Tech Stack

- **[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)** — WhatsApp Web automation
- **[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-node)** — Claude API
- **[openai](https://github.com/openai/openai-node)** — OpenAI API
- **TypeScript** + **Node.js**

---

## ⚠️ Requirements

- Node.js ≥ 16 (18+ recommended)
- Google Chrome installed
- An active WhatsApp account
- OpenAI or Anthropic API key

---

## 📄 License

MIT
