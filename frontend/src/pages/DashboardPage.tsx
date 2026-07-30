import { App, Card, DatePicker, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import {
  CashCalendarPeriod,
  DashboardFinanceRow,
  DashboardResult,
  MarginTotals,
} from '../reports/shared';

const { RangePicker } = DatePicker;

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const [result, setResult] = useState<DashboardResult>();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = range[0].format('YYYY-MM-DD');
      const to = range[1].format('YYYY-MM-DD');
      setResult(await apiRequest<DashboardResult>(`/reports/dashboard?from=${from}&to=${to}`));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [range, showError]);

  useEffect(() => { void load(); }, [load]);

  const formatMoney = useCallback((value: number) => (
    new Intl.NumberFormat(i18n.language, {
      style: 'currency', currency: 'KZT', maximumFractionDigits: 0,
    }).format(value)
  ), [i18n.language]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  ), [i18n.language]);

  const financeColumns = useCallback((
    labelTitle: string,
    labelKey: 'legalEntityName' | 'managerName',
  ): ColumnsType<DashboardFinanceRow> => [
    { title: labelTitle, dataIndex: labelKey, key: 'label' },
    {
      title: t('margin.income'), dataIndex: 'incomeTotalKzt', align: 'right', width: 170,
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('margin.expense'), dataIndex: 'expenseTotalKzt', align: 'right', width: 170,
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('margin.margin'), dataIndex: 'marginKzt', align: 'right', width: 190,
      render: (value: number, row) => (
        <Typography.Text strong className={value < 0 ? 'cash-calendar-negative' : undefined}>
          {formatMoney(value)} <Typography.Text type="secondary">({row.marginPercent}%)</Typography.Text>
        </Typography.Text>
      ),
    },
  ], [formatMoney, t]);

  const cashColumns = useMemo<ColumnsType<CashCalendarPeriod>>(() => [
    {
      title: t('reports.cashCalendar.columns.period'), key: 'period', width: 160,
      render: (_, row) => formatDate(row.periodStart),
    },
    {
      title: t('reports.cashCalendar.columns.income'), dataIndex: 'expectedIncomeKzt', align: 'right', width: 170,
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('reports.cashCalendar.columns.expense'), dataIndex: 'expectedExpenseKzt', align: 'right', width: 170,
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('reports.cashCalendar.columns.balance'), dataIndex: 'runningBalanceKzt', align: 'right', width: 180,
      render: (value: number) => (
        <Typography.Text strong className={value < 0 ? 'cash-calendar-negative' : undefined}>
          {formatMoney(value)}
        </Typography.Text>
      ),
    },
  ], [formatDate, formatMoney, t]);

  const total: MarginTotals | undefined = result?.finance.total;

  return (
    <section className="reports-page dashboard-page">
      <Card className="transport-card">
        <div className="reports-toolbar">
          <div>
            <Typography.Text type="secondary">{t('reports.dashboard.periodLabel')}</Typography.Text>
            <div>
              <RangePicker
                value={range}
                allowClear={false}
                onChange={(value) => {
                  if (value?.[0] && value[1]) setRange([value[0], value[1]]);
                }}
              />
            </div>
          </div>
          <div className="reports-summary-row">
            <div>
              <Typography.Text type="secondary">{t('reports.dashboard.activeTransportations')}</Typography.Text>
              <Typography.Title level={3}>{result?.transportations.activeCount ?? '—'}</Typography.Title>
            </div>
            <div>
              <Typography.Text type="secondary">{t('reports.dashboard.funnelTotal')}</Typography.Text>
              <Typography.Title level={3}>{result?.dealsFunnel.totalDeals ?? '—'}</Typography.Title>
            </div>
            <div>
              <Typography.Text type="secondary">{t('reports.dashboard.funnelConversion')}</Typography.Text>
              <Typography.Title level={3}>
                {result ? `${result.dealsFunnel.conversionPercent}%` : '—'}
              </Typography.Title>
            </div>
            <div>
              <Typography.Text type="secondary">{t('margin.margin')}</Typography.Text>
              <Typography.Title
                level={3}
                className={total && total.marginKzt < 0 ? 'cash-calendar-negative' : undefined}
              >
                {total ? formatMoney(total.marginKzt) : '—'}
                {total?.isForecast ? (
                  <Tag color="processing" className="dashboard-forecast-tag">{t('margin.forecast')}</Tag>
                ) : null}
              </Typography.Title>
            </div>
          </div>
        </div>
      </Card>

      <div className="dashboard-grid">
        <Card className="transport-card" title={t('reports.dashboard.byStatus')} loading={loading}>
          <ul className="dashboard-status-list">
            {result?.transportations.byStatus.map((row) => (
              <li key={row.status}>
                <span>{t(`transportations.statuses.${row.status}`)}</span>
                <Typography.Text strong>{row.count}</Typography.Text>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="transport-card" title={t('reports.dashboard.funnel')} loading={loading}>
          <ul className="dashboard-status-list">
            {result?.dealsFunnel.byStage.map((row) => (
              <li key={row.stage}>
                <span>{t(`deals.stages.${row.stage}`)}</span>
                <Typography.Text strong>{row.count}</Typography.Text>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        className="transport-card"
        title={t('reports.dashboard.finance')}
        extra={<Typography.Text type="secondary">{t('reports.dashboard.financeHint')}</Typography.Text>}
        loading={loading}
      >
        <Typography.Title level={5}>{t('reports.dashboard.byLegalEntity')}</Typography.Title>
        <Table<DashboardFinanceRow>
          rowKey={(row) => row.legalEntityId ?? ''}
          columns={financeColumns(t('reports.dashboard.legalEntity'), 'legalEntityName')}
          dataSource={result?.finance.byLegalEntity ?? []}
          pagination={false}
          size="small"
          scroll={{ x: 760 }}
          locale={{ emptyText: t('reports.dashboard.noFinance') }}
        />
        <Typography.Title level={5} className="dashboard-subtitle">
          {t('reports.dashboard.byManager')}
        </Typography.Title>
        <Table<DashboardFinanceRow>
          rowKey={(row) => row.managerId ?? ''}
          columns={financeColumns(t('reports.dashboard.manager'), 'managerName')}
          dataSource={result?.finance.byManager ?? []}
          pagination={false}
          size="small"
          scroll={{ x: 760 }}
          locale={{ emptyText: t('reports.dashboard.noFinance') }}
        />
      </Card>

      <div className="dashboard-grid">
        <Card className="transport-card" title={t('reports.dashboard.topDebtors')} loading={loading}>
          <Table
            rowKey="clientId"
            columns={[
              { title: t('reports.dashboard.client'), dataIndex: 'clientName' },
              {
                title: t('reports.dashboard.debt'), dataIndex: 'balanceKzt', align: 'right', width: 170,
                render: (value: number) => formatMoney(value),
              },
            ]}
            dataSource={result?.topDebtors ?? []}
            pagination={false}
            size="small"
            locale={{ emptyText: t('reports.dashboard.noDebtors') }}
          />
        </Card>

        <Card className="transport-card" title={t('reports.dashboard.topCreditors')} loading={loading}>
          <Table
            rowKey="payeeId"
            columns={[
              { title: t('reports.dashboard.payee'), dataIndex: 'payeeName' },
              {
                title: t('reports.dashboard.debt'), dataIndex: 'amountKzt', align: 'right', width: 170,
                render: (value: number) => formatMoney(value),
              },
            ]}
            dataSource={result?.topCreditors ?? []}
            pagination={false}
            size="small"
            locale={{ emptyText: t('reports.dashboard.noCreditors') }}
          />
        </Card>
      </div>

      <Card
        className="transport-card"
        title={t('reports.dashboard.cashCalendar')}
        extra={<Link to="/reports/cash-calendar">{t('reports.dashboard.cashCalendarLink')}</Link>}
        loading={loading}
      >
        <Table<CashCalendarPeriod>
          rowKey="periodStart"
          columns={cashColumns}
          dataSource={result?.cashCalendar.periods ?? []}
          pagination={false}
          size="small"
          scroll={{ x: 680 }}
          locale={{ emptyText: t('reports.cashCalendar.empty') }}
        />
      </Card>
    </section>
  );
}
