import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiDownload, apiRequest, saveBlob } from '../api/client';
import type {
  GeneratedDocumentRecord,
  GeneratedDocumentSource,
  GeneratedDocumentType,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { canDownloadDocument } from '../documents/access';

const DOCUMENT_TYPES: GeneratedDocumentType[] = [
  'CONTRACT',
  'TRANSPORT_REQUEST',
  'INVOICE',
  'ACT',
];

const TYPE_COLORS: Record<GeneratedDocumentType, string> = {
  CONTRACT: 'blue',
  TRANSPORT_REQUEST: 'gold',
  INVOICE: 'green',
  ACT: 'purple',
};

type Period = [Dayjs | null, Dayjs | null] | null;

function sourcePath(source: GeneratedDocumentSource | null): string | null {
  if (!source) return null;
  if (source.type === 'DEAL') return `/deals/${source.id}`;
  if (source.type === 'TRANSPORTATION') return `/transportations/${source.id}`;
  return source.transportationId
    ? `/transportations/${source.transportationId}`
    : null;
}

export function DocumentsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [documents, setDocuments] = useState<GeneratedDocumentRecord[]>([]);
  const [filterReferences, setFilterReferences] = useState<GeneratedDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string>();
  const [type, setType] = useState<GeneratedDocumentType>();
  const [period, setPeriod] = useState<Period>(null);
  const [legalEntityId, setLegalEntityId] = useState<string>();
  const [contractorId, setContractorId] = useState<string>();
  const [generatedByUserId, setGeneratedByUserId] = useState<string>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (period?.[0]) params.set('dateFrom', period[0].format('YYYY-MM-DD'));
      if (period?.[1]) params.set('dateTo', period[1].format('YYYY-MM-DD'));
      if (legalEntityId) params.set('legalEntityId', legalEntityId);
      if (contractorId) params.set('contractorId', contractorId);
      if (generatedByUserId) params.set('generatedByUserId', generatedByUserId);
      if (search) params.set('search', search);
      const query = params.toString();
      const result = await apiRequest<GeneratedDocumentRecord[]>(
        `/documents${query ? `?${query}` : ''}`,
      );
      setDocuments(result);
      setFilterReferences((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of result) byId.set(item.id, item);
        return [...byId.values()];
      });
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [contractorId, generatedByUserId, legalEntityId, period, search, showError, type]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const legalEntityOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of filterReferences) {
      if (item.legalEntity) values.set(item.legalEntity.id, item.legalEntity.name);
    }
    return [...values].map(([value, label]) => ({ value, label }));
  }, [filterReferences]);

  const contractorOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of filterReferences) {
      if (item.contractor) values.set(item.contractor.id, item.contractor.name);
    }
    return [...values].map(([value, label]) => ({ value, label }));
  }, [filterReferences]);

  const generatedByOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of filterReferences) {
      values.set(item.generatedBy.id, item.generatedBy.fullName);
    }
    return [...values].map(([value, label]) => ({ value, label }));
  }, [filterReferences]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  ), [i18n.language]);

  const download = useCallback(async (document: GeneratedDocumentRecord) => {
    setDownloadingId(document.id);
    try {
      const { blob, filename } = await apiDownload(
        `/documents/${document.id}/download`,
        { method: 'POST' },
      );
      saveBlob(blob, filename);
      void message.success(t('documents.registry.messages.downloaded'));
    } catch (error) {
      showError(error);
    } finally {
      setDownloadingId(undefined);
    }
  }, [message, showError, t]);

  const canDownload = useCallback((document: GeneratedDocumentRecord) => {
    return canDownloadDocument(document, user?.roles ?? []);
  }, [user?.roles]);

  const resetFilters = () => {
    setType(undefined);
    setPeriod(null);
    setLegalEntityId(undefined);
    setContractorId(undefined);
    setGeneratedByUserId(undefined);
    setSearchInput('');
    setSearch('');
  };

  const columns = useMemo<ColumnsType<GeneratedDocumentRecord>>(() => [
    {
      title: t('documents.registry.columns.number'),
      dataIndex: 'number',
      width: 190,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('documents.registry.columns.type'),
      dataIndex: 'type',
      width: 190,
      render: (value: GeneratedDocumentType) => (
        <Tag color={TYPE_COLORS[value]}>
          {t(`documents.registry.types.${value}`)}
        </Tag>
      ),
    },
    {
      title: t('documents.registry.columns.generatedAt'),
      dataIndex: 'generatedAt',
      width: 190,
      render: formatDate,
    },
    {
      title: t('documents.registry.columns.generatedBy'),
      dataIndex: ['generatedBy', 'fullName'],
      width: 210,
      ellipsis: true,
    },
    {
      title: t('documents.registry.columns.legalEntity'),
      dataIndex: ['legalEntity', 'name'],
      width: 210,
      ellipsis: true,
      render: (value?: string) => value ?? t('common.dash'),
    },
    {
      title: t('documents.registry.columns.contractor'),
      dataIndex: ['contractor', 'name'],
      width: 240,
      ellipsis: true,
      render: (value?: string) => value ?? t('common.dash'),
    },
    {
      title: t('documents.registry.columns.source'),
      dataIndex: 'source',
      width: 220,
      render: (source: GeneratedDocumentSource | null) => source ? (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            {t(`documents.registry.sources.${source.type}`)}
          </Typography.Text>
          <Typography.Text type="secondary">
            {source.number ?? t('common.dash')}
          </Typography.Text>
        </Space>
      ) : t('common.dash'),
    },
    {
      title: t('documents.registry.columns.actions'),
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, document) => (
        <Button
          icon={<DownloadOutlined />}
          disabled={!canDownload(document)}
          title={canDownload(document)
            ? undefined
            : t('documents.registry.actions.downloadUnavailable')}
          loading={downloadingId === document.id}
          onClick={(event) => {
            event.stopPropagation();
            void download(document);
          }}
        >
          {t('documents.registry.actions.download')}
        </Button>
      ),
    },
  ], [canDownload, download, downloadingId, formatDate, t]);

  return (
    <section className="list-page documents-list-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('documents.registry.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('documents.registry.subtitle')}
          </Typography.Text>
        </div>
      </div>

      <Card className="transport-card">
        <div className="documents-filter-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            className="documents-search-filter"
            placeholder={t('documents.registry.filters.search')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Select
            allowClear
            className="documents-select-filter"
            placeholder={t('documents.registry.filters.type')}
            value={type}
            onChange={setType}
            options={DOCUMENT_TYPES.map((value) => ({
              value,
              label: t(`documents.registry.types.${value}`),
            }))}
          />
          <DatePicker.RangePicker
            className="documents-period-filter"
            value={period}
            onChange={(value) => setPeriod(value ? [value[0], value[1]] : null)}
            placeholder={[
              t('documents.registry.filters.dateFrom'),
              t('documents.registry.filters.dateTo'),
            ]}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className="documents-select-filter"
            placeholder={t('documents.registry.filters.legalEntity')}
            value={legalEntityId}
            onChange={setLegalEntityId}
            options={legalEntityOptions}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className="documents-select-filter"
            placeholder={t('documents.registry.filters.contractor')}
            value={contractorId}
            onChange={setContractorId}
            options={contractorOptions}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className="documents-select-filter"
            placeholder={t('documents.registry.filters.generatedBy')}
            value={generatedByUserId}
            onChange={setGeneratedByUserId}
            options={generatedByOptions}
          />
          <Button onClick={resetFilters}>
            {t('documents.registry.actions.clearFilters')}
          </Button>
        </div>

        <Table<GeneratedDocumentRecord>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={documents}
          scroll={{ x: 1440 }}
          locale={{ emptyText: t('documents.registry.empty') }}
          rowClassName={(document) => sourcePath(document.source) ? 'clickable-row' : ''}
          onRow={(document) => ({
            onClick: () => {
              const path = sourcePath(document.source);
              if (path) navigate(path);
            },
          })}
        />
      </Card>
    </section>
  );
}
