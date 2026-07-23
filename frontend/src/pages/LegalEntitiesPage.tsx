import { PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import {
  LegalEntityRecord,
  LegalEntityTaxRate,
  TaxRateKind,
  TaxRegime,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface LegalEntityFormValues {
  name: string;
  numberingPrefix: string;
  bin?: string;
  legalAddress?: string;
  taxRegime: TaxRegime;
  isActive?: boolean;
}

interface TaxRateFormValues {
  ratePercent: number;
  isVatPayer?: boolean;
  effectiveFrom: Dayjs;
  note?: string;
}

const TAX_REGIMES: TaxRegime[] = ['GENERAL', 'SIMPLIFIED', 'OTHER'];

export function LegalEntitiesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [legalEntities, setLegalEntities] = useState<LegalEntityRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [taxRates, setTaxRates] = useState<LegalEntityTaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rateKind, setRateKind] = useState<TaxRateKind>();
  const [createForm] = Form.useForm<LegalEntityFormValues>();
  const [editForm] = Form.useForm<LegalEntityFormValues>();
  const [taxRateForm] = Form.useForm<TaxRateFormValues>();
  const canManage = Boolean(
    user?.roles.some((role) => role === 'ADMIN' || role === 'FINANCIER'),
  );

  const selected = useMemo(
    () => legalEntities.find((item) => item.id === selectedId),
    [legalEntities, selectedId],
  );

  const showError = useCallback(
    (error: unknown) => {
      void message.error(
        error instanceof ApiError
          ? error.message || t('errors.request')
          : t('errors.connection'),
      );
    },
    [message, t],
  );

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<LegalEntityRecord[]>('/legal-entities/admin');
      setLegalEntities(data);
      setSelectedId((current) =>
        current && data.some((item) => item.id === current)
          ? current
          : data[0]?.id,
      );
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadTaxRates = useCallback(async (legalEntityId: string) => {
    setRatesLoading(true);
    try {
      const data = await apiRequest<LegalEntityTaxRate[]>(
        `/legal-entities/${legalEntityId}/tax-rates`,
      );
      setTaxRates(data);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setRatesLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (canManage) void loadEntities();
  }, [canManage, loadEntities]);

  useEffect(() => {
    if (selectedId) void loadTaxRates(selectedId);
    else setTaxRates([]);
  }, [loadTaxRates, selectedId]);

  useEffect(() => {
    if (!selected) return;
    editForm.setFieldsValue({
      name: selected.name,
      numberingPrefix: selected.numberingPrefix,
      bin: selected.bin ?? undefined,
      legalAddress: selected.legalAddress ?? undefined,
      taxRegime: selected.taxRegime,
      isActive: selected.isActive,
    });
  }, [editForm, selected]);

  if (!canManage) return <Navigate to="/" replace />;

  const regimeOptions = TAX_REGIMES.map((value) => ({
    value,
    label: t(`legalEntities.regimes.${value}`),
  }));

  const createLegalEntity = async (values: LegalEntityFormValues) => {
    setSaving(true);
    try {
      const created = await apiRequest<LegalEntityRecord>('/legal-entities', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          numberingPrefix: values.numberingPrefix,
          bin: values.bin,
          legalAddress: values.legalAddress,
          taxRegime: values.taxRegime,
        }),
      });
      void message.success(t('legalEntities.messages.created'));
      setCreateOpen(false);
      createForm.resetFields();
      await loadEntities();
      setSelectedId(created.id);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const updateLegalEntity = async (values: LegalEntityFormValues) => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiRequest(`/legal-entities/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          bin: values.bin ?? null,
          legalAddress: values.legalAddress ?? null,
          taxRegime: values.taxRegime,
          isActive: values.isActive,
        }),
      });
      void message.success(t('legalEntities.messages.updated'));
      await loadEntities();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openTaxRate = (kind: TaxRateKind) => {
    setRateKind(kind);
    taxRateForm.resetFields();
    taxRateForm.setFieldsValue(
      kind === 'VAT' ? { isVatPayer: false } : {},
    );
  };

  const createTaxRate = async (values: TaxRateFormValues) => {
    if (!selected || !rateKind) return;
    setSaving(true);
    try {
      await apiRequest(`/legal-entities/${selected.id}/tax-rates`, {
        method: 'POST',
        body: JSON.stringify({
          kind: rateKind,
          ratePercent: values.ratePercent,
          effectiveFrom: values.effectiveFrom.format('YYYY-MM-DD'),
          ...(rateKind === 'VAT'
            ? { isVatPayer: Boolean(values.isVatPayer) }
            : {}),
          note: values.note,
        }),
      });
      void message.success(t('legalEntities.messages.rateCreated'));
      setRateKind(undefined);
      taxRateForm.resetFields();
      await loadTaxRates(selected.id);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const currentRateId = (kind: TaxRateKind) => {
    const today = new Date().toISOString().slice(0, 10);
    return taxRates
      .filter(
        (rate) =>
          rate.kind === kind && rate.effectiveFrom.slice(0, 10) <= today,
      )
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]?.id;
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ru-RU', { timeZone: 'UTC' });

  const listColumns: ColumnsType<LegalEntityRecord> = [
    {
      title: t('legalEntities.columns.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('legalEntities.columns.prefix'),
      dataIndex: 'numberingPrefix',
      key: 'numberingPrefix',
      width: 100,
    },
    {
      title: t('legalEntities.columns.bin'),
      dataIndex: 'bin',
      key: 'bin',
      render: (value: string | null) => value || t('common.notSpecified'),
    },
    {
      title: t('legalEntities.columns.regime'),
      dataIndex: 'taxRegime',
      key: 'taxRegime',
      render: (value: TaxRegime) => t(`legalEntities.regimes.${value}`),
    },
    {
      title: t('legalEntities.columns.active'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {t(value ? 'common.yes' : 'common.no')}
        </Tag>
      ),
    },
  ];

  const rateColumns = (kind: TaxRateKind): ColumnsType<LegalEntityTaxRate> => [
    ...(kind === 'VAT'
      ? [{
        title: t('legalEntities.taxRates.payer'),
        dataIndex: 'isVatPayer',
        key: 'isVatPayer',
        width: 120,
        render: (value: boolean | null) => t(value ? 'common.yes' : 'common.no'),
      }]
      : []),
    {
      title: t('legalEntities.taxRates.rate'),
      dataIndex: 'ratePercent',
      key: 'ratePercent',
      width: 110,
      render: (value: string) => `${Number(value).toFixed(2)}%`,
    },
    {
      title: t('legalEntities.taxRates.effectiveFrom'),
      dataIndex: 'effectiveFrom',
      key: 'effectiveFrom',
      width: 135,
      render: (value: string, rate) => (
        <Space direction="vertical" size={2}>
          <span>{formatDate(value)}</span>
          {rate.id === currentRateId(kind) && (
            <Tag color="success">{t('legalEntities.taxRates.current')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('legalEntities.taxRates.note'),
      dataIndex: 'note',
      key: 'note',
      render: (value: string | null) => value || t('common.notSpecified'),
    },
  ];

  const legalEntityFields = (editing: boolean) => (
    <>
      <Form.Item
        name="name"
        label={t('legalEntities.form.name')}
        rules={[{ required: true, message: t('legalEntities.validation.name') }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        name="numberingPrefix"
        label={t('legalEntities.form.prefix')}
        extra={editing ? t('legalEntities.form.prefixImmutable') : undefined}
        rules={[{ required: true, message: t('legalEntities.validation.prefix') }]}
      >
        <Input disabled={editing} />
      </Form.Item>
      <Form.Item name="bin" label={t('legalEntities.form.bin')}>
        <Input />
      </Form.Item>
      <Form.Item name="legalAddress" label={t('legalEntities.form.address')}>
        <Input />
      </Form.Item>
      <Form.Item
        name="taxRegime"
        label={t('legalEntities.form.regime')}
        rules={[{ required: true, message: t('legalEntities.validation.regime') }]}
      >
        <Select options={regimeOptions} />
      </Form.Item>
      {editing && (
        <Form.Item name="isActive" valuePropName="checked">
          <Checkbox>{t('legalEntities.form.active')}</Checkbox>
        </Form.Item>
      )}
    </>
  );

  const rateCard = (kind: TaxRateKind) => (
    <Card
      className="tax-history-card"
      title={t(`legalEntities.taxRates.titles.${kind}`)}
      extra={
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => openTaxRate(kind)}
        >
          {t('legalEntities.taxRates.add')}
        </Button>
      }
    >
      <Table
        rowKey="id"
        size="small"
        columns={rateColumns(kind)}
        dataSource={taxRates.filter((rate) => rate.kind === kind)}
        loading={ratesLoading}
        pagination={false}
        scroll={{ x: 580 }}
        locale={{ emptyText: t('legalEntities.taxRates.empty') }}
      />
    </Card>
  );

  return (
    <div className="legal-entities-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('legalEntities.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('legalEntities.subtitle')}
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields();
            createForm.setFieldsValue({ taxRegime: 'GENERAL' });
            setCreateOpen(true);
          }}
        >
          {t('legalEntities.add')}
        </Button>
      </div>

      <Card className="legal-entities-list-card">
        <Table
          rowKey="id"
          columns={listColumns}
          dataSource={legalEntities}
          loading={loading}
          pagination={false}
          scroll={{ x: 760 }}
          rowClassName={(item) =>
            `${item.isActive ? '' : 'inactive-row'}${
              item.id === selectedId ? ' selected-row' : ''
            }`
          }
          onRow={(item) => ({
            onClick: () => setSelectedId(item.id),
          })}
          locale={{ emptyText: t('legalEntities.empty') }}
        />
      </Card>

      {selected && (
        <div className="legal-entity-details">
          <Card title={t('legalEntities.details.title', { name: selected.name })}>
            <Form<LegalEntityFormValues>
              form={editForm}
              layout="vertical"
              onFinish={updateLegalEntity}
              requiredMark={false}
            >
              <div className="legal-entity-form-grid">
                {legalEntityFields(true)}
              </div>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('common.save')}
              </Button>
            </Form>
          </Card>
          {rateCard('VAT')}
          {rateCard('INCOME_TAX')}
        </div>
      )}

      <Modal
        open={createOpen}
        title={t('legalEntities.form.createTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => createForm.submit()}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
      >
        <Form<LegalEntityFormValues>
          form={createForm}
          layout="vertical"
          onFinish={createLegalEntity}
          requiredMark={false}
        >
          {legalEntityFields(false)}
        </Form>
      </Modal>

      <Modal
        open={Boolean(rateKind)}
        title={
          rateKind
            ? t('legalEntities.taxRates.createTitle', {
              kind: t(`legalEntities.taxRates.names.${rateKind}`),
            })
            : undefined
        }
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => taxRateForm.submit()}
        onCancel={() => setRateKind(undefined)}
        destroyOnHidden
      >
        <Form<TaxRateFormValues>
          form={taxRateForm}
          layout="vertical"
          onFinish={createTaxRate}
          requiredMark={false}
        >
          {rateKind === 'VAT' && (
            <Form.Item name="isVatPayer" valuePropName="checked">
              <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
              <Typography.Text className="tax-payer-label">
                {t('legalEntities.taxRates.payer')}
              </Typography.Text>
            </Form.Item>
          )}
          <Form.Item
            name="ratePercent"
            label={t('legalEntities.taxRates.rate')}
            rules={[
              { required: true, message: t('legalEntities.validation.rate') },
              {
                type: 'number',
                min: 0,
                max: 100,
                message: t('legalEntities.validation.rateRange'),
              },
            ]}
          >
            <InputNumber min={0} max={100} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item
            name="effectiveFrom"
            label={t('legalEntities.taxRates.effectiveFrom')}
            rules={[
              { required: true, message: t('legalEntities.validation.date') },
            ]}
          >
            <DatePicker className="full-width" />
          </Form.Item>
          <Form.Item name="note" label={t('legalEntities.taxRates.note')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
