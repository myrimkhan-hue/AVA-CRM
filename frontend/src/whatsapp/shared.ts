export type WhatsAppDirection = 'IN' | 'OUT';
export type WhatsAppMessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';

export interface WhatsAppMessageRecord {
  id: string;
  direction: WhatsAppDirection;
  channelId: string | null;
  chatId: string;
  contactName: string | null;
  contractorId: string | null;
  text: string;
  status: WhatsAppMessageStatus;
  wazzupMessageId: string | null;
  templateId: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; fullName: string } | null;
  template: { id: string; title: string } | null;
  contractor: { id: string; name: string } | null;
}

export interface WhatsAppTemplateRecord {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppUnmatchedThread {
  chatId: string;
  contactName: string | null;
  lastText: string;
  lastAt: string;
  count: number;
}
