import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Checkbox,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import type { Invoice } from '../invoices/shared';
import { MoneyInput } from './MoneyInput';

interface Currency {
  code: string;
  name: string;
  isBase: boolean;
}

interface CreateContext {
  transportation: {
    id: string;
    number: string;
    originPoint: string;
    destinationPoint: string;
    clientRate: string | null;
    clientRateCurrency: string | null;
    isDomestic: boolean | null;
  };
  deal: {
    id: string;
    number: string;
    client: { id: string; name: string };
    legalEntity: { id: string; name: string; numberingPrefix: string };
  };
  currencies: Currency[];
  suggested: {
    currencyCode: string | null;
    issueDate: string;
    dueDate: string;
    lines: Array<{
      serviceName: string;
      quantity: number;
      unitPrice: string | null;
      hasVat: boolean;
      vatRatePercent: string | null;
    }>;
  };
}

interface LineValues {
  serviceName: string;
  quantity: number;
  unitPrice: number;
  hasVat: boolean;
  vatRatePercent?: number;
}

interface CreateValues {
  currencyCode: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  lines: LineValues[];
}

interface Props {
  transportationId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
}

export function CreateInvoiceModal({
  transportationId,
  open,
  onClose,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateValues>();
  const [context, setContext] = useState<CreateContext>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadContext = useCallback(async (issueDate?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ transportationId });
      if (issueDate) params.set('issueDate', issueDate);
      const result = await apiRequest<CreateContext>(
        `/invoices/create-context?${params.toString()}`,
      );
      setContext(result);
      form.setFieldsValue({
        currencyCode: result.suggested.currencyCode ?? undefined,
        issueDate: result.suggested.issueDate,
        dueDate: result.suggested.dueDate,
        lines: result.suggested.lines.map((line) => ({
          serviceName: line.serviceName,
          quantity: line.quantity,
          unitPrice: line.unitPrice === null ? 0 : Number(line.unitPrice),
          hasVat: line.hasVat,
          vatRatePercent: line.vatRatePercent === null
            ? undefined
            : Number(line.vatRatePercent),
        })),
      });
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [form, showError, transportationId]);

  useEffect(() => {
    if (open) void loadContext();
    else {
      setContext(undefined);
      form.resetFields();
    }
  }, [form, loadContext, open]);

  const submit = async (values: CreateValues) => {
    setSaving(true);
    try {
      const invoice = await apiRequest<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify({ ...values, transportationId }),
      });
      void message.success(
        t('invoices.messages.created', { number: invoice.number }),
      );
      onCreated(invoice);
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      width={940}
      title={t('invoices.create.title')}
      okText={t('invoices.actions.issue')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {loading && !context ? (
        <Spin />
      ) : (
        <Form<CreateValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void submit(values)}
        >
          {context && (
            <Descriptions
              size="small"
              column={3}
              items={[
                {
                  key: 'transportation',
                  label: t('invoices.fields.transportation'),
                  children: context.transportation.number,
                },
                {
                  key: 'deal',
                  label: t('invoices.fields.deal'),
                  children: context.deal.number,
                },
                {
                  key: 'client',
                  label: t('invoices.fields.client'),
                  children: context.deal.client.name,
                },
                {
                  key: 'entity',
                  label: t('invoices.fields.legalEntity'),
                  children: context.deal.legalEntity.name,
                },
              ]}
            />
          )}
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="currencyCode"
                label={t('invoices.fields.currency')}
                rules={[{
                  required: true,
                  message: t('invoices.validation.currency'),
                }]}
              >
                <Select
                  options={context?.currencies.map((currency) => ({
                    value: currency.code,
                    label: `${currency.code} · ${currency.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="issueDate"
                label={t('invoices.fields.issueDate')}
                rules={[{
                  required: true,
                  message: t('invoices.validation.issueDate'),
                }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="dueDate"
                label={t('invoices.fields.dueDate')}
                rules={[{
                  required: true,
                  message: t('invoices.validation.dueDate'),
                }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size="middle" className="invoice-lines-form">
                {fields.map((field, index) => (
                  <div className="invoice-line-form" key={field.key}>
                    <Row gutter={12} align="middle">
                      <Col xs={24} md={7}>
                        <Form.Item
                          name={[field.name, 'serviceName']}
                          label={t('invoices.lines.service')}
                          rules={[{
                            required: true,
                            whitespace: true,
                            message: t('invoices.validation.service'),
                          }]}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={3}>
                        <Form.Item
                          name={[field.name, 'quantity']}
                          label={t('invoices.lines.quantity')}
                          rules={[{
                            required: true,
                            message: t('invoices.validation.quantity'),
                          }]}
                        >
                          <InputNumber min={0.001} precision={3} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={4}>
                        <Form.Item
                          name={[field.name, 'unitPrice']}
                          label={t('invoices.lines.unitPrice')}
                          rules={[{
                            required: true,
                            message: t('invoices.validation.unitPrice'),
                          }]}
                        >
                          <MoneyInput min={0} precision={2} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={3}>
                        <Form.Item
                          name={[field.name, 'hasVat']}
                          valuePropName="checked"
                          label={t('invoices.lines.hasVat')}
                        >
                          <Checkbox>{t('common.yes')}</Checkbox>
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={4}>
                        <Form.Item
                          noStyle
                          shouldUpdate={(previous, current) =>
                            previous.lines?.[index]?.hasVat !==
                            current.lines?.[index]?.hasVat}
                        >
                          {({ getFieldValue }) => (
                            <Form.Item
                              name={[field.name, 'vatRatePercent']}
                              label={t('invoices.lines.vatRate')}
                              rules={getFieldValue(['lines', index, 'hasVat'])
                                ? [{
                                  required: true,
                                  message: t('invoices.validation.vatRate'),
                                }]
                                : []}
                            >
                              <InputNumber
                                min={0}
                                max={100}
                                precision={2}
                                disabled={!getFieldValue([
                                  'lines',
                                  index,
                                  'hasVat',
                                ])}
                              />
                            </Form.Item>
                          )}
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={3} className="invoice-line-remove-col">
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          aria-label={t('invoices.actions.removeLine')}
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({
                    serviceName: '',
                    quantity: 1,
                    unitPrice: 0,
                    hasVat: context?.suggested.lines[1]?.hasVat ?? false,
                    vatRatePercent:
                      context?.suggested.lines[1]?.vatRatePercent === null ||
                      context?.suggested.lines[1]?.vatRatePercent === undefined
                      ? undefined
                      : Number(
                        context?.suggested.lines[1]?.vatRatePercent,
                      ),
                  })}
                >
                  {t('invoices.actions.addLine')}
                </Button>
              </Space>
            )}
          </Form.List>

          <Form.Item name="notes" label={t('invoices.fields.notes')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
