import { App, Button, Card, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { CreatePaymentRequestModal } from '../components/CreatePaymentRequestModal';
import {
  PAYMENT_REQUEST_STATUSES,
  PAYMENT_REQUEST_STATUS_COLORS,
  PaymentRequest,
  PaymentRequestStatus,
} from '../payment-requests/shared';

export function PaymentRequestsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [status, setStatus] = useState<PaymentRequestStatus>();
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const query = params.toString();
      setRequests(await apiRequest<PaymentRequest[]>(
        `/payment-requests${query ? `?${query}` : ''}`,
      ));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = useCallback((value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
      .format(new Date(value)), [i18n.language]);

  const formatMoney = useCallback((value: string, currency: string) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value)), [i18n.language]);

  const columns = useMemo<ColumnsType<PaymentRequest>>(() => [
    {
      title: t('paymentRequests.columns.transportation'),
      dataIndex: ['transportation', 'number'],
      width: 180,
      render: (value: string) => (
        <Typography.Text strong>{value}</Typography.Text>
      ),
    },
    {
      title: t('paymentRequests.columns.leg'),
      dataIndex: ['leg', 'orderIndex'],
      width: 120,
      render: (value: number | undefined) =>
        value === undefined
          ? t('paymentRequests.manual')
          : t('paymentRequests.legNumber', { number: value }),
    },
    {
      title: t('paymentRequests.columns.payee'),
      dataIndex: ['payeeContractor', 'name'],
      ellipsis: true,
    },
    {
      title: t('paymentRequests.columns.amount'),
      key: 'amount',
      width: 180,
      align: 'right',
      sorter: (left, right) => Number(left.amount) - Number(right.amount),
      render: (_, request) =>
        formatMoney(request.amount, request.currencyCode),
    },
    {
      title: t('paymentRequests.columns.dueDate'),
      dataIndex: 'dueDate',
      width: 145,
      sorter: (left, right) =>
        new Date(left.dueDate).getTime() -
        new Date(right.dueDate).getTime(),
      render: formatDate,
    },
    {
      title: t('paymentRequests.columns.purpose'),
      dataIndex: 'purpose',
      ellipsis: true,
    },
    {
      title: t('paymentRequests.columns.status'),
      dataIndex: 'status',
      width: 150,
      render: (value: PaymentRequestStatus) => (
        <Tag color={PAYMENT_REQUEST_STATUS_COLORS[value]}>
          {t(`paymentRequests.statuses.${value}`)}
        </Tag>
      ),
    },
  ], [formatDate, formatMoney, t]);

  return (
    <section className="list-page payment-request-list-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>
            {t('paymentRequests.title')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('paymentRequests.subtitle')}
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          {t('paymentRequests.actions.createManual')}
        </Button>
      </div>

      <Card className="transport-card">
        <div className="table-toolbar">
          <Space>
            <Select
              allowClear
              className="invoice-status-filter"
              placeholder={t('paymentRequests.filters.status')}
              value={status}
              onChange={setStatus}
              options={PAYMENT_REQUEST_STATUSES.map((value) => ({
                value,
                label: t(`paymentRequests.statuses.${value}`),
              }))}
            />
          </Space>
        </div>
        <Table<PaymentRequest>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={requests}
          scroll={{ x: 1050 }}
          locale={{ emptyText: t('paymentRequests.empty') }}
          onRow={(request) => ({
            onClick: () =>
              navigate(`/transportations/${request.transportation.id}`),
          })}
        />
      </Card>
      <CreatePaymentRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
    </section>
  );
}
