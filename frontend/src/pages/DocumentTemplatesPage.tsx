import {
  DeleteOutlined,
  DownloadOutlined,
  HistoryOutlined,
  RollbackOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { ApiError, apiDownload, apiRequest, saveBlob } from '../api/client';
import type {
  DocumentTemplateListResponse,
  DocumentTemplateMutationResponse,
  DocumentTemplateRecord,
  DocumentTemplateType,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';

const TEMPLATE_TYPES: DocumentTemplateType[] = [
  'CONTRACT',
  'TRANSPORT_REQUEST',
  'INVOICE',
];

interface UploadValues {
  type: DocumentTemplateType;
  displayName: string;
  note?: string;
}

export function DocumentTemplatesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<UploadValues>();
  const [data, setData] = useState<DocumentTemplateListResponse>();
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [actionId, setActionId] = useState<string>();
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      setData(await apiRequest<DocumentTemplateListResponse>('/document-templates'));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const showUnknownPlaceholders = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    modal.warning({
      title: t('documentTemplates.warnings.unknownTitle'),
      content: (
        <div>
          <Typography.Paragraph>
            {t('documentTemplates.warnings.unknownText')}
          </Typography.Paragraph>
          <ul>
            {keys.map((key) => <li key={key}><code>{`{${key}}`}</code></li>)}
          </ul>
        </div>
      ),
    });
  }, [modal, t]);

  const openUpload = (type: DocumentTemplateType = 'CONTRACT') => {
    form.setFieldsValue({
      type,
      displayName: t(`documentTemplates.types.${type}`),
      note: undefined,
    });
    setFileList([]);
    setUploadOpen(true);
  };

  const upload = async (values: UploadValues) => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      void message.error(t('documentTemplates.upload.fileRequired'));
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('type', values.type);
      body.append('displayName', values.displayName);
      if (values.note?.trim()) body.append('note', values.note.trim());
      body.append('file', file, file.name);
      const result = await apiRequest<DocumentTemplateMutationResponse>(
        '/document-templates',
        { method: 'POST', body },
      );
      setUploadOpen(false);
      void message.success(t('documentTemplates.messages.uploaded'));
      showUnknownPlaceholders(result.unknownPlaceholders);
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setUploading(false);
    }
  };

  const download = useCallback(async (template: DocumentTemplateRecord) => {
    setActionId(template.id);
    try {
      const result = await apiDownload(`/document-templates/${template.id}/download`);
      saveBlob(result.blob, result.filename);
    } catch (error) {
      showError(error);
    } finally {
      setActionId(undefined);
    }
  }, [showError]);

  const downloadFallback = useCallback(async (type: DocumentTemplateType) => {
    setActionId(`fallback-${type}`);
    try {
      const result = await apiDownload(
        `/document-templates/fallback/${type}/download`,
      );
      saveBlob(result.blob, result.filename);
    } catch (error) {
      showError(error);
    } finally {
      setActionId(undefined);
    }
  }, [showError]);

  const activate = useCallback((template: DocumentTemplateRecord) => {
    modal.confirm({
      title: t('documentTemplates.confirm.activateTitle'),
      content: t('documentTemplates.confirm.activateText', {
        name: template.displayName,
      }),
      okText: t('documentTemplates.actions.activate'),
      cancelText: t('common.cancel'),
      async onOk() {
        setActionId(template.id);
        try {
          const result = await apiRequest<DocumentTemplateMutationResponse>(
            `/document-templates/${template.id}/activate`,
            { method: 'PATCH' },
          );
          void message.success(t('documentTemplates.messages.activated'));
          showUnknownPlaceholders(result.unknownPlaceholders);
          await load();
        } catch (error) {
          showError(error);
          throw error;
        } finally {
          setActionId(undefined);
        }
      },
    });
  }, [load, message, modal, showError, showUnknownPlaceholders, t]);

  const remove = useCallback((template: DocumentTemplateRecord) => {
    modal.confirm({
      title: t('documentTemplates.confirm.deleteTitle'),
      content: t('documentTemplates.confirm.deleteText', {
        name: template.displayName,
      }),
      okText: t('documentTemplates.actions.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        setActionId(template.id);
        try {
          await apiRequest<{ ok: true }>(`/document-templates/${template.id}`, {
            method: 'DELETE',
          });
          void message.success(t('documentTemplates.messages.deleted'));
          await load();
        } catch (error) {
          showError(error);
          throw error;
        } finally {
          setActionId(undefined);
        }
      },
    });
  }, [load, message, modal, showError, t]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  ), [i18n.language]);

  const formatSize = useCallback((bytes: number) => {
    const value = bytes >= 1024 * 1024 ? bytes / (1024 * 1024) : bytes / 1024;
    return new Intl.NumberFormat(i18n.language, {
      style: 'unit',
      unit: bytes >= 1024 * 1024 ? 'megabyte' : 'kilobyte',
      maximumFractionDigits: 1,
    }).format(value);
  }, [i18n.language]);

  const columns = useMemo<ColumnsType<DocumentTemplateRecord>>(() => [
    {
      title: t('documentTemplates.columns.name'),
      dataIndex: 'displayName',
      width: 210,
      render: (value: string, template) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{template.originalName}</Typography.Text>
        </Space>
      ),
    },
    {
      title: t('documentTemplates.columns.size'),
      dataIndex: 'sizeBytes',
      width: 110,
      render: formatSize,
    },
    {
      title: t('documentTemplates.columns.uploaded'),
      key: 'uploaded',
      width: 230,
      render: (_, template) => (
        <Space direction="vertical" size={0}>
          <span>{template.uploadedBy.fullName}</span>
          <Typography.Text type="secondary">
            {formatDate(template.uploadedAt)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('documentTemplates.columns.note'),
      dataIndex: 'note',
      ellipsis: true,
      render: (value: string | null) => value || t('common.dash'),
    },
    {
      title: t('documentTemplates.columns.status'),
      dataIndex: 'isActive',
      width: 110,
      render: (active: boolean) => active
        ? <Tag color="green">{t('documentTemplates.status.active')}</Tag>
        : <Tag>{t('documentTemplates.status.inactive')}</Tag>,
    },
    {
      title: t('documentTemplates.columns.actions'),
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, template) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={actionId === template.id}
            onClick={() => void download(template)}
          >
            {t('documentTemplates.actions.download')}
          </Button>
          {!template.isActive && (
            <>
              <Button
                size="small"
                icon={<RollbackOutlined />}
                loading={actionId === template.id}
                onClick={() => activate(template)}
              >
                {t('documentTemplates.actions.activate')}
              </Button>
              <Button
                size="small"
                danger
                type="text"
                icon={<DeleteOutlined />}
                loading={actionId === template.id}
                onClick={() => remove(template)}
              />
            </>
          )}
        </Space>
      ),
    },
  ], [actionId, activate, download, formatDate, formatSize, remove, t]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="document-templates-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('documentTemplates.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('documentTemplates.subtitle')}
          </Typography.Text>
        </div>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => openUpload()}>
          {t('documentTemplates.actions.upload')}
        </Button>
      </div>

      <Alert
        showIcon
        type="info"
        className="document-template-regeneration-alert"
        message={t('documentTemplates.regenerationNotice')}
      />

      {TEMPLATE_TYPES.map((type) => {
        const versions = data?.templates.filter((item) => item.type === type) ?? [];
        const active = versions.find((item) => item.isActive);
        return (
          <Card
            key={type}
            loading={loading}
            className="document-template-section"
            title={t(`documentTemplates.types.${type}`)}
            extra={(
              <Button icon={<UploadOutlined />} onClick={() => openUpload(type)}>
                {t('documentTemplates.actions.uploadVersion')}
              </Button>
            )}
          >
            {active ? (
              <Descriptions
                size="small"
                column={{ xs: 1, sm: 2, md: 3 }}
                className="document-template-active"
                items={[
                  {
                    key: 'name',
                    label: t('documentTemplates.active.name'),
                    children: active.displayName,
                  },
                  {
                    key: 'uploadedBy',
                    label: t('documentTemplates.active.uploadedBy'),
                    children: active.uploadedBy.fullName,
                  },
                  {
                    key: 'uploadedAt',
                    label: t('documentTemplates.active.uploadedAt'),
                    children: formatDate(active.uploadedAt),
                  },
                ]}
              />
            ) : (
              <Alert
                showIcon
                type="warning"
                message={t('documentTemplates.active.fallback')}
              />
            )}

            <Space wrap className="document-template-current-actions">
              {active && (
                <Button
                  icon={<DownloadOutlined />}
                  loading={actionId === active.id}
                  onClick={() => void download(active)}
                >
                  {t('documentTemplates.actions.downloadCurrent')}
                </Button>
              )}
              <Button
                icon={<DownloadOutlined />}
                loading={actionId === `fallback-${type}`}
                onClick={() => void downloadFallback(type)}
              >
                {t('documentTemplates.actions.downloadFallback')}
              </Button>
            </Space>

            <Typography.Title level={4} className="document-template-history-title">
              <HistoryOutlined /> {t('documentTemplates.history.title')}
            </Typography.Title>
            <Table<DocumentTemplateRecord>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={versions}
              pagination={false}
              scroll={{ x: 1050 }}
              locale={{ emptyText: t('documentTemplates.history.empty') }}
            />
          </Card>
        );
      })}

      <Collapse
        className="document-template-help"
        items={TEMPLATE_TYPES.map((type) => {
          const placeholders = data?.placeholders[type] ?? [];
          const required = new Set(data?.requiredPlaceholders[type] ?? []);
          const optionalPlaceholders = placeholders.filter((key) => !required.has(key));
          const placeholderList = (keys: string[]) => (
            <div className="document-template-placeholder-list">
              {keys.map((key) => (
                <div key={key} className="document-template-placeholder-item">
                  <Typography.Text code copyable>{`{${key}}`}</Typography.Text>
                  <span>{t(`documentTemplates.placeholders.descriptions.${key}`)}</span>
                </div>
              ))}
            </div>
          );
          return {
            key: type,
            label: t('documentTemplates.placeholders.groupTitle', {
              type: t(`documentTemplates.types.${type}`),
            }),
            children: (
              <div>
                <Typography.Paragraph type="secondary">
                  {t('documentTemplates.placeholders.hint')}
                </Typography.Paragraph>
                <Typography.Title level={5}>
                  {t('documentTemplates.placeholders.requiredTitle')}
                </Typography.Title>
                <Typography.Paragraph type="secondary">
                  {t('documentTemplates.placeholders.requiredHint')}
                </Typography.Paragraph>
                {placeholderList(placeholders.filter((key) => required.has(key)))}
                {optionalPlaceholders.length > 0 && (
                  <div className="document-template-optional-placeholders">
                    <Typography.Title level={5}>
                      {t('documentTemplates.placeholders.optionalTitle')}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary">
                      {t('documentTemplates.placeholders.optionalHint')}
                    </Typography.Paragraph>
                    {placeholderList(optionalPlaceholders)}
                  </div>
                )}
              </div>
            ),
          };
        })}
      />

      <Modal
        open={uploadOpen}
        title={t('documentTemplates.upload.title')}
        okText={t('documentTemplates.actions.upload')}
        cancelText={t('common.cancel')}
        confirmLoading={uploading}
        onOk={() => form.submit()}
        onCancel={() => setUploadOpen(false)}
        destroyOnHidden
      >
        <Form<UploadValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void upload(values)}
        >
          <Form.Item
            name="type"
            label={t('documentTemplates.upload.type')}
            rules={[{ required: true, message: t('documentTemplates.upload.typeRequired') }]}
          >
            <Select options={TEMPLATE_TYPES.map((value) => ({
              value,
              label: t(`documentTemplates.types.${value}`),
            }))} />
          </Form.Item>
          <Form.Item
            name="displayName"
            label={t('documentTemplates.upload.displayName')}
            rules={[{
              required: true,
              whitespace: true,
              message: t('documentTemplates.upload.displayNameRequired'),
            }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="note" label={t('documentTemplates.upload.note')}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Upload.Dragger
            accept=".docx"
            maxCount={1}
            fileList={fileList}
            beforeUpload={(file) => {
              if (!file.name.toLocaleLowerCase().endsWith('.docx')) {
                void message.error(t('documentTemplates.upload.invalidExtension'));
                return Upload.LIST_IGNORE;
              }
              if (data && file.size > data.maxUploadMb * 1024 * 1024) {
                void message.error(t('documentTemplates.upload.tooLarge', {
                  size: data.maxUploadMb,
                }));
                return Upload.LIST_IGNORE;
              }
              return false;
            }}
            onChange={({ fileList: next }) => setFileList(next.slice(-1))}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p>{t('documentTemplates.upload.drag')}</p>
            <p className="ant-upload-hint">
              {t('documentTemplates.upload.hint', { size: data?.maxUploadMb ?? 25 })}
            </p>
          </Upload.Dragger>
        </Form>
      </Modal>
    </div>
  );
}
