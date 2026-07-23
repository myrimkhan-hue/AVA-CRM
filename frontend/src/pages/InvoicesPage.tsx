import {
  Alert,
  App,
  Card,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_COLORS,
  Invoice,
  InvoiceStatus,
} from '../invoices/shared';

export function InvoicesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<InvoiceStatus>();
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const query = params.toString();
      setInvoices(await apiRequest<Invoice[]>(
        `/invoices${query ? `?${query}` : ''}`,
      ));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError, status]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
      .format(new Date(value))
  ), [i18n.language]);

  const formatMoney = useCallback((value: string, currency: string) => (
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value))
  ), [i18n.language]);

  const columns = useMemo<ColumnsType<Invoice>>(() => [
    {
      title: t('invoices.columns.number'),
      dataIndex: 'number',
      width: 170,
      sorter: (left, right) => left.number.localeCompare(right.number),
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: t('invoices.columns.transportation'),
      dataIndex: ['transportation', 'number'],
      width: 180,
    },
    {
      title: t('invoices.columns.deal'),
      dataIndex: ['transportation', 'deal', 'number'],
      width: 160,
    },
    {
      title: t('invoices.columns.client'),
      dataIndex: ['client', 'name'],
      ellipsis: true,
    },
    {
      title: t('invoices.columns.legalEntity'),
      dataIndex: ['legalEntity', 'name'],
      ellipsis: true,
    },
    {
      title: t('invoices.columns.currency'),
      dataIndex: ['currency', 'code'],
      width: 90,
    },
    {
      title: t('invoices.columns.total'),
      key: 'total',
      width: 160,
      align: 'right',
      sorter: (left, right) =>
        Number(left.totals.totalAmount) - Number(right.totals.totalAmount),
      render: (_, invoice) => formatMoney(
        invoice.totals.totalAmount,
        invoice.currency.code,
      ),
    },
    {
      title: t('invoices.columns.status'),
      dataIndex: 'status',
      width: 150,
      render: (value: InvoiceStatus) => (
        <Tag color={INVOICE_STATUS_COLORS[value]}>
          {t(`invoices.statuses.${value}`)}
        </Tag>
      ),
    },
    {
      title: t('invoices.columns.dueDate'),
      dataIndex: 'dueDate',
      width: 145,
      sorter: (left, right) =>
        new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
      render: (value: string, invoice) => (
        <Space direction="vertical" size={0}>
          <span>{formatDate(value)}</span>
          {invoice.isOverdue && (
            <Tag color="red">{t('invoices.overdue')}</Tag>
          )}
        </Space>
      ),
    },
  ], [formatDate, formatMoney, t]);

  return (
    <section className="list-page invoice-list-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('invoices.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('invoices.subtitle')}
          </Typography.Text>
        </div>
      </div>

      <Card className="transport-card">
        <div className="table-toolbar">
          <Select
            allowClear
            className="invoice-status-filter"
            placeholder={t('invoices.filters.status')}
            value={status}
            onChange={setStatus}
            options={INVOICE_STATUSES.map((value) => ({
              value,
              label: t(`invoices.statuses.${value}`),
            }))}
          />
        </div>
        <Alert
          type="info"
          showIcon
          message={t('invoices.create.fromDealHint')}
          className="invoice-create-hint"
        />
        <Table<Invoice>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={invoices}
          scroll={{ x: 1280 }}
          locale={{ emptyText: t('invoices.empty') }}
          onRow={(invoice) => ({
            onClick: () => navigate(
              `/transportations/${invoice.transportation.id}`,
            ),
          })}
        />
      </Card>
    </section>
  );
}
