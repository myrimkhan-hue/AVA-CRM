import { App, Card, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { ExportXlsxButton } from '../reports/ExportXlsxButton';
import { ReceivableRow } from '../reports/shared';

export function ReceivablesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiRequest<ReceivableRow[]>('/reports/receivables'));
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

  const totalKzt = useMemo(() => rows.reduce((sum, row) => sum + row.balanceKzt, 0), [rows]);

  const columns = useMemo<ColumnsType<ReceivableRow>>(() => [
    {
      title: t('reports.receivables.columns.invoice'), dataIndex: 'invoiceNumber', width: 160,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: t('reports.receivables.columns.transportation'), dataIndex: 'transportationNumber', width: 180 },
    { title: t('reports.receivables.columns.client'), dataIndex: 'clientName', ellipsis: true },
    { title: t('reports.receivables.columns.legalEntity'), dataIndex: 'legalEntityName', ellipsis: true },
    {
      title: t('reports.receivables.columns.balance'), key: 'balance', width: 170, align: 'right',
      sorter: (left, right) => left.balanceKzt - right.balanceKzt,
      render: (_, row) => (
        <Space direction="vertical" size={0} className="full-width" align="end">
          <span>{formatMoney(row.balanceAmount, row.currencyCode)}</span>
          {row.currencyCode !== 'KZT' && <Typography.Text type="secondary">{formatMoney(row.balanceKzt, 'KZT')}</Typography.Text>}
        </Space>
      ),
    },
    {
      title: t('reports.receivables.columns.dueDate'), dataIndex: 'dueDate', width: 160,
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
            <Typography.Text type="secondary">{t('reports.receivables.total')}</Typography.Text>
            <Typography.Title level={3}>{formatMoney(totalKzt, 'KZT')}</Typography.Title>
          </div>
          <ExportXlsxButton path="/reports/receivables/export" />
        </div>
        <Table<ReceivableRow>
          rowKey="invoiceId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1100 }}
          locale={{ emptyText: t('reports.receivables.empty') }}
          onRow={(row) => ({ onClick: () => navigate(`/transportations/${row.transportationId}`) })}
        />
      </Card>
    </section>
  );
}
