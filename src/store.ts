import type { StoredMessage } from "./types.js";

/**
 * In-memory message store with rolling window.
 * Keeps messages from the last MAX_HOURS hours.
 */
const MAX_HOURS = 24;
const messages: StoredMessage[] = [];

export function addMessage(msg: StoredMessage): void {
  messages.push(msg);
  pruneOld();
}

export function getMessages(sinceMs: number, chatName?: string): StoredMessage[] {
  return messages.filter(
    (m) =>
      m.timestamp >= sinceMs &&
      (chatName === undefined || m.chatName === chatName)
  );
}

export function getAllChats(): string[] {
  return [...new Set(messages.map((m) => m.chatName))];
}

export function getMentions(sinceMs: number): StoredMessage[] {
  return messages.filter((m) => m.timestamp >= sinceMs && m.isMention);
}

function pruneOld(): void {
  const cutoff = Date.now() - MAX_HOURS * 60 * 60 * 1000;
  const first = messages.findIndex((m) => m.timestamp >= cutoff);
  if (first > 0) messages.splice(0, first);
}
