import { Card, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../api/client';

interface MarginResult {
  incomeTotalKzt: number;
  expenseTotalKzt: number;
  marginKzt: number;
  marginPercent: number;
  paidByClientKzt: number;
  paidToSubcontractorsKzt: number;
  currencyDifferenceKzt: number;
  isForecast: boolean;
}

interface Props {
  endpoint: string;
}

export function MarginCard({ endpoint }: Props) {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState<MarginResult>();
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHidden(false);
    apiRequest<MarginResult>(endpoint)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setHidden(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (hidden) return null;

  const formatMoney = (value: number) => new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <Card
      className="transport-card margin-card"
      title={t('margin.title')}
      extra={result && (
        <Tag color={result.isForecast ? 'gold' : 'green'}>
          {t(result.isForecast ? 'margin.forecast' : 'margin.final')}
        </Tag>
      )}
    >
      {loading || !result ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Space direction="vertical" size="middle" className="full-width">
          <Statistic
            title={t('margin.margin')}
            value={result.marginKzt}
            precision={0}
            formatter={(value) => formatMoney(Number(value))}
            suffix={<span className="margin-percent">{`(${result.marginPercent.toFixed(2)}%)`}</span>}
          />
          <div className="data-grid two">
            <div>
              <Typography.Text type="secondary">{t('margin.income')}</Typography.Text>
              <div>{formatMoney(result.incomeTotalKzt)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('margin.expense')}</Typography.Text>
              <div>{formatMoney(result.expenseTotalKzt)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('margin.paidByClient')}</Typography.Text>
              <div>{formatMoney(result.paidByClientKzt)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('margin.paidToSubcontractors')}</Typography.Text>
              <div>{formatMoney(result.paidToSubcontractorsKzt)}</div>
            </div>
            <div className="span-all">
              <Typography.Text type="secondary">{t('margin.currencyDifference')}</Typography.Text>
              <div>{formatMoney(result.currencyDifferenceKzt)}</div>
            </div>
          </div>
          {result.isForecast && (
            <Typography.Text type="secondary" className="margin-hint">
              {t('margin.hint')}
            </Typography.Text>
          )}
        </Space>
      )}
    </Card>
  );
}
