import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  PAYMENT_REQUEST_STATUS_COLORS,
  PaymentRequest,
} from '../payment-requests/shared';
import { MoneyInput } from './MoneyInput';

interface Leg {
  id: string;
  orderIndex: number;
  fromPoint: string;
  toPoint: string;
}

interface Context {
  contractors: Array<{ id: string; name: string; types: string[] }>;
  currencies: Array<{
    code: string;
    name: string;
    isBase: boolean;
  }>;
  suggested: {
    legId: string | null;
    payeeContractorId: string | null;
    amount: string | null;
    currencyCode: string | null;
    dueDate: string;
    purpose: string;
  };
}

interface FormValues {
  payeeContractorId: string;
  amount: number;
  currencyCode: string;
  dueDate: string;
  purpose: string;
}

interface PayValues {
  actualExchangeRate?: number;
}

interface Props {
  transportationId: string;
  leg: Leg;
}

export function TransportationPaymentRequestCard({
  transportationId,
  leg,
}: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [payForm] = Form.useForm<PayValues>();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [context, setContext] = useState<Context>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PaymentRequest>();
  const canApprove = Boolean(user?.roles.some((role) =>
    ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role),
  ));

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
      const rows = await apiRequest<PaymentRequest[]>(
        `/payment-requests?transportationId=${transportationId}`,
      );
      setRequests(rows.filter((request) => request.legId === leg.id));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [leg.id, showError, transportationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setSaving(true);
    try {
      const result = await apiRequest<Context>(
        `/payment-requests/create-context?transportationId=${transportationId}&legId=${leg.id}`,
      );
      setContext(result);
      form.setFieldsValue({
        payeeContractorId:
          result.suggested.payeeContractorId ?? undefined,
        amount: result.suggested.amount === null
          ? undefined
          : Number(result.suggested.amount),
        currencyCode: result.suggested.currencyCode ?? undefined,
        dueDate: result.suggested.dueDate,
        purpose: result.suggested.purpose,
      });
      setOpen(true);
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const create = async (values: FormValues) => {
    setSaving(true);
    try {
      await apiRequest('/payment-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          transportationId,
          legId: leg.id,
        }),
      });
      void message.success(t('paymentRequests.messages.created'));
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const transition = async (
    request: PaymentRequest,
    action: 'approve' | 'pay',
    body?: PayValues,
  ) => {
    setSaving(true);
    try {
      await apiRequest(`/payment-requests/${request.id}/${action}`, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      });
      void message.success(t(
        action === 'approve'
          ? 'paymentRequests.messages.approved'
          : 'paymentRequests.messages.paid',
      ));
      setPayTarget(undefined);
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openPay = (request: PaymentRequest) => {
    if (request.currencyCode === 'KZT') {
      void transition(request, 'pay');
      return;
    }
    payForm.resetFields();
    setPayTarget(request);
  };

  const formatMoney = (request: PaymentRequest) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: request.currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(request.amount));

  return (
    <div className="leg-payment-requests">
      <div className="leg-payment-requests-heading">
        <Typography.Text strong>
          {t('paymentRequests.transportationBlock.title')}
        </Typography.Text>
        {!loading && requests.length === 0 && (
          <Button size="small" loading={saving} onClick={() => void openCreate()}>
            {t('paymentRequests.actions.create')}
          </Button>
        )}
      </div>
      {loading ? (
        <Spin size="small" />
      ) : (
        <Space direction="vertical" className="full-width">
          {requests.map((request) => (
            <Card size="small" key={request.id}>
              <Space wrap>
                <Typography.Text strong>
                  {formatMoney(request)}
                </Typography.Text>
                <Tag color={PAYMENT_REQUEST_STATUS_COLORS[request.status]}>
                  {t(`paymentRequests.statuses.${request.status}`)}
                </Tag>
                <Typography.Text type="secondary">
                  {request.payeeContractor.name}
                </Typography.Text>
                {canApprove && request.status === 'REQUESTED' && (
                  <Button
                    size="small"
                    loading={saving}
                    onClick={() => void transition(request, 'approve')}
                  >
                    {t('paymentRequests.actions.approve')}
                  </Button>
                )}
                {canApprove && request.status === 'APPROVED' && (
                  <Button
                    size="small"
                    type="primary"
                    loading={saving}
                    onClick={() => openPay(request)}
                  >
                    {t('paymentRequests.actions.markPaid')}
                  </Button>
                )}
              </Space>
            </Card>
          ))}
        </Space>
      )}

      <Modal
        open={open}
        title={t('paymentRequests.create.title')}
        okText={t('paymentRequests.actions.create')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => void create(values)}
        >
          <Form.Item
            name="payeeContractorId"
            label={t('paymentRequests.fields.payee')}
            rules={[{
              required: true,
              message: t('paymentRequests.validation.payee'),
            }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={context?.contractors.map((contractor) => ({
                value: contractor.id,
                label: contractor.name,
              }))}
            />
          </Form.Item>
          <Space.Compact block>
            <Form.Item
              name="amount"
              label={t('paymentRequests.fields.amount')}
              className="payment-request-amount"
              rules={[{
                required: true,
                message: t('paymentRequests.validation.amount'),
              }]}
            >
              <MoneyInput min={0.01} className="full-width" />
            </Form.Item>
            <Form.Item
              name="currencyCode"
              label={t('paymentRequests.fields.currency')}
              className="payment-request-currency"
              rules={[{
                required: true,
                message: t('paymentRequests.validation.currency'),
              }]}
            >
              <Select
                options={context?.currencies.map((currency) => ({
                  value: currency.code,
                  label: currency.code,
                }))}
              />
            </Form.Item>
          </Space.Compact>
          <Form.Item
            name="dueDate"
            label={t('paymentRequests.fields.dueDate')}
            rules={[{
              required: true,
              message: t('paymentRequests.validation.dueDate'),
            }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item
            name="purpose"
            label={t('paymentRequests.fields.purpose')}
            rules={[{
              required: true,
              message: t('paymentRequests.validation.purpose'),
            }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(payTarget)}
        title={t('paymentRequests.payModal.title')}
        okText={t('paymentRequests.actions.markPaid')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onCancel={() => setPayTarget(undefined)}
        onOk={() => payForm.submit()}
        destroyOnHidden
      >
        <Form<PayValues>
          form={payForm}
          layout="vertical"
          onFinish={(values) => payTarget && void transition(payTarget, 'pay', values)}
        >
          <Form.Item
            name="actualExchangeRate"
            label={t('paymentRequests.fields.actualExchangeRate')}
            extra={t('paymentRequests.payModal.hint')}
          >
            <InputNumber min={0.000001} precision={6} className="full-width" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
