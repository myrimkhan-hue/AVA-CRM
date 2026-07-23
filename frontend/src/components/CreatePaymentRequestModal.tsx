import { App, Button, Form, Input, Modal, Select, Space } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { MoneyInput } from './MoneyInput';

interface Transportation {
  id: string;
  number: string;
  originPoint: string;
  destinationPoint: string;
}

interface Context {
  legs: Array<{
    id: string;
    orderIndex: number;
    fromPoint: string;
    toPoint: string;
  }>;
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
  transportationId: string;
  legId?: string;
  payeeContractorId: string;
  amount: number;
  currencyCode: string;
  dueDate: string;
  purpose: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePaymentRequestModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [transportations, setTransportations] = useState<Transportation[]>([]);
  const [context, setContext] = useState<Context>();
  const [loading, setLoading] = useState(false);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  useEffect(() => {
    if (!open) {
      setContext(undefined);
      form.resetFields();
      return;
    }
    setLoading(true);
    apiRequest<Transportation[]>('/transportations')
      .then(setTransportations)
      .catch(showError)
      .finally(() => setLoading(false));
  }, [form, open, showError]);

  const loadContext = async (
    transportationId: string,
    legId?: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ transportationId });
      if (legId) params.set('legId', legId);
      const result = await apiRequest<Context>(
        `/payment-requests/create-context?${params.toString()}`,
      );
      setContext(result);
      form.setFieldsValue({
        legId,
        payeeContractorId:
          result.suggested.payeeContractorId ?? undefined,
        amount: result.suggested.amount === null
          ? undefined
          : Number(result.suggested.amount),
        currencyCode: result.suggested.currencyCode ?? undefined,
        dueDate: result.suggested.dueDate,
        purpose: result.suggested.purpose,
      });
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (values: FormValues) => {
    setLoading(true);
    try {
      await apiRequest('/payment-requests', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      void message.success(t('paymentRequests.messages.created'));
      onCreated();
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      width={680}
      title={t('paymentRequests.create.manualTitle')}
      okText={t('paymentRequests.actions.create')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="transportationId"
          label={t('paymentRequests.fields.transportation')}
          rules={[{
            required: true,
            message: t('paymentRequests.validation.transportation'),
          }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={transportations.map((transportation) => ({
              value: transportation.id,
              label: `${transportation.number} · ${transportation.originPoint} → ${transportation.destinationPoint}`,
            }))}
            onChange={(transportationId) => {
              form.setFieldValue('legId', undefined);
              void loadContext(transportationId);
            }}
          />
        </Form.Item>
        <Form.Item
          name="legId"
          label={t('paymentRequests.fields.leg')}
        >
          <Select
            allowClear
            disabled={!context}
            options={context?.legs.map((leg) => ({
              value: leg.id,
              label: t('paymentRequests.legOption', {
                number: leg.orderIndex,
                from: leg.fromPoint,
                to: leg.toPoint,
              }),
            }))}
            onChange={(legId) => {
              const transportationId =
                form.getFieldValue('transportationId');
              if (transportationId) {
                void loadContext(transportationId, legId);
              }
            }}
          />
        </Form.Item>
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
            disabled={!context}
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
              disabled={!context}
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
        <Button hidden htmlType="submit" />
      </Form>
    </Modal>
  );
}
