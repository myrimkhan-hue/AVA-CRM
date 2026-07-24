import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDownload, ApiError, apiRequest, saveBlob } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CreateInvoiceModal } from '../components/CreateInvoiceModal';
import { MoneyInput } from '../components/MoneyInput';
import {
  INVOICE_STATUS_COLORS,
  Invoice,
  InvoiceLine,
  InvoicePayment,
} from '../invoices/shared';

interface HeaderValues {
  issueDate: string;
  dueDate: string;
  notes?: string;
}

interface LineValues {
  serviceName: string;
  quantity: number;
  unitPrice: number;
  hasVat: boolean;
  vatRatePercent?: number;
}

interface PaymentValues {
  paymentDate: string;
  amount: number;
  manualExchangeRate?: number;
  note?: string;
}

export function TransportationInvoiceCard({
  transportationId,
}: {
  transportationId: string;
}) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { message, modal } = App.useApp();
  const [headerForm] = Form.useForm<HeaderValues>();
  const [lineForm] = Form.useForm<LineValues>();
  const [paymentForm] = Form.useForm<PaymentValues>();
  const [invoice, setInvoice] = useState<Invoice>();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<InvoiceLine>();
  const selectedHasVat = Form.useWatch('hasVat', lineForm);
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const mayDownloadPdf = Boolean(user?.roles.some((role) =>
    ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER'].includes(role)));

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const invoices = await apiRequest<Invoice[]>(
        `/invoices?transportationId=${encodeURIComponent(transportationId)}`,
      );
      // ADMIN/DIRECTOR/FINANCIER могут видеть и внутригрупповой счёт-
      // перевыставление по этой же перевозке (раздел 4.4.6 ТЗ) — здесь
      // всегда нужен обычный клиентский счёт, а не он.
      setInvoice(invoices.find((invoice) => !invoice.isIntragroup) ?? invoices[0]);
    } catch (error) {
      setLoadFailed(true);
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError, transportationId]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
      .format(new Date(value))
  ), [i18n.language]);

  const formatMoney = useCallback((value: string) => (
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: invoice?.currency.code ?? 'KZT',
      maximumFractionDigits: 2,
    }).format(Number(value))
  ), [i18n.language, invoice?.currency.code]);

  const openHeader = () => {
    if (!invoice) return;
    headerForm.setFieldsValue({
      issueDate: invoice.issueDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
      notes: invoice.notes ?? undefined,
    });
    setHeaderOpen(true);
  };

  const saveHeader = async (values: HeaderValues) => {
    if (!invoice) return;
    setSaving(true);
    try {
      setInvoice(await apiRequest<Invoice>(`/invoices/${invoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      }));
      setHeaderOpen(false);
      void message.success(t('invoices.messages.updated'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openLine = async (line?: InvoiceLine) => {
    setEditingLine(line);
    if (line) {
      lineForm.setFieldsValue({
        serviceName: line.serviceName,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        hasVat: line.hasVat,
        vatRatePercent: line.vatRatePercent === null
          ? undefined
          : Number(line.vatRatePercent),
      });
    } else {
      let suggestedLine: {
        serviceName: string;
        quantity: number;
        unitPrice: string | null;
        hasVat: boolean;
        vatRatePercent: string | null;
      } | undefined;
      try {
        const params = new URLSearchParams({
          transportationId,
          issueDate: invoice?.issueDate.slice(0, 10) ?? '',
        });
        const context = await apiRequest<{
          suggested: {
            lines: Array<{
              serviceName: string;
              quantity: number;
              unitPrice: string | null;
              hasVat: boolean;
              vatRatePercent: string | null;
            }>;
          };
        }>(`/invoices/create-context?${params.toString()}`);
        suggestedLine = context.suggested.lines.find((suggestion) =>
          !invoice?.lines.some(
            (existing) => existing.serviceName === suggestion.serviceName,
          ),
        );
      } catch (error) {
        showError(error);
      }
      lineForm.setFieldsValue({
        serviceName: suggestedLine?.serviceName ?? '',
        quantity: suggestedLine?.quantity ?? 1,
        unitPrice: suggestedLine?.unitPrice === null ||
          suggestedLine?.unitPrice === undefined
          ? 0
          : Number(suggestedLine.unitPrice),
        hasVat: suggestedLine?.hasVat ?? false,
        vatRatePercent: suggestedLine?.vatRatePercent === null ||
          suggestedLine?.vatRatePercent === undefined
          ? undefined
          : Number(suggestedLine.vatRatePercent),
      });
    }
    setLineOpen(true);
  };

  const saveLine = async (values: LineValues) => {
    if (!invoice) return;
    setSaving(true);
    try {
      const path = editingLine
        ? `/invoices/${invoice.id}/lines/${editingLine.id}`
        : `/invoices/${invoice.id}/lines`;
      setInvoice(await apiRequest<Invoice>(path, {
        method: editingLine ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      }));
      setLineOpen(false);
      void message.success(
        t(editingLine
          ? 'invoices.messages.lineUpdated'
          : 'invoices.messages.lineAdded'),
      );
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const removeLine = (line: InvoiceLine) => {
    if (!invoice) return;
    modal.confirm({
      title: t('invoices.confirm.removeLineTitle'),
      content: t('invoices.confirm.removeLineText', {
        service: line.serviceName,
      }),
      okText: t('invoices.actions.removeLine'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        try {
          setInvoice(await apiRequest<Invoice>(
            `/invoices/${invoice.id}/lines/${line.id}`,
            { method: 'DELETE' },
          ));
          void message.success(t('invoices.messages.lineRemoved'));
        } catch (error) {
          showError(error);
          throw error;
        }
      },
    });
  };

  const openPayment = () => {
    const today = new Date().toISOString().slice(0, 10);
    paymentForm.setFieldsValue({
      paymentDate: today,
      amount: invoice ? Number(invoice.totals.balanceAmount) : undefined,
      manualExchangeRate: undefined,
      note: undefined,
    });
    setPaymentOpen(true);
  };

  const addPayment = async (values: PaymentValues) => {
    if (!invoice) return;
    setSaving(true);
    try {
      setInvoice(await apiRequest<Invoice>(
        `/invoices/${invoice.id}/payments`,
        { method: 'POST', body: JSON.stringify(values) },
      ));
      setPaymentOpen(false);
      void message.success(t('invoices.messages.paymentAdded'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (!invoice) return;
    try {
      const { blob, filename } = await apiDownload(
        `/documents/invoices/${invoice.id}`,
        { method: 'POST' },
      );
      saveBlob(blob, filename);
      void message.success(t('documents.invoice.generated'));
    } catch (error) {
      showError(error);
    }
  };

  const removeInvoice = () => {
    if (!invoice) return;
    modal.confirm({
      title: t('invoices.confirm.deleteTitle'),
      content: t('invoices.confirm.deleteText', { number: invoice.number }),
      okText: t('invoices.actions.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await apiRequest(`/invoices/${invoice.id}`, { method: 'DELETE' });
          void message.success(t('invoices.messages.deleted'));
          setInvoice(undefined);
        } catch (error) {
          showError(error);
          throw error;
        }
      },
    });
  };

  const lineColumns = useMemo<ColumnsType<InvoiceLine>>(() => [
    {
      title: t('invoices.lines.service'),
      dataIndex: 'serviceName',
    },
    {
      title: t('invoices.lines.quantity'),
      dataIndex: 'quantity',
      width: 105,
      align: 'right',
    },
    {
      title: t('invoices.lines.unitPrice'),
      dataIndex: 'unitPrice',
      width: 145,
      align: 'right',
      render: (value: string) => formatMoney(value),
    },
    {
      title: t('invoices.lines.vat'),
      key: 'vat',
      width: 130,
      render: (_, line) => line.hasVat
        ? t('invoices.lines.vatValue', { rate: line.vatRatePercent })
        : t('invoices.lines.noVat'),
    },
    {
      title: t('invoices.lines.netAmount'),
      dataIndex: 'netAmount',
      width: 145,
      align: 'right',
      render: (value: string) => formatMoney(value),
    },
    {
      title: t('invoices.lines.vatAmount'),
      dataIndex: 'vatAmount',
      width: 135,
      align: 'right',
      render: (value: string) => formatMoney(value),
    },
    {
      title: t('invoices.lines.totalAmount'),
      dataIndex: 'totalAmount',
      width: 150,
      align: 'right',
      render: (value: string) => formatMoney(value),
    },
    {
      title: t('invoices.columns.actions'),
      key: 'actions',
      width: 110,
      render: (_, line) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={t('invoices.actions.editLine')}
            onClick={() => void openLine(line)}
          />
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            aria-label={t('invoices.actions.removeLine')}
            disabled={(invoice?.lines.length ?? 0) <= 1}
            onClick={() => removeLine(line)}
          />
        </Space>
      ),
    },
  ], [formatMoney, invoice?.lines.length, t]);

  const paymentColumns = useMemo<ColumnsType<InvoicePayment>>(() => [
    {
      title: t('invoices.payments.date'),
      dataIndex: 'paymentDate',
      width: 150,
      render: formatDate,
    },
    {
      title: t('invoices.payments.amount'),
      dataIndex: 'amount',
      width: 180,
      align: 'right',
      render: formatMoney,
    },
    {
      title: t('invoices.payments.exchangeRate'),
      dataIndex: 'manualExchangeRate',
      width: 160,
      render: (value: string | null) => value ?? t('common.dash'),
    },
    {
      title: t('invoices.payments.note'),
      dataIndex: 'note',
      render: (value: string | null) => value || t('common.dash'),
    },
    {
      title: t('invoices.payments.createdBy'),
      dataIndex: ['createdBy', 'fullName'],
      width: 190,
    },
  ], [formatDate, formatMoney, t]);

  if (loading) return <Card className="transport-card"><Spin /></Card>;
  if (loadFailed) {
    return (
      <Card className="transport-card" title={t('invoices.sections.invoice')}>
        <Result
          status="warning"
          title={t('invoices.detail.loadFailed')}
          extra={(
            <Button onClick={() => void loadInvoice()}>
              {t('invoices.actions.retry')}
            </Button>
          )}
        />
      </Card>
    );
  }
  if (!invoice) {
    return (
      <>
        <Card
          className="transport-card"
          title={t('invoices.sections.invoice')}
          extra={(
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              {t('invoices.actions.issue')}
            </Button>
          )}
        >
          <Typography.Text type="secondary">
            {t('invoices.emptyForTransportation')}
          </Typography.Text>
        </Card>
        <CreateInvoiceModal
          transportationId={transportationId}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setInvoice(created);
            setCreateOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <section className="transportation-invoice-section">
      <div className="deal-detail-heading">
        <Space wrap>
          <Typography.Title level={4}>
            {t('invoices.sections.invoiceWithNumber', {
              number: invoice.number,
            })}
          </Typography.Title>
          <Tag color={INVOICE_STATUS_COLORS[invoice.status]}>
            {t(`invoices.statuses.${invoice.status}`)}
          </Tag>
          {invoice.isOverdue && (
            <Tag color="red">{t('invoices.overdue')}</Tag>
          )}
        </Space>
        <Space wrap>
          {mayDownloadPdf && (
            <Button icon={<DownloadOutlined />} onClick={() => void downloadPdf()}>
              {t('documents.invoice.action')}
            </Button>
          )}
          {!invoice.deletedAt && (
            <Button icon={<EditOutlined />} onClick={openHeader}>
              {t('invoices.actions.edit')}
            </Button>
          )}
          {isAdmin && !invoice.deletedAt && (
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={removeInvoice}
            >
              {t('invoices.actions.delete')}
            </Button>
          )}
        </Space>
      </div>

      <Card className="transport-card">
        <Descriptions
          column={{ xs: 1, md: 2, lg: 4 }}
          items={[
            {
              key: 'transportation',
              label: t('invoices.fields.transportation'),
              children: invoice.transportation.number,
            },
            {
              key: 'deal',
              label: t('invoices.fields.deal'),
              children: invoice.transportation.deal.number,
            },
            {
              key: 'client',
              label: t('invoices.fields.client'),
              children: invoice.client.name,
            },
            {
              key: 'entity',
              label: t('invoices.fields.legalEntity'),
              children: invoice.legalEntity.name,
            },
            {
              key: 'currency',
              label: t('invoices.fields.currency'),
              children: invoice.currency.code,
            },
            {
              key: 'issue',
              label: t('invoices.fields.issueDate'),
              children: formatDate(invoice.issueDate),
            },
            {
              key: 'due',
              label: t('invoices.fields.dueDate'),
              children: formatDate(invoice.dueDate),
            },
            {
              key: 'responsible',
              label: t('invoices.fields.responsible'),
              children: invoice.transportation.deal.responsible.fullName,
            },
            {
              key: 'notes',
              label: t('invoices.fields.notes'),
              children: invoice.notes || t('common.dash'),
            },
          ]}
        />
      </Card>

      <Card
        className="transport-card"
        title={t('invoices.sections.lines')}
        extra={!invoice.deletedAt ? (
          <Button icon={<PlusOutlined />} onClick={() => void openLine()}>
            {t('invoices.actions.addLine')}
          </Button>
        ) : undefined}
      >
        <Table<InvoiceLine>
          rowKey="id"
          dataSource={invoice.lines}
          columns={lineColumns}
          pagination={false}
          scroll={{ x: 1120 }}
        />
        <Descriptions
          className="invoice-totals"
          column={1}
          size="small"
          items={[
            {
              key: 'net',
              label: t('invoices.totals.net'),
              children: formatMoney(invoice.totals.netAmount),
            },
            {
              key: 'vat',
              label: t('invoices.totals.vat'),
              children: formatMoney(invoice.totals.vatAmount),
            },
            {
              key: 'total',
              label: t('invoices.totals.total'),
              children: (
                <Typography.Text strong>
                  {formatMoney(invoice.totals.totalAmount)}
                </Typography.Text>
              ),
            },
          ]}
        />
      </Card>

      <Card
        className="transport-card"
        title={t('invoices.sections.payments')}
        extra={!invoice.deletedAt ? (
          <Button icon={<PlusOutlined />} onClick={openPayment}>
            {t('invoices.actions.addPayment')}
          </Button>
        ) : undefined}
      >
        <Table<InvoicePayment>
          rowKey="id"
          dataSource={invoice.payments}
          columns={paymentColumns}
          pagination={false}
          locale={{ emptyText: t('invoices.payments.empty') }}
          scroll={{ x: 850 }}
        />
        <Descriptions
          className="invoice-totals"
          column={1}
          size="small"
          items={[
            {
              key: 'paid',
              label: t('invoices.totals.paid'),
              children: formatMoney(invoice.totals.paidAmount),
            },
            {
              key: 'balance',
              label: t('invoices.totals.balance'),
              children: (
                <Typography.Text strong>
                  {formatMoney(invoice.totals.balanceAmount)}
                </Typography.Text>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={headerOpen}
        title={t('invoices.edit.title')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => headerForm.submit()}
        onCancel={() => setHeaderOpen(false)}
        destroyOnHidden
      >
        <Form<HeaderValues>
          form={headerForm}
          layout="vertical"
          onFinish={(values) => void saveHeader(values)}
        >
          <Row gutter={12}>
            <Col span={12}>
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
            <Col span={12}>
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
          <Form.Item name="notes" label={t('invoices.fields.notes')}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={lineOpen}
        title={t(editingLine
          ? 'invoices.lines.editTitle'
          : 'invoices.lines.addTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => lineForm.submit()}
        onCancel={() => setLineOpen(false)}
        destroyOnHidden
      >
        <Form<LineValues>
          form={lineForm}
          layout="vertical"
          onFinish={(values) => void saveLine(values)}
        >
          <Form.Item
            name="serviceName"
            label={t('invoices.lines.service')}
            rules={[{
              required: true,
              whitespace: true,
              message: t('invoices.validation.service'),
            }]}
          >
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label={t('invoices.lines.quantity')}
                rules={[{
                  required: true,
                  message: t('invoices.validation.quantity'),
                }]}
              >
                <InputNumber min={0.001} precision={3} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="unitPrice"
                label={t('invoices.lines.unitPrice')}
                rules={[{
                  required: true,
                  message: t('invoices.validation.unitPrice'),
                }]}
              >
                <MoneyInput min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="hasVat"
            valuePropName="checked"
            label={t('invoices.lines.hasVat')}
          >
            <Checkbox>{t('common.yes')}</Checkbox>
          </Form.Item>
          <Form.Item
            name="vatRatePercent"
            label={t('invoices.lines.vatRate')}
            rules={selectedHasVat ? [{
              required: true,
              message: t('invoices.validation.vatRate'),
            }] : []}
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              disabled={!selectedHasVat}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={paymentOpen}
        title={t('invoices.payments.addTitle')}
        okText={t('invoices.actions.addPayment')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => paymentForm.submit()}
        onCancel={() => setPaymentOpen(false)}
        destroyOnHidden
      >
        <Form<PaymentValues>
          form={paymentForm}
          layout="vertical"
          onFinish={(values) => void addPayment(values)}
        >
          <Form.Item
            name="paymentDate"
            label={t('invoices.payments.date')}
            rules={[{
              required: true,
              message: t('invoices.validation.paymentDate'),
            }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item
            name="amount"
            label={t('invoices.payments.amount')}
            rules={[{
              required: true,
              message: t('invoices.validation.paymentAmount'),
            }]}
          >
            <MoneyInput min={0.01} precision={2} />
          </Form.Item>
          <Form.Item
            name="manualExchangeRate"
            label={t('invoices.payments.exchangeRate')}
            extra={t('invoices.payments.exchangeRateHint')}
          >
            <InputNumber min={0.000001} precision={6} />
          </Form.Item>
          <Form.Item name="note" label={t('invoices.payments.note')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
