import { DownloadOutlined } from '@ant-design/icons';
import { App, Button, Card, Empty, List, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiDownload, apiRequest, saveBlob } from '../api/client';
import type { GeneratedDocumentRecord } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { canDownloadDocument } from '../documents/access';

interface DocumentsHistoryCardProps {
  dealId?: string;
  transportationId?: string;
  title?: ReactNode;
  className?: string;
  /** Меняется в карточке после генерации нового документа — список перечитывается без перезагрузки страницы. */
  refreshToken?: number;
}

export function DocumentsHistoryCard({
  dealId,
  transportationId,
  title,
  className,
  refreshToken,
}: DocumentsHistoryCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [documents, setDocuments] = useState<GeneratedDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string>();

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadDocuments = useCallback(() => {
    const params = new URLSearchParams();
    if (dealId) params.set('dealId', dealId);
    else if (transportationId) params.set('transportationId', transportationId);
    else return Promise.resolve([] as GeneratedDocumentRecord[]);

    return apiRequest<GeneratedDocumentRecord[]>(`/documents?${params.toString()}`);
  }, [dealId, transportationId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadDocuments()
      .then((rows) => { if (active) setDocuments(rows); })
      .catch((error: unknown) => { if (active) showError(error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadDocuments, refreshToken, showError]);

  const download = async (document: GeneratedDocumentRecord) => {
    setDownloadingId(document.id);
    try {
      const { blob, filename } = await apiDownload(
        `/documents/${document.id}/download`,
        { method: 'POST' },
      );
      saveBlob(blob, filename);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setDownloadingId(undefined);
    }
  };

  const formatGeneratedAt = (value: string) => new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

  return (
    <Card className={className} title={title ?? t('documents.history.title')} size="small">
      <List<GeneratedDocumentRecord>
        loading={loading}
        dataSource={documents}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('documents.history.empty')}
            />
          ),
        }}
        renderItem={(document) => (
          <List.Item
            actions={canDownloadDocument(document, user?.roles ?? []) ? [
              <Button
                key="download"
                type="text"
                icon={<DownloadOutlined />}
                loading={downloadingId === document.id}
                onClick={() => void download(document)}
              >
                {t('documents.history.download')}
              </Button>,
            ] : undefined}
          >
            <List.Item.Meta
              title={document.number}
              description={(
                <Space direction="vertical" size={0}>
                  <Typography.Text type="secondary">
                    {t(`documents.registry.types.${document.type}`)}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('documents.history.generatedBy', {
                      name: document.generatedBy.fullName,
                      date: formatGeneratedAt(document.generatedAt),
                    })}
                  </Typography.Text>
                </Space>
              )}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
