import { App, Card, DatePicker, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ExportXlsxButton } from '../reports/ExportXlsxButton';
import type { QuoteConversionMetrics, QuoteConversionResult } from '../reports/shared';

export function QuoteConversionPage() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { user } = useAuth();
  const canSelectDepartment = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role)));
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf('month'), dayjs().endOf('month')]);
  const [departmentId, setDepartmentId] = useState<string>();
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [result, setResult] = useState<QuoteConversionResult>();
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => {
    const params = new URLSearchParams({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') });
    if (canSelectDepartment && departmentId) params.set('departmentId', departmentId);
    return params.toString();
  }, [range, departmentId, canSelectDepartment]);

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  useEffect(() => {
    if (!canSelectDepartment) return;
    let active = true;
    void apiRequest<Array<{ id: string; name: string }>>('/departments')
      .then((data) => { if (active) setDepartments(data); })
      .catch((error: unknown) => { if (active) showError(error); });
    return () => { active = false; };
  }, [canSelectDepartment, showError]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(undefined);
    void apiRequest<QuoteConversionResult>(`/reports/quote-conversion?${query}`)
      .then((data) => { if (active) setResult(data); })
      .catch((error: unknown) => { if (active) showError(error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, showError]);

  const formatPercent = (value: number) => new Intl.NumberFormat(i18n.language, {
    style: 'percent', maximumFractionDigits: 2,
  }).format(value / 100);
  const metricKeys = ['total', 'won', 'lost', 'inProgress', 'conversionPercent'] as const;
  // Колонки с метриками одинаковы во всех разрезах, но строки у разрезов разные
  // (у направлений есть точки маршрута, у людей — имя). Поэтому колонки обобщённые:
  // иначе таблица направлений не видит собственных полей строки.
  const metricColumns = <R extends QuoteConversionMetrics,>(): ColumnsType<R> => metricKeys.map((key) => ({
    title: t(`reports.quoteConversion.${key}`), dataIndex: key, key, align: 'right',
    render: (value: number) => key === 'conversionPercent' ? formatPercent(value) : value,
  }));
  const peopleColumns = <R extends QuoteConversionMetrics & { name: string | null },>(
    label: 'manager' | 'logist',
  ): ColumnsType<R> => [
    { title: t(`reports.quoteConversion.${label}`), dataIndex: 'name', render: (value: string | null) => value ?? t('reports.quoteConversion.unassigned') },
    ...metricColumns<R>(),
  ];
  const emptyText = t('reports.quoteConversion.empty');

  return (
    <section className="reports-page dashboard-page">
      <Card className="transport-card">
        <Typography.Title level={2}>{t('reports.quoteConversion.title')}</Typography.Title>
        <Typography.Paragraph type="secondary">{t('reports.quoteConversion.hint')}</Typography.Paragraph>
        <div className="reports-toolbar">
          <Space wrap>
            <div>
              <Typography.Text type="secondary">{t('reports.quoteConversion.period')}</Typography.Text>
              <div>
                <DatePicker.RangePicker value={range} allowClear={false} onChange={(value) => {
                  if (value?.[0] && value[1]) setRange([value[0], value[1]]);
                }} />
              </div>
            </div>
            {canSelectDepartment && (
              <div>
                <Typography.Text type="secondary">{t('reports.quoteConversion.department')}</Typography.Text>
                <div>
                  <Select
                    style={{ minWidth: 220 }} allowClear value={departmentId} onChange={setDepartmentId}
                    placeholder={t('reports.quoteConversion.allDepartments')}
                    aria-label={t('reports.quoteConversion.department')}
                    options={departments.map((department) => ({ value: department.id, label: department.name }))}
                  />
                </div>
              </div>
            )}
          </Space>
          <ExportXlsxButton path={`/reports/quote-conversion/export?${query}`} />
        </div>
        <div className="reports-summary-row">
          {metricKeys.map((key) => (
            <div key={key}>
              <Typography.Text type="secondary">{t(`reports.quoteConversion.${key}`)}</Typography.Text>
              <Typography.Title level={3}>
                {result ? key === 'conversionPercent' ? formatPercent(result.summary[key]) : result.summary[key] : t('reports.quoteConversion.noValue')}
              </Typography.Title>
            </div>
          ))}
        </div>
        {result && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
            {t('reports.quoteConversion.stalledHint', { days: result.stalledDays, count: result.stalledRateSentCount })}
          </Typography.Paragraph>
        )}
      </Card>
      <Card className="transport-card" title={t('reports.quoteConversion.byManager')}>
        <Table<QuoteConversionResult['byManager'][number]> rowKey={(row) => row.id} columns={peopleColumns<QuoteConversionResult['byManager'][number]>('manager')} dataSource={result?.byManager ?? []} loading={loading} pagination={false} scroll={{ x: 780 }} locale={{ emptyText }} />
      </Card>
      <Card className="transport-card" title={t('reports.quoteConversion.byLogist')}>
        <Table<QuoteConversionResult['byLogist'][number]> rowKey={(row) => row.id ?? 'unassigned'} columns={peopleColumns<QuoteConversionResult['byLogist'][number]>('logist')} dataSource={result?.byLogist ?? []} loading={loading} pagination={false} scroll={{ x: 780 }} locale={{ emptyText }} />
      </Card>
      <Card className="transport-card" title={t('reports.quoteConversion.byDirection')}>
        <Table<QuoteConversionResult['byDirection'][number]> rowKey="id" columns={[
          { title: t('reports.quoteConversion.direction'), key: 'direction', render: (_, row) => t('reports.quoteConversion.route', { from: row.originPoint, to: row.destinationPoint }) },
          ...metricColumns<QuoteConversionResult['byDirection'][number]>(),
        ]} dataSource={result?.byDirection ?? []} loading={loading} pagination={false} scroll={{ x: 780 }} locale={{ emptyText }} />
      </Card>
      <Card className="transport-card" title={t('reports.quoteConversion.byRejectReason')}>
        <Table rowKey={(row) => row.reason ?? 'unknown'} columns={[
          { title: t('reports.quoteConversion.reason'), dataIndex: 'reason', render: (value: string | null) => value ? t(`deals.reasons.${value}`) : t('reports.quoteConversion.unknownReason') },
          { title: t('reports.quoteConversion.count'), dataIndex: 'count', align: 'right' },
          { title: t('reports.quoteConversion.sharePercent'), dataIndex: 'sharePercent', align: 'right', render: formatPercent },
        ]} dataSource={result?.byRejectReason ?? []} loading={loading} pagination={false} locale={{ emptyText }} />
      </Card>
    </section>
  );
}
