# I Built an AI Agent That Reads My WhatsApp So I Don't Have To

*As a dev team lead managing 10+ groups, I was losing 30 minutes every morning just catching up on messages. Here's how I fixed it with 300 lines of TypeScript.*

---

## The Problem

If you lead an engineering team, you know this feeling.

You open WhatsApp in the morning and you have 47 unread messages across 6 different groups — DevOps, Backend, Mobile, Releases, the general team chat, and three side threads. Someone tagged you in the backend group at 11 PM. Someone else asked a critical question in the releases group that nobody answered. And somewhere in that wall of messages is the one thing you actually need to act on today.

I was spending 20–30 minutes every morning just reading through chats. That's 2+ hours a week — just reading.

So I built an AI agent that does it for me.

---

## What It Does

The **WhatsApp AI Agent** is a terminal app that:

- **Connects to WhatsApp** via a QR code scan (just like WhatsApp Web)
- **Loads the last 8 hours of messages** from all your groups automatically on startup
- **Notifies you instantly** when someone mentions your name
- **Summarizes any chat** in bullet points on demand
- **Answers natural language questions** like *"what did Rahul say about the deployment?"*

Here's what a typical morning looks like now:

```
$ npm run dev

✓ WhatsApp connected!
  Loading last 8h of messages…
  ✓ Loaded 312 messages from 11 chats

> what needs my attention today?

🤖 Based on the last 8 hours:
• Backend group: Priya flagged a DB migration issue blocking staging deploy
• DevOps: Kapil waiting on your approval for the K8s config change
• Releases: v2.3.1 build passed — team asking if you want to push to prod
• 3 direct messages from Ayushi about the API spec review
```

That used to take me 25 minutes. Now it takes 10 seconds.

---

## The Tech Stack

- **whatsapp-web.js** — unofficial WhatsApp Web client (connects via Puppeteer)
- **Claude Opus 4.6 / GPT-4o-mini** — your choice of AI for summaries
- **TypeScript + Node.js** — clean, typed codebase
- **~300 lines of code** — no bloat

---

## How It Works

### 1. Connecting to WhatsApp

`whatsapp-web.js` runs a headless Chrome browser in the background and connects to WhatsApp Web. You scan a QR code once — after that, the session is saved locally and it reconnects automatically.

```typescript
const wa = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wa-session" }),
  puppeteer: { headless: true }
});

wa.on("qr", (qr) => qrcode.generate(qr, { small: true }));
wa.on("ready", async () => {
  await loadHistory(); // load last 8h from all chats
});
```

### 2. Loading Historical Messages

On startup, the agent fetches the last 50 messages from every chat and stores them in memory. This means you can query history the moment it starts — no waiting for new messages.

```typescript
const chats = await wa.getChats();
for (const chat of chats) {
  const msgs = await chat.fetchMessages({ limit: 50 });
  msgs.filter(m => m.timestamp * 1000 >= cutoffMs)
      .forEach(m => addMessage(/* store it */));
}
```

### 3. Instant Mention Detection

Every incoming message is checked against your name and phone number. If you're tagged — you know immediately.

```typescript
wa.on("message", async (msg) => {
  const isMention =
    msg.mentionedIds.some(id => id.includes(MY_PHONE)) ||
    msg.body.toLowerCase().includes(MY_NAME.toLowerCase());

  if (isMention) {
    console.log(`🔔 [${chatName}] ${sender}: ${msg.body}`);
  }
});
```

### 4. AI Summarization

When you type `s`, all stored messages are grouped by chat and sent to the AI with a focused prompt:

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: "Summarize this WhatsApp conversation for an engineering team lead. " +
               "Focus on: decisions, blockers, action items. Under 150 words. Bullet points."
    },
    { role: "user", content: formattedMessages }
  ]
});
```

### 5. Natural Language Queries

This is the part I use most. Anything you type that isn't a command gets sent to the AI with all 24h of stored messages as context:

```
> show me messages from Parikshith

🤖 Parikshith sent 3 messages in the last 24h:
• [09:14] Backend group: "the auth service is down, investigating"
• [09:47] Backend group: "found the issue — JWT secret rotation failed. Fixing now"
• [11:23] DM: "fixed and deployed, please verify on staging"
```

---

## Choosing Your AI Provider

The agent supports both OpenAI and Anthropic — switch with one line in `.env`:

```env
AI_PROVIDER=openai    # gpt-4o-mini — cheap, fast, great for summaries
AI_PROVIDER=claude    # claude-opus-4-6 — more powerful, better reasoning
```

**Cost in practice:** With `gpt-4o-mini`, summarizing 200 messages costs about $0.003. Running this all day every day costs less than ₹10/month.

---

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-agent.git
cd whatsapp-agent
npm install
cp .env.example .env
# Add your API key and WhatsApp name to .env
npm run dev
```

Scan the QR code → done. The agent is running.

---

## What I Learned

**1. WhatsApp's unofficial API is surprisingly stable.** `whatsapp-web.js` has been around since 2020 and handles reconnects, session management, and group events gracefully.

**2. GPT-4o-mini punches above its weight for summarization.** For structured extraction tasks like "what are the action items in this conversation?", it's nearly as good as GPT-4o at a fraction of the cost.

**3. Natural language is the right interface for this.** I tried building a fancy dashboard first. Nobody wants a dashboard. You want to ask a question and get an answer.

**4. Node 16 vs Node 18 will bite you.** The Anthropic and OpenAI SDKs expect Fetch API globals (`fetch`, `Headers`, `FormData`) that don't exist in Node 16. Polyfill with `undici@5` if you're stuck on Node 16.

---

## What's Next

A few things I want to add:

- **Scheduled digests** — auto-summary every morning at 9 AM via a cron
- **Slack/email delivery** — push the summary to wherever you actually live
- **Priority detection** — flag urgent messages even without a direct mention
- **Keyword alerts** — "notify me if anyone says 'production is down'"

---

## Try It

The full source is on GitHub: **github.com/YOUR_USERNAME/whatsapp-agent**

If you're a team lead drowning in group chats, give it a shot. The setup takes about 5 minutes and you'll get those 30 minutes back every morning.

---

*Built with TypeScript, whatsapp-web.js, and Claude/OpenAI. Questions? Drop them in the comments.*

---

**Tags:** `#engineering` `#productivity` `#ai` `#whatsapp` `#typescript` `#teamlead` `#devtools`
