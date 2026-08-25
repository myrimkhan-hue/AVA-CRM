import {
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  List,
  Popconfirm,
  Space,
  Typography,
  Upload,
} from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ApiError, apiDownload, apiRequest, saveBlob } from '../api/client';
import type {
  AttachmentEntityType,
  AttachmentLimits,
  AttachmentRecord,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface AttachmentsCardProps {
  entityType: AttachmentEntityType;
  entityId: string;
  title?: ReactNode;
  canUpload?: boolean;
  className?: string;
}

function formatFileSize(bytes: number, t: TFunction): string {
  if (bytes < 1024) return t('attachments.size.bytes', { value: bytes });
  if (bytes < 1024 * 1024) {
    return t('attachments.size.kilobytes', { value: Math.round(bytes / 1024) });
  }
  return t('attachments.size.megabytes', { value: (bytes / (1024 * 1024)).toFixed(1) });
}

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLocaleLowerCase() : '';
}

export function AttachmentsCard({
  entityType,
  entityId,
  title,
  canUpload = true,
  className,
}: AttachmentsCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [limits, setLimits] = useState<AttachmentLimits>();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadAttachments = useCallback(async () => {
    const params = new URLSearchParams({ entityType, entityId });
    return apiRequest<AttachmentRecord[]>(`/attachments?${params.toString()}`);
  }, [entityId, entityType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      loadAttachments(),
      apiRequest<AttachmentLimits>('/attachments/limits'),
    ])
      .then(([rows, nextLimits]) => {
        if (!active) return;
        setAttachments(rows);
        setLimits(nextLimits);
      })
      .catch((error: unknown) => { if (active) showError(error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttachments, showError]);

  const uploadFile = async (file: File) => {
    if (uploading || !limits) return;
    if (!limits.allowedExtensions.includes(fileExtension(file.name))) {
      void message.error(t('attachments.validation.extension', {
        extensions: limits.allowedExtensions.join(', '),
      }));
      return;
    }
    if (file.size > limits.maxUploadMb * 1024 * 1024) {
      void message.error(t('attachments.validation.size', { max: limits.maxUploadMb }));
      return;
    }

    const body = new FormData();
    body.append('file', file);
    body.append('entityType', entityType);
    body.append('entityId', entityId);
    if (description.trim()) body.append('description', description.trim());

    setUploading(true);
    try {
      const uploaded = await apiRequest<AttachmentRecord>('/attachments', {
        method: 'POST',
        body,
      });
      setAttachments((current) => [uploaded, ...current]);
      setDescription('');
      void message.success(t('attachments.messages.uploaded'));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (attachment: AttachmentRecord) => {
    setDownloadingId(attachment.id);
    try {
      const { blob, filename } = await apiDownload(`/attachments/${attachment.id}/download`);
      saveBlob(blob, filename);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setDownloadingId(undefined);
    }
  };

  const deleteFile = async (attachment: AttachmentRecord) => {
    setDeletingId(attachment.id);
    try {
      await apiRequest<AttachmentRecord>(`/attachments/${attachment.id}`, { method: 'DELETE' });
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      void message.success(t('attachments.messages.deleted'));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setDeletingId(undefined);
    }
  };

  const canDelete = (attachment: AttachmentRecord) => Boolean(
    canUpload && user && (
      attachment.uploadedBy.id === user.id
      || user.roles.some((role) => role === 'ADMIN' || role === 'DIRECTOR')
    )
  );

  const formatUploadedAt = (value: string) => new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

  return (
    <Card className={className} title={title ?? t('attachments.title')} size="small">
      {canUpload && (
        <Space direction="vertical" className="full-width" size="small">
          <Typography.Text type="secondary">
            {limits
              ? t('attachments.limit', {
                max: limits.maxUploadMb,
                extensions: limits.allowedExtensions.join(', '),
              })
              : t('attachments.limitLoading')}
          </Typography.Text>
          <Input.TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('attachments.descriptionPlaceholder')}
            maxLength={300}
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
          <Upload
            accept={limits?.allowedExtensions.join(',')}
            showUploadList={false}
            disabled={uploading || !limits}
            beforeUpload={(file) => {
              void uploadFile(file);
              return Upload.LIST_IGNORE;
            }}
          >
            <Button icon={<UploadOutlined />} loading={uploading} disabled={!limits}>
              {t('attachments.upload')}
            </Button>
          </Upload>
        </Space>
      )}

      <List<AttachmentRecord>
        className={canUpload ? 'attachments-list' : undefined}
        loading={loading}
        dataSource={attachments}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('attachments.empty')} />,
        }}
        renderItem={(attachment) => (
          <List.Item
            actions={[
              <Button
                key="download"
                type="text"
                icon={<DownloadOutlined />}
                loading={downloadingId === attachment.id}
                onClick={() => void downloadFile(attachment)}
              >
                {t('attachments.download')}
              </Button>,
              ...(canDelete(attachment) ? [
                <Popconfirm
                  key="delete"
                  title={t('attachments.confirm.deleteTitle')}
                  description={t('attachments.confirm.deleteText', { name: attachment.fileName })}
                  okText={t('attachments.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, loading: deletingId === attachment.id }}
                  onConfirm={() => deleteFile(attachment)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />}>
                    {t('attachments.delete')}
                  </Button>
                </Popconfirm>,
              ] : []),
            ]}
          >
            <List.Item.Meta
              title={attachment.fileName}
              description={(
                <Space direction="vertical" size={0}>
                  <Typography.Text type="secondary">
                    {t('attachments.uploadedBy', {
                      name: attachment.uploadedBy.fullName,
                      date: formatUploadedAt(attachment.uploadedAt),
                    })}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {formatFileSize(attachment.sizeBytes, t)}
                  </Typography.Text>
                  {attachment.description && <Typography.Text>{attachment.description}</Typography.Text>}
                </Space>
              )}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
