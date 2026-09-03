import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import type {
  OperatingExpenseContext,
  OperatingExpenseRecord,
} from '../api/types';
import { MoneyInput } from '../components/MoneyInput';

interface ExpenseFormValues {
  typeId: string;
  legalEntityId: string;
  amount: number;
  currencyCode: string;
  dueDate: string;
  purpose: string;
  isRecurringMonthly: boolean;
}

type PaidFilter = 'ALL' | 'PAID' | 'UNPAID';

function todayDateOnly(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function OperatingExpensesPage() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<ExpenseFormValues>();
  const [payForm] = Form.useForm<{ paidAt: string }>();
  const [rows, setRows] = useState<OperatingExpenseRecord[]>([]);
  const [context, setContext] = useState<OperatingExpenseContext>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OperatingExpenseRecord | null>(null);
  const [paying, setPaying] = useState<OperatingExpenseRecord | null>(null);
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [typeId, setTypeId] = useState<string>();
  const [legalEntityId, setLegalEntityId] = useState<string>();
  const [paid, setPaid] = useState<PaidFilter>('ALL');

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadContext = useCallback(async () => {
    try {
      setContext(await apiRequest<OperatingExpenseContext>('/operating-expenses/context'));
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dueDateFrom) params.set('dueDateFrom', dueDateFrom);
      if (dueDateTo) params.set('dueDateTo', dueDateTo);
      if (typeId) params.set('typeId', typeId);
      if (legalEntityId) params.set('legalEntityId', legalEntityId);
      if (paid !== 'ALL') params.set('paid', String(paid === 'PAID'));
      const query = params.toString();
      setRows(await apiRequest<OperatingExpenseRecord[]>(
        `/operating-expenses${query ? `?${query}` : ''}`,
      ));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [dueDateFrom, dueDateTo, legalEntityId, paid, showError, typeId]);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      typeId: undefined,
      legalEntityId: undefined,
      amount: undefined,
      currencyCode: context?.currencies.find((currency) => currency.isBase)?.code,
      dueDate: todayDateOnly(),
      purpose: '',
      isRecurringMonthly: false,
    });
    setEditorOpen(true);
  };

  const openEdit = (row: OperatingExpenseRecord) => {
    setEditing(row);
    form.setFieldsValue({
      typeId: row.typeId,
      legalEntityId: row.legalEntityId,
      amount: Number(row.amount),
      currencyCode: row.currencyCode,
      dueDate: row.dueDate,
      purpose: row.purpose,
      isRecurringMonthly: row.isRecurringMonthly,
    });
    setEditorOpen(true);
  };

  const save = async (values: ExpenseFormValues) => {
    setSaving(true);
    try {
      await apiRequest(
        editing ? `/operating-expenses/${editing.id}` : '/operating-expenses',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(values),
        },
      );
      void message.success(t(editing
        ? 'operatingExpenses.messages.updated'
        : 'operatingExpenses.messages.created'));
      setEditorOpen(false);
      await Promise.all([load(), loadContext()]);
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: OperatingExpenseRecord) => {
    setActionId(row.id);
    try {
      await apiRequest(`/operating-expenses/${row.id}`, { method: 'DELETE' });
      void message.success(t('operatingExpenses.messages.deleted'));
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setActionId(undefined);
    }
  };

  const openPay = (row: OperatingExpenseRecord) => {
    setPaying(row);
    payForm.setFieldsValue({ paidAt: todayDateOnly() });
  };

  const markPaid = async ({ paidAt }: { paidAt: string }) => {
    if (!paying) return;
    setActionId(paying.id);
    try {
      await apiRequest(`/operating-expenses/${paying.id}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ paidAt }),
      });
      void message.success(t('operatingExpenses.messages.paid'));
      setPaying(null);
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setActionId(undefined);
    }
  };

  const unpay = async (row: OperatingExpenseRecord) => {
    setActionId(row.id);
    try {
      await apiRequest(`/operating-expenses/${row.id}/unpay`, { method: 'PATCH' });
      void message.success(t('operatingExpenses.messages.unpaid'));
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setActionId(undefined);
    }
  };

  const formatDate = useCallback((value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
      .format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`)), [i18n.language]);

  const formatMoney = useCallback((value: string, currency: string) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value)), [i18n.language]);

  const columns: ColumnsType<OperatingExpenseRecord> = [
    {
      title: t('operatingExpenses.columns.dueDate'),
      dataIndex: 'dueDate',
      width: 155,
      sorter: (left, right) => left.dueDate.localeCompare(right.dueDate),
      render: (value: string, row) => (
        <div>
          {formatDate(value)}
          {row.isOverdue && (
            <div className="overdue-note">{t('operatingExpenses.status.overdue')}</div>
          )}
        </div>
      ),
    },
    { title: t('operatingExpenses.columns.type'), dataIndex: ['type', 'name'], width: 180 },
    { title: t('operatingExpenses.columns.legalEntity'), dataIndex: ['legalEntity', 'name'], width: 180 },
    {
      title: t('operatingExpenses.columns.amount'),
      key: 'amount',
      width: 180,
      align: 'right',
      sorter: (left, right) => Number(left.amount) - Number(right.amount),
      render: (_, row) => formatMoney(row.amount, row.currencyCode),
    },
    { title: t('operatingExpenses.columns.purpose'), dataIndex: 'purpose', ellipsis: true },
    {
      title: t('operatingExpenses.columns.recurring'),
      dataIndex: 'isRecurringMonthly',
      width: 130,
      render: (value: boolean) => value ? t('common.yes') : t('common.no'),
    },
    {
      title: t('operatingExpenses.columns.paymentStatus'),
      key: 'paymentStatus',
      width: 175,
      render: (_, row) => row.paidAt
        ? <Tag color="green">{t('operatingExpenses.status.paid', { date: formatDate(row.paidAt) })}</Tag>
        : <Tag color={row.isOverdue ? 'red' : 'gold'}>{t('operatingExpenses.status.unpaid')}</Tag>,
    },
    {
      title: t('operatingExpenses.columns.actions'),
      key: 'actions',
      fixed: 'right',
      width: 285,
      render: (_, row) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            {t('operatingExpenses.actions.edit')}
          </Button>
          {row.paidAt ? (
            <Popconfirm
              title={t('operatingExpenses.confirm.unpay')}
              onConfirm={() => void unpay(row)}
            >
              <Button size="small" loading={actionId === row.id}>
                {t('operatingExpenses.actions.unpay')}
              </Button>
            </Popconfirm>
          ) : (
            <Button size="small" type="primary" onClick={() => openPay(row)}>
              {t('operatingExpenses.actions.pay')}
            </Button>
          )}
          <Popconfirm
            title={t('operatingExpenses.confirm.delete')}
            onConfirm={() => void remove(row)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={actionId === row.id}
              aria-label={t('operatingExpenses.actions.delete')}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const typeOptions = useMemo(() => {
    const items = (context?.types ?? []).filter((item) => item.isActive);
    if (editing && !items.some((item) => item.id === editing.type.id)) items.push(editing.type);
    return items.map((item) => ({ value: item.id, label: item.name }));
  }, [context?.types, editing]);

  const legalEntityOptions = useMemo(() => {
    const items = [...(context?.legalEntities ?? [])];
    if (editing && !items.some((item) => item.id === editing.legalEntity.id)) {
      items.push({ ...editing.legalEntity, numberingPrefix: '' });
    }
    return items.map((item) => ({ value: item.id, label: item.name }));
  }, [context?.legalEntities, editing]);

  const currencyOptions = useMemo(() => {
    const items = [...(context?.currencies ?? [])];
    if (editing && !items.some((item) => item.code === editing.currency.code)) {
      items.push({ ...editing.currency, isActive: false });
    }
    return items.map((item) => ({ value: item.code, label: item.code }));
  }, [context?.currencies, editing]);


  const summary = useMemo(() => {
    const buckets: Record<string, { amounts: Record<string, number>; count: number }> = {
      total: { amounts: {}, count: 0 },
      paid: { amounts: {}, count: 0 },
      unpaid: { amounts: {}, count: 0 },
      overdue: { amounts: {}, count: 0 },
    };
    const add = (key: string, code: string, value: number) => {
      if (!Number.isFinite(value) || value === 0) return;
      buckets[key].amounts[code] = (buckets[key].amounts[code] ?? 0) + value;
    };
    for (const row of rows) {
      const value = Number(row.amount);
      const code = row.currencyCode;
      buckets.total.count += 1;
      add('total', code, value);
      const key = row.paidAt ? 'paid' : 'unpaid';
      buckets[key].count += 1;
      add(key, code, value);
      if (!row.paidAt && row.isOverdue) { buckets.overdue.count += 1; add('overdue', code, value); }
    }
    const tones: Record<string, string | undefined> = { total: undefined, paid: 'positive', unpaid: undefined, overdue: 'dark' };
    return (['total', 'paid', 'unpaid', 'overdue'] as const).map((key) => ({
      key,
      tone: tones[key],
      count: buckets[key].count,
      amounts: Object.entries(buckets[key].amounts).sort((left, right) => right[1] - left[1]),
    }));
  }, [rows]);

  return (
    <section className="list-page operating-expenses-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('operatingExpenses.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('operatingExpenses.subtitle')}</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('operatingExpenses.actions.create')}
        </Button>
      </div>

      <div className="kpi-row">
        {summary.map((card) => (
          <div className={`kpi-card${card.tone ? ` ${card.tone}` : ''}`} key={card.key}>
            <div className="kpi-card-label">{t(`operatingExpenses.summary.${card.key}`)}</div>
            <div className="kpi-card-value">
              {card.amounts.length === 0
                ? t('common.dash')
                : card.amounts.map(([code, value]) => <div key={code}>{formatMoney(String(value), code)}</div>)}
            </div>
            <div className="kpi-card-note">{t('operatingExpenses.summary.count', { count: card.count })}</div>
          </div>
        ))}
      </div>
      <p className="kpi-caption">{t('operatingExpenses.summary.caption')}</p>

      <Card>
        <div className="table-toolbar operating-expenses-filters">
          <Input
            type="date"
            value={dueDateFrom}
            onChange={(event) => setDueDateFrom(event.target.value)}
            aria-label={t('operatingExpenses.filters.from')}
          />
          <Input
            type="date"
            value={dueDateTo}
            onChange={(event) => setDueDateTo(event.target.value)}
            aria-label={t('operatingExpenses.filters.to')}
          />
          <Select
            allowClear
            value={typeId}
            onChange={setTypeId}
            placeholder={t('operatingExpenses.filters.type')}
            options={context?.types.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Select
            allowClear
            value={legalEntityId}
            onChange={setLegalEntityId}
            placeholder={t('operatingExpenses.filters.legalEntity')}
            options={context?.legalEntities.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Radio.Group
            value={paid}
            onChange={(event) => setPaid(event.target.value as PaidFilter)}
            optionType="button"
            options={(['ALL', 'UNPAID', 'PAID'] as PaidFilter[]).map((value) => ({
              value,
              label: t(`operatingExpenses.filters.payment.${value}`),
            }))}
          />
        </div>
        <Table<OperatingExpenseRecord>
          className="operating-expenses-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1450 }}
          rowClassName={(row) => row.isOverdue ? 'overdue-row' : ''}
          locale={{ emptyText: t('operatingExpenses.empty') }}
        />
      </Card>

      <Modal
        open={editorOpen}
        width={680}
        title={t(editing ? 'operatingExpenses.form.editTitle' : 'operatingExpenses.form.createTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => form.submit()}
        onCancel={() => setEditorOpen(false)}
        destroyOnHidden
      >
        <Form<ExpenseFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void save(values)}
        >
          <Form.Item name="typeId" label={t('operatingExpenses.form.type')} rules={[{
            required: true,
            message: t('operatingExpenses.validation.type'),
          }]}>
            <Select showSearch optionFilterProp="label" options={typeOptions} />
          </Form.Item>
          <Form.Item name="legalEntityId" label={t('operatingExpenses.form.legalEntity')} rules={[{
            required: true,
            message: t('operatingExpenses.validation.legalEntity'),
          }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={legalEntityOptions}
            />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="amount" label={t('operatingExpenses.form.amount')} className="operating-expense-amount" rules={[{
            required: true,
            message: t('operatingExpenses.validation.amount'),
          }, {
            type: 'number',
            min: 0.01,
            message: t('operatingExpenses.validation.amount'),
            }]}>
              <MoneyInput min={0.01} precision={2} className="full-width" />
            </Form.Item>
            <Form.Item name="currencyCode" label={t('operatingExpenses.form.currency')} className="operating-expense-currency" rules={[{
              required: true,
              message: t('operatingExpenses.validation.currency'),
            }]}>
              <Select options={currencyOptions} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="dueDate" label={t('operatingExpenses.form.dueDate')} rules={[{
            required: true,
            message: t('operatingExpenses.validation.dueDate'),
          }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="purpose" label={t('operatingExpenses.form.purpose')} rules={[{
            required: true,
            whitespace: true,
            message: t('operatingExpenses.validation.purpose'),
          }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="isRecurringMonthly" label={t('operatingExpenses.form.recurring')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(paying)}
        title={t('operatingExpenses.pay.title')}
        okText={t('operatingExpenses.actions.pay')}
        cancelText={t('common.cancel')}
        confirmLoading={Boolean(paying && actionId === paying.id)}
        onOk={() => payForm.submit()}
        onCancel={() => setPaying(null)}
        destroyOnHidden
      >
        <Form form={payForm} layout="vertical" onFinish={(values) => void markPaid(values)}>
          <Form.Item name="paidAt" label={t('operatingExpenses.pay.date')} rules={[{
            required: true,
            message: t('operatingExpenses.validation.paidAt'),
          }]}>
            <Input type="date" max={todayDateOnly()} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
