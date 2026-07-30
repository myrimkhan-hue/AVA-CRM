import { App, Card, Collapse, DatePicker, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { ExportXlsxButton } from '../reports/ExportXlsxButton';
import {
  MOTIVATION_PAYMENT_STATUS_COLORS,
  MotivationReport,
  MotivationRow,
} from '../motivation/shared';

export function MotivationReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [reports, setReports] = useState<MotivationReport[]>([]);
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await apiRequest<MotivationReport[]>(
        `/motivation/report?month=${month.format('YYYY-MM')}`,
      ));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [month, showError]);

  useEffect(() => { void load(); }, [load]);

  const formatMoney = useCallback((value: number) => (
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(value)
  ), [i18n.language]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  ), [i18n.language]);

  const grandTotalBonus = useMemo(
    () => reports.reduce((sum, report) => sum + report.totalBonusKzt, 0),
    [reports],
  );
  const grandTotalMargin = useMemo(
    () => reports.reduce((sum, report) => sum + report.totalMarginKzt, 0),
    [reports],
  );

  const rowColumns = useMemo<ColumnsType<MotivationRow>>(() => [
    { title: t('motivation.columns.transportation'), dataIndex: 'number', width: 180 },
    { title: t('motivation.columns.route'), dataIndex: 'route' },
    {
      title: t('motivation.columns.unloadingDate'), dataIndex: 'unloadingDate', width: 140,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('motivation.columns.margin'), dataIndex: 'marginKzt', width: 170, align: 'right',
      render: (value: number) => formatMoney(value),
    },
    {
      title: t('motivation.columns.paymentStatus'), dataIndex: 'paymentStatus', width: 140,
      render: (value: MotivationRow['paymentStatus']) => (
        <Tag color={MOTIVATION_PAYMENT_STATUS_COLORS[value]}>{t(`motivation.paymentStatuses.${value}`)}</Tag>
      ),
    },
  ], [formatDate, formatMoney, t]);

  return (
    <section className="reports-page motivation-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('motivation.summary.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('motivation.summary.subtitle')}</Typography.Text>
        </div>
        <Space>
          <DatePicker picker="month" value={month} onChange={(value) => value && setMonth(value)} allowClear={false} />
          <ExportXlsxButton path={`/motivation/report/export?month=${month.format('YYYY-MM')}`} />
        </Space>
      </div>

      <div className="reports-summary-row motivation-kpis">
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.kpis.employees')}</Typography.Text>
          <Typography.Title level={3}>{reports.length}</Typography.Title>
        </Card>
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.kpis.totalMargin')}</Typography.Text>
          <Typography.Title level={3}>{formatMoney(grandTotalMargin)}</Typography.Title>
        </Card>
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.summary.totalBonus')}</Typography.Text>
          <Typography.Title level={3} className="motivation-bonus">{formatMoney(grandTotalBonus)}</Typography.Title>
        </Card>
      </div>

      <Card className="transport-card" loading={loading}>
        <Collapse
          items={reports.map((report) => ({
            key: report.userId,
            label: (
              <div className="motivation-summary-row">
                <Typography.Text strong>{report.fullName}</Typography.Text>
                <Typography.Text type="secondary">{t('motivation.summary.rate', { rate: report.ratePercent })}</Typography.Text>
                <Typography.Text type="secondary">{t('motivation.kpis.count')}: {report.rows.length}</Typography.Text>
                <Typography.Text strong>{formatMoney(report.totalMarginKzt)}</Typography.Text>
                <Typography.Text strong className="motivation-bonus">{formatMoney(report.totalBonusKzt)}</Typography.Text>
              </div>
            ),
            children: (
              <Table<MotivationRow>
                rowKey="transportationId"
                columns={rowColumns}
                dataSource={report.rows}
                pagination={false}
                size="small"
                onRow={(row) => ({ onClick: () => navigate(`/transportations/${row.transportationId}`) })}
              />
            ),
          }))}
        />
        {reports.length === 0 && !loading && (
          <Typography.Text type="secondary">{t('motivation.summary.empty')}</Typography.Text>
        )}
      </Card>
    </section>
  );
}
