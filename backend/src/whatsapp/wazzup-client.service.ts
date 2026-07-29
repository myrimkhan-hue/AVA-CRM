import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const API_BASE = 'https://api.wazzup24.com/v3';

export interface WazzupSendResult {
  messageId: string;
  chatId: string;
}

/**
 * Тонкая обёртка над Wazzup API v3 (https://wazzup24.com/help/api-en/).
 * Ключ и канал берутся из .env — пока они не заданы, интеграция сознательно не работает
 * (метод бросает понятную ошибку вместо попытки достучаться до внешнего сервиса).
 */
@Injectable()
export class WazzupClientService {
  isConfigured(): boolean {
    return Boolean(process.env.WAZZUP_API_KEY && process.env.WAZZUP_CHANNEL_ID);
  }

  private requireConfig(): { apiKey: string; channelId: string } {
    const apiKey = process.env.WAZZUP_API_KEY;
    const channelId = process.env.WAZZUP_CHANNEL_ID;
    if (!apiKey || !channelId) {
      throw new ServiceUnavailableException(
        'Интеграция WhatsApp (Wazzup) не настроена — заполните WAZZUP_API_KEY и WAZZUP_CHANNEL_ID в .env',
      );
    }
    return { apiKey, channelId };
  }

  async sendMessage(chatId: string, text: string, crmMessageId: string): Promise<WazzupSendResult> {
    const { apiKey, channelId } = this.requireConfig();
    const response = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId, chatId, chatType: 'whatsapp', text, crmMessageId }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ServiceUnavailableException(`Wazzup вернул ошибку ${response.status}: ${body || 'нет деталей'}`);
    }
    return response.json() as Promise<WazzupSendResult>;
  }
}
