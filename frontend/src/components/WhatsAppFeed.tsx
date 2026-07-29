import { SendOutlined } from '@ant-design/icons';
import { Alert, App, Button, Empty, Select, Spin, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { WhatsAppMessageRecord, WhatsAppTemplateRecord } from '../whatsapp/shared';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'whatsapp.status.PENDING',
  SENT: 'whatsapp.status.SENT',
  DELIVERED: 'whatsapp.status.DELIVERED',
  READ: 'whatsapp.status.READ',
  FAILED: 'whatsapp.status.FAILED',
  RECEIVED: 'whatsapp.status.RECEIVED',
};

export function WhatsAppFeed({ contractorId }: { contractorId: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [messages, setMessages] = useState<WhatsAppMessageRecord[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState<string>();
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, templateList, status] = await Promise.all([
        apiRequest<WhatsAppMessageRecord[]>(`/whatsapp/messages?contractorId=${encodeURIComponent(contractorId)}`),
        apiRequest<WhatsAppTemplateRecord[]>('/whatsapp/templates?activeOnly=true'),
        apiRequest<{ configured: boolean }>('/whatsapp/status'),
      ]);
      setMessages(feed);
      setTemplates(templateList);
      setConfigured(status.configured);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [contractorId, showError]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const templateOptions = useMemo(
    () => templates.map((item) => ({ value: item.id, label: item.title })),
    [templates],
  );

  const applyTemplate = (value: string | undefined) => {
    setTemplateId(value);
    const template = templates.find((item) => item.id === value);
    if (template) setText(template.body);
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const sent = await apiRequest<WhatsAppMessageRecord>('/whatsapp/messages', {
        method: 'POST',
        body: JSON.stringify({ contractorId, text: text.trim(), templateId }),
      });
      setMessages((current) => [...current, sent]);
      setText('');
      setTemplateId(undefined);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSending(false);
    }
  };

  return <div className="whatsapp-feed">
    {!configured && <Alert type="warning" showIcon className="form-alert" message={t('whatsapp.notConfigured')} />}
    <div className="whatsapp-feed-list" ref={listRef}>
      {loading ? <Spin className="contractor-list-spin" /> : messages.length ? messages.map((item) => <div key={item.id} className={`whatsapp-bubble ${item.direction === 'OUT' ? 'out' : 'in'}`}>
        <div className="whatsapp-bubble-text">{item.text || t('common.dash')}</div>
        <div className="whatsapp-bubble-meta">
          {item.direction === 'OUT' && item.author && <span>{item.author.fullName} · </span>}
          <span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
          {item.direction === 'OUT' && <Tag bordered={false} className="whatsapp-status-tag">{t(STATUS_LABELS[item.status])}</Tag>}
        </div>
      </div>) : <Empty className="contractor-list-empty" description={t('whatsapp.empty')} />}
    </div>
    <div className="whatsapp-feed-composer">
      {templateOptions.length > 0 && <Select
        allowClear
        size="small"
        className="whatsapp-template-select"
        placeholder={t('whatsapp.templatePlaceholder')}
        value={templateId}
        onChange={applyTemplate}
        options={templateOptions}
        disabled={!configured}
      />}
      <div className="whatsapp-composer-row">
        <textarea
          className="whatsapp-composer-input"
          rows={2}
          value={text}
          disabled={!configured}
          placeholder={t('whatsapp.textPlaceholder')}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!configured || !text.trim()} onClick={() => void send()} />
      </div>
    </div>
  </div>;
}
