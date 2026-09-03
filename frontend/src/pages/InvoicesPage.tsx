import {
  Alert,
  App,
  Card,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_COLORS,
  Invoice,
  InvoiceStatus,
} from '../invoices/shared';

export function InvoicesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<InvoiceStatus>();
  const [onlyIntragroup, setOnlyIntragroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const canSeeIntragroup = Boolean(
    user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role)),
  );

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
      if (onlyIntragroup) params.set('onlyIntragroup', 'true');
      const query = params.toString();
      setInvoices(await apiRequest<Invoice[]>(
        `/invoices${query ? `?${query}` : ''}`,
      ));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [onlyIntragroup, showError, status]);

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
      render: (value: string, invoice) => (
        <Space size={4}>
          <Typography.Text strong>{value}</Typography.Text>
          {invoice.isIntragroup && <Tag color="purple">{t('invoices.intragroup')}</Tag>}
        </Space>
      ),
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


  const formatAmount = useCallback(
    (value: number, code: string) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ${code}`,
    [],
  );

  const summary = useMemo(() => {
    const buckets: Record<string, { amounts: Record<string, number>; count: number }> = {
      issued: { amounts: {}, count: 0 },
      paid: { amounts: {}, count: 0 },
      awaiting: { amounts: {}, count: 0 },
      overdue: { amounts: {}, count: 0 },
    };
    const add = (key: string, code: string, value: number) => {
      if (!Number.isFinite(value) || value === 0) return;
      buckets[key].amounts[code] = (buckets[key].amounts[code] ?? 0) + value;
    };
    for (const invoice of invoices) {
      const code = invoice.currency.code;
      const total = Number(invoice.totals.totalAmount);
      const paid = Number(invoice.totals.paidAmount);
      const balance = Number(invoice.totals.balanceAmount);
      buckets.issued.count += 1;
      add('issued', code, total);
      if (paid > 0) { buckets.paid.count += 1; add('paid', code, paid); }
      if (balance > 0) {
        const key = invoice.isOverdue ? 'overdue' : 'awaiting';
        buckets[key].count += 1;
        add(key, code, balance);
      }
    }
    const tones: Record<string, string | undefined> = { issued: undefined, paid: 'positive', awaiting: undefined, overdue: 'dark' };
    return (['issued', 'paid', 'awaiting', 'overdue'] as const).map((key) => ({
      key,
      tone: tones[key],
      count: buckets[key].count,
      amounts: Object.entries(buckets[key].amounts).sort((left, right) => right[1] - left[1]),
    }));
  }, [invoices]);

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

      <div className="kpi-row">
        {summary.map((card) => (
          <div className={`kpi-card${card.tone ? ` ${card.tone}` : ''}`} key={card.key}>
            <div className="kpi-card-label">{t(`invoices.summary.${card.key}`)}</div>
            <div className="kpi-card-value">
              {card.amounts.length === 0
                ? t('invoices.summary.none')
                : card.amounts.map(([code, value]) => (
                  <div key={code}>{formatAmount(value, code)}</div>
                ))}
            </div>
            <div className="kpi-card-note">{t('invoices.summary.count', { count: card.count })}</div>
          </div>
        ))}
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
          {canSeeIntragroup && (
            <Space>
              <Switch checked={onlyIntragroup} onChange={setOnlyIntragroup} />
              <Typography.Text>{t('invoices.filters.onlyIntragroup')}</Typography.Text>
            </Space>
          )}
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
