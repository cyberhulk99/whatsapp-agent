export interface StoredMessage {
  id: string;
  chatName: string;
  chatId: string;
  sender: string;
  senderPhone: string;
  body: string;
  timestamp: number; // Unix ms
  isMention: boolean;
  isGroupMsg: boolean;
}

export interface ChatSummary {
  chatName: string;
  messageCount: number;
  summary: string;
  mentions: StoredMessage[];
}

export interface SummaryReport {
  generatedAt: Date;
  hoursBack: number;
  totalMessages: number;
  chatSummaries: ChatSummary[];
  allMentions: StoredMessage[];
}
