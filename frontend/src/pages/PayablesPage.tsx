import { App, Card, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { ExportXlsxButton } from '../reports/ExportXlsxButton';
import { PayableRow } from '../reports/shared';

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'blue',
  APPROVED: 'orange',
};

export function PayablesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState<PayableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiRequest<PayableRow[]>('/reports/payables'));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  ), [i18n.language]);

  const formatMoney = useCallback((value: number | string, currency: string) => (
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
  ), [i18n.language]);

  const totalKzt = useMemo(() => rows.reduce((sum, row) => sum + row.amountKzt, 0), [rows]);

  const columns = useMemo<ColumnsType<PayableRow>>(() => [
    { title: t('reports.payables.columns.transportation'), dataIndex: 'transportationNumber', width: 180 },
    { title: t('reports.payables.columns.payee'), dataIndex: 'payeeName', ellipsis: true },
    { title: t('reports.payables.columns.purpose'), dataIndex: 'purpose', ellipsis: true },
    {
      title: t('reports.payables.columns.status'), dataIndex: 'status', width: 140,
      render: (value: string) => <Tag color={STATUS_COLORS[value]}>{t(`paymentRequests.statuses.${value}`)}</Tag>,
    },
    {
      title: t('reports.payables.columns.amount'), key: 'amount', width: 170, align: 'right',
      sorter: (left, right) => left.amountKzt - right.amountKzt,
      render: (_, row) => (
        <Space direction="vertical" size={0} className="full-width" align="end">
          <span>{formatMoney(row.amount, row.currencyCode)}</span>
          {row.currencyCode !== 'KZT' && <Typography.Text type="secondary">{formatMoney(row.amountKzt, 'KZT')}</Typography.Text>}
        </Space>
      ),
    },
    {
      title: t('reports.payables.columns.dueDate'), dataIndex: 'dueDate', width: 160,
      sorter: (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
      render: (value: string, row) => (
        <Space direction="vertical" size={0}>
          <span>{formatDate(value)}</span>
          {row.isOverdue && <Tag color="red">{t('reports.overdueDays', { count: row.daysOverdue })}</Tag>}
        </Space>
      ),
    },
  ], [formatDate, formatMoney, t]);

  return (
    <section className="reports-page">
      <Card className="transport-card">
        <div className="reports-toolbar">
          <div className="reports-summary">
            <Typography.Text type="secondary">{t('reports.payables.total')}</Typography.Text>
            <Typography.Title level={3}>{formatMoney(totalKzt, 'KZT')}</Typography.Title>
          </div>
          <ExportXlsxButton path="/reports/payables/export" />
        </div>
        <Table<PayableRow>
          rowKey="paymentRequestId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1100 }}
          locale={{ emptyText: t('reports.payables.empty') }}
          onRow={(row) => ({ onClick: () => navigate(`/transportations/${row.transportationId}`) })}
        />
      </Card>
    </section>
  );
}
