import { App, Card, DatePicker, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import {
  MOTIVATION_PAYMENT_STATUS_COLORS,
  MotivationReport,
  MotivationRow,
} from '../motivation/shared';

export function MyMotivationPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [report, setReport] = useState<MotivationReport>();
  const [loading, setLoading] = useState(true);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await apiRequest<MotivationReport>(
        `/motivation/my-report?month=${month.format('YYYY-MM')}`,
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

  const paidCount = useMemo(
    () => report?.rows.filter((row) => row.paymentStatus === 'full').length ?? 0,
    [report],
  );

  const columns = useMemo<ColumnsType<MotivationRow>>(() => [
    {
      title: t('motivation.columns.transportation'), key: 'transportation', width: 220,
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.number}</Typography.Text>
          <div><Typography.Text type="secondary">{row.clientName}</Typography.Text></div>
        </div>
      ),
    },
    { title: t('motivation.columns.route'), dataIndex: 'route' },
    {
      title: t('motivation.columns.unloadingDate'), dataIndex: 'unloadingDate', width: 150,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('motivation.columns.margin'), key: 'margin', width: 200, align: 'right',
      render: (_, row) => (
        <div>
          <Typography.Text strong>{formatMoney(row.marginKzt)}</Typography.Text>
          {row.isForecast && <div><Typography.Text type="warning" className="motivation-forecast">{t('motivation.forecastByRate')}</Typography.Text></div>}
        </div>
      ),
    },
    {
      title: t('motivation.columns.paymentStatus'), dataIndex: 'paymentStatus', width: 150,
      render: (value: MotivationRow['paymentStatus']) => (
        <Tag color={MOTIVATION_PAYMENT_STATUS_COLORS[value]}>{t(`motivation.paymentStatuses.${value}`)}</Tag>
      ),
    },
    {
      title: t('motivation.columns.bonus', { rate: report?.ratePercent ?? 0 }), key: 'bonus', width: 180, align: 'right',
      render: (_, row) => (
        <Typography.Text strong className="motivation-bonus">
          {formatMoney(report ? Math.round(row.marginKzt * report.ratePercent) / 100 : 0)}
        </Typography.Text>
      ),
    },
  ], [formatDate, formatMoney, report, t]);

  return (
    <section className="reports-page motivation-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('motivation.myReport.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('motivation.myReport.subtitle')}</Typography.Text>
        </div>
        <DatePicker picker="month" value={month} onChange={(value) => value && setMonth(value)} allowClear={false} />
      </div>

      <div className="motivation-hint-banner">{t('motivation.hintBanner')}</div>

      <div className="reports-summary-row motivation-kpis">
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.kpis.count')}</Typography.Text>
          <Typography.Title level={3}>{report?.rows.length ?? 0}</Typography.Title>
        </Card>
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.kpis.totalMargin')}</Typography.Text>
          <Typography.Title level={3}>{formatMoney(report?.totalMarginKzt ?? 0)}</Typography.Title>
        </Card>
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.kpis.totalBonus', { rate: report?.ratePercent ?? 0 })}</Typography.Text>
          <Typography.Title level={3} className="motivation-bonus">{formatMoney(report?.totalBonusKzt ?? 0)}</Typography.Title>
        </Card>
        <Card className="transport-card">
          <Typography.Text type="secondary">{t('motivation.kpis.paid')}</Typography.Text>
          <Typography.Title level={3}>{t('motivation.kpis.paidValue', { paid: paidCount, total: report?.rows.length ?? 0 })}</Typography.Title>
        </Card>
      </div>

      <Card className="transport-card">
        <Table<MotivationRow>
          rowKey="transportationId"
          loading={loading}
          columns={columns}
          dataSource={report?.rows ?? []}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: t('motivation.empty') }}
          onRow={(row) => ({ onClick: () => navigate(`/transportations/${row.transportationId}`) })}
          summary={() => report && report.rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Typography.Text strong>{t('motivation.total')}</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Typography.Text strong>{formatMoney(report.totalMarginKzt)}</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right">
                  <Typography.Text strong className="motivation-bonus">{formatMoney(report.totalBonusKzt)}</Typography.Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </Card>
      <Typography.Text type="secondary" className="motivation-footnote">{t('motivation.footnote')}</Typography.Text>
    </section>
  );
}
