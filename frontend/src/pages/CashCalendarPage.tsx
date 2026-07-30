import { App, Card, Radio, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { ExportXlsxButton } from '../reports/ExportXlsxButton';
import { CashCalendarPeriod, CashCalendarResult } from '../reports/shared';

export function CashCalendarPage() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const [result, setResult] = useState<CashCalendarResult>();
  const [groupBy, setGroupBy] = useState<'day' | 'week'>('day');
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await apiRequest<CashCalendarResult>(`/reports/cash-calendar?groupBy=${groupBy}`));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [groupBy, showError]);

  useEffect(() => { void load(); }, [load]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  ), [i18n.language]);

  const formatMoney = useCallback((value: number) => (
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(value)
  ), [i18n.language]);

  const columns = useMemo<ColumnsType<CashCalendarPeriod>>(() => [
    {
      title: t('reports.cashCalendar.columns.period'), key: 'period', width: 220,
      render: (_, row) => (row.periodStart === row.periodEnd
        ? formatDate(row.periodStart)
        : `${formatDate(row.periodStart)} — ${formatDate(row.periodEnd)}`),
    },
    {
      title: t('reports.cashCalendar.columns.income'), dataIndex: 'expectedIncomeKzt', width: 180, align: 'right',
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('reports.cashCalendar.columns.expense'), dataIndex: 'expectedExpenseKzt', width: 180, align: 'right',
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('reports.cashCalendar.columns.net'), dataIndex: 'netKzt', width: 180, align: 'right',
      render: (value: number) => (
        <span className={value < 0 ? 'cash-calendar-negative' : undefined}>{formatMoney(value)}</span>
      ),
    },
    {
      title: t('reports.cashCalendar.columns.balance'), dataIndex: 'runningBalanceKzt', width: 180, align: 'right',
      render: (value: number) => (
        <Typography.Text strong className={value < 0 ? 'cash-calendar-negative' : undefined}>
          {formatMoney(value)}
        </Typography.Text>
      ),
    },
  ], [formatDate, formatMoney, t]);

  return (
    <section className="reports-page">
      <Card className="transport-card">
        <div className="reports-toolbar">
          <div className="reports-summary-row">
            <div>
              <Typography.Text type="secondary">{t('reports.cashCalendar.overdueIncome')}</Typography.Text>
              <Typography.Title level={4}>{result ? formatMoney(result.overdueIncomeKzt) : '—'}</Typography.Title>
            </div>
            <div>
              <Typography.Text type="secondary">{t('reports.cashCalendar.overdueExpense')}</Typography.Text>
              <Typography.Title level={4}>{result ? formatMoney(result.overdueExpenseKzt) : '—'}</Typography.Title>
            </div>
            <div>
              <Typography.Text type="secondary">{t('reports.cashCalendar.openingBalance')}</Typography.Text>
              <Typography.Title level={4} className={result && result.openingBalanceKzt < 0 ? 'cash-calendar-negative' : undefined}>
                {result ? formatMoney(result.openingBalanceKzt) : '—'}
              </Typography.Title>
            </div>
          </div>
          <Space>
            <Radio.Group value={groupBy} onChange={(event) => setGroupBy(event.target.value)} optionType="button">
              <Radio.Button value="day">{t('reports.cashCalendar.byDay')}</Radio.Button>
              <Radio.Button value="week">{t('reports.cashCalendar.byWeek')}</Radio.Button>
            </Radio.Group>
            <ExportXlsxButton path={`/reports/cash-calendar/export?groupBy=${groupBy}`} />
          </Space>
        </div>
        <Table<CashCalendarPeriod>
          rowKey="periodStart"
          loading={loading}
          columns={columns}
          dataSource={result?.periods ?? []}
          pagination={false}
          scroll={{ x: 900, y: 520 }}
          locale={{ emptyText: t('reports.cashCalendar.empty') }}
        />
      </Card>
    </section>
  );
}
