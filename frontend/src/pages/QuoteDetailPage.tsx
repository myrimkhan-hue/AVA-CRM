import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDownload, ApiError, apiRequest, saveBlob } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  ContractRequisitesFormValues,
  GenerateContractModal,
} from '../components/GenerateContractModal';
import { MoneyInput } from '../components/MoneyInput';
import { DEAL_REJECT_REASONS, DEAL_STAGE_COLORS } from '../deals/shared';
import {
  DELIVERY_TERMS,
  QUOTE_CURRENCIES,
  Quote,
  QuoteFormValues,
  QuoteOption,
  QuoteOptionFormValues,
  QuoteReference,
  QuoteUserReference,
  QuoteRejectReason,
  hasManagerQuoteRights,
} from '../quotes/shared';
import { MODES } from '../transportations/shared';

interface LoseValues {
  rejectReason: QuoteRejectReason;
  rejectComment?: string;
}

interface WinValues {
  optionId: string;
}

interface WinResponse extends Quote {
  hasActiveContract: boolean;
}

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const [editForm] = Form.useForm<QuoteFormValues>();
  const [optionForm] = Form.useForm<QuoteOptionFormValues>();
  const [loseForm] = Form.useForm<LoseValues>();
  const [winForm] = Form.useForm<WinValues>();
  const [quote, setQuote] = useState<Quote>();
  const [carriers, setCarriers] = useState<QuoteReference[]>([]);
  const [logists, setLogists] = useState<QuoteUserReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [optionOpen, setOptionOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<QuoteOption>();
  const [loseOpen, setLoseOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [won, setWon] = useState<WinResponse>();
  const [contractOpen, setContractOpen] = useState(false);
  const rejectReason = Form.useWatch('rejectReason', loseForm);
  const mayManage = hasManagerQuoteRights(user?.roles);
  // «Взять себе» — только для логистов: исполнителем перевозки может стать
  // лишь сотрудник с этой ролью, и сервер проверяет то же самое.
  // Остальные назначают исполнителя через «Назначить логиста».
  const mayTake = Boolean(user?.roles.includes('LOGIST'));
  const mayEditOptions = Boolean(user?.roles.some((role) => (
    [...['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'], 'LOGIST'].includes(role)
  )));
  const mayEditClientRate = mayManage;
  const showsClientRate = Boolean(
    quote?.quoteOptions.some((option) => Object.prototype.hasOwnProperty.call(option, 'clientRate')),
  );

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadQuote = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      setQuote(await apiRequest<Quote>(`/quotes/${id}`));
    } catch (error) {
      setLoadFailed(true);
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  useEffect(() => {
    if (!mayManage) return;
    apiRequest<QuoteUserReference[]>('/references/users')
      .then((rows) => setLogists(rows.filter((item) => item.isActive && item.roles.includes('LOGIST'))))
      .catch(showError);
  }, [mayManage, showError]);

  const searchCarriers = useCallback(async (value = '') => {
    try {
      const params = new URLSearchParams({ type: 'CARRIER' });
      if (value.trim()) params.set('search', value.trim());
      setCarriers(await apiRequest<QuoteReference[]>(`/contractors?${params.toString()}`));
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  const formatDate = useCallback((value: string | null) => {
    if (!value) return t('common.dash');
    return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));
  }, [i18n.language, t]);

  const formatNumber = useCallback((value: string | number | null) => {
    if (value === null) return t('common.dash');
    return new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(Number(value));
  }, [i18n.language, t]);

  const formatMoney = useCallback((value: string | number | null | undefined, currency: string | null | undefined) => {
    if (value === null || value === undefined || !currency) return t('common.dash');
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }, [i18n.language, t]);

  const openEdit = () => {
    if (!quote) return;
    editForm.setFieldsValue({
      logistId: quote.logist?.id,
      originPoint: quote.originPoint,
      destinationPoint: quote.destinationPoint,
      cargoName: quote.cargoName ?? undefined,
      weightKg: quote.weightKg === null ? undefined : Number(quote.weightKg),
      volumeM3: quote.volumeM3 === null ? undefined : Number(quote.volumeM3),
      placesCount: quote.placesCount ?? undefined,
      placesUnit: quote.placesUnit ?? undefined,
      isDangerous: quote.isDangerous,
      deliveryTerms: quote.deliveryTerms ?? undefined,
      cargoReadyDate: quote.cargoReadyDate ? dayjs(quote.cargoReadyDate) : undefined,
      transportMode: quote.transportMode,
      clientTargetRate: quote.deal.clientTargetRate === null
        ? undefined
        : Number(quote.deal.clientTargetRate),
      clientTargetRateCurrency: quote.deal.clientTargetRateCurrency as 'KZT' | 'USD' | undefined,
      quoteRateDate: quote.deal.quoteRateDate ? dayjs(quote.deal.quoteRateDate) : undefined,
    });
    setEditOpen(true);
  };

  const saveQuote = async (values: QuoteFormValues) => {
    if (!quote) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Quote>(`/quotes/${quote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          logistId: values.logistId !== quote.logist?.id ? values.logistId ?? null : undefined,
          originPoint: values.originPoint,
          destinationPoint: values.destinationPoint,
          cargoName: values.cargoName,
          weightKg: values.weightKg,
          volumeM3: values.volumeM3,
          placesCount: values.placesCount,
          placesUnit: values.placesUnit,
          isDangerous: values.isDangerous,
          deliveryTerms: values.deliveryTerms,
          cargoReadyDate: values.cargoReadyDate?.format('YYYY-MM-DD'),
          transportMode: values.transportMode,
          clientTargetRate: values.clientTargetRate,
          clientTargetRateCurrency: values.clientTargetRateCurrency,
          quoteRateDate: values.quoteRateDate?.format('YYYY-MM-DD'),
        }),
      });
      setQuote(updated);
      setEditOpen(false);
      void message.success(t('quotes.messages.updated'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openOption = (option?: QuoteOption) => {
    setEditingOption(option);
    optionForm.resetFields();
    optionForm.setFieldsValue(option ? {
      vehicleType: option.vehicleType ?? undefined,
      carrierId: option.carrierId ?? undefined,
      costRate: option.costRate === null ? undefined : Number(option.costRate),
      costRateCurrency: option.costRateCurrency as 'KZT' | 'USD' | undefined,
      clientRate: option.clientRate === null || option.clientRate === undefined
        ? undefined
        : Number(option.clientRate),
      clientRateCurrency: option.clientRateCurrency as 'KZT' | 'USD' | undefined,
      transitDays: option.transitDays ?? undefined,
      notes: option.notes ?? undefined,
    } : {
      costRateCurrency: 'KZT',
      clientRateCurrency: 'KZT',
    });
    if (option?.carrier) {
      setCarriers((current) => current.some((item) => item.id === option.carrier?.id)
        ? current
        : [...current, option.carrier as QuoteReference]);
    }
    setOptionOpen(true);
    void searchCarriers();
  };

  const saveOption = async (values: QuoteOptionFormValues) => {
    if (!quote) return;
    setSaving(true);
    try {
      const path = editingOption
        ? `/quotes/${quote.id}/options/${editingOption.id}`
        : `/quotes/${quote.id}/options`;
      const payload = mayEditClientRate
        ? values
        : Object.fromEntries(Object.entries(values).filter(([key]) => (
          key !== 'clientRate' && key !== 'clientRateCurrency'
        )));
      await apiRequest(path, {
        method: editingOption ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setOptionOpen(false);
      void message.success(t(editingOption ? 'quotes.messages.optionUpdated' : 'quotes.messages.optionCreated'));
      await loadQuote();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const removeOption = (option: QuoteOption) => {
    if (!quote) return;
    modal.confirm({
      title: t('quotes.options.deleteTitle'),
      content: t('quotes.options.deleteText', { sequence: option.sequence }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await apiRequest(`/quotes/${quote.id}/options/${option.id}`, { method: 'DELETE' });
          void message.success(t('quotes.messages.optionDeleted'));
          await loadQuote();
        } catch (error) {
          showError(error);
        }
      },
    });
  };

  const takeQuote = async () => {
    if (!quote || quote.logist || !mayTake) return;
    setSaving(true);
    try {
      setQuote(await apiRequest<Quote>(`/quotes/${quote.id}/take`, { method: 'POST' }));
      void message.success(t('quotes.messages.taken'));
    } catch (error) {
      showError(error);
      await loadQuote();
    } finally {
      setSaving(false);
    }
  };

  const markSent = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      setQuote(await apiRequest<Quote>(`/quotes/${quote.id}/sent`, { method: 'POST' }));
      void message.success(t('quotes.messages.sent'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const lose = async (values: LoseValues) => {
    if (!quote) return;
    setSaving(true);
    try {
      setQuote(await apiRequest<Quote>(`/quotes/${quote.id}/lose`, {
        method: 'POST',
        body: JSON.stringify(values),
      }));
      setLoseOpen(false);
      void message.success(t('quotes.messages.lost'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openWin = () => {
    if (!quote?.logist) return;
    const onlyOption = quote?.quoteOptions.length === 1 ? quote.quoteOptions[0] : undefined;
    winForm.setFieldsValue({ optionId: onlyOption?.id });
    setWinOpen(true);
  };

  const win = async (values: WinValues) => {
    if (!quote) return;
    setSaving(true);
    try {
      const result = await apiRequest<WinResponse>(`/quotes/${quote.id}/win`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setWon(result);
      setWinOpen(false);
      void message.success(t('quotes.messages.won'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const removeQuote = () => {
    if (!quote) return;
    modal.confirm({
      title: t('quotes.delete.title'),
      content: t('quotes.delete.text', { number: quote.number }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await apiRequest(`/quotes/${quote.id}`, { method: 'DELETE' });
          void message.success(t('quotes.messages.deleted'));
          navigate('/quotes');
        } catch (error) {
          showError(error);
        }
      },
    });
  };

  const generateContract = async (overrides: ContractRequisitesFormValues) => {
    if (!won) return;
    const { blob, filename } = await apiDownload(`/documents/contracts/deal/${won.deal.id}`, {
      method: 'POST',
      body: JSON.stringify({ overrides }),
    });
    saveBlob(blob, filename);
    void message.success(t('documents.contract.generated'));
  };

  const columns = useMemo<ColumnsType<QuoteOption>>(() => {
    const result: ColumnsType<QuoteOption> = [
      {
        title: t('quotes.options.sequence'),
        dataIndex: 'sequence',
        width: 70,
        render: (value: number, option) => (
          <Space>
            <span>{value}</span>
            {option.isSelected && <Tag bordered={false} className="quote-selected-tag" icon={<CheckOutlined />}>{t('quotes.options.selected')}</Tag>}
          </Space>
        ),
      },
      {
        title: t('quotes.options.vehicleType'),
        dataIndex: 'vehicleType',
        width: 140,
        render: (value: string | null) => value || t('common.dash'),
      },
      {
        title: t('quotes.options.carrier'),
        key: 'carrier',
        width: 190,
        render: (_, option) => option.carrier?.name || t('common.dash'),
      },
      {
        title: t('quotes.options.costRate'),
        key: 'costRate',
        width: 150,
        align: 'right',
        render: (_, option) => formatMoney(option.costRate, option.costRateCurrency),
      },
    ];
    if (showsClientRate) {
      result.push({
        title: t('quotes.options.clientRate'),
        key: 'clientRate',
        width: 150,
        align: 'right',
        render: (_, option) => formatMoney(option.clientRate, option.clientRateCurrency),
      });
    }
    result.push(
      {
        title: t('quotes.options.transitDays'),
        dataIndex: 'transitDays',
        width: 115,
        render: (value: number | null) => value ?? t('common.dash'),
      },
      {
        title: t('quotes.options.notes'),
        dataIndex: 'notes',
        width: 220,
        render: (value: string | null) => value || t('common.dash'),
      },
    );
    if (mayEditOptions) {
      result.push({
        title: t('quotes.options.actions'),
        key: 'actions',
        width: 105,
        fixed: 'right',
        render: (_, option) => (
          <Space size="small">
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label={t('quotes.options.edit')}
              onClick={() => openOption(option)}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('quotes.options.delete')}
              onClick={() => removeOption(option)}
            />
          </Space>
        ),
      });
    }
    return result;
  }, [formatMoney, mayEditOptions, showsClientRate, t]);

  if (loading) return <Spin className="detail-spin" />;
  if (loadFailed || !quote) {
    return <Result status="error" title={t('quotes.loadError')} extra={(
      <Button onClick={() => navigate('/quotes')}>{t('quotes.actions.backToList')}</Button>
    )} />;
  }

  if (won) {
    return (
      <section className="transportation-workspace quote-detail-page">
        <Result
          status="success"
          title={t('quotes.win.successTitle')}
          subTitle={t('quotes.win.successText', { number: won.number })}
          extra={[
            <Button key="list" onClick={() => navigate('/quotes')}>
              {t('quotes.actions.backToList')}
            </Button>,
            <Button key="transportation" type="primary" onClick={() => navigate(`/transportations/${won.id}`)}>
              {t('quotes.win.openTransportation')}
            </Button>,
          ]}
        />
        {!won.hasActiveContract && (
          <Alert
            className="quote-contract-alert"
            type="warning"
            showIcon
            message={t('quotes.win.noContractTitle')}
            description={t('quotes.win.noContractText')}
            action={<Button onClick={() => setContractOpen(true)}>{t('quotes.win.generateContract')}</Button>}
          />
        )}
        <GenerateContractModal
          open={contractOpen}
          contractorId={won.deal.client.id}
          onClose={() => setContractOpen(false)}
          onGenerate={generateContract}
        />
      </section>
    );
  }

  return (
    <section className="transportation-workspace quote-detail-page">
      <Button type="link" className="back-link" onClick={() => navigate('/quotes')}>
        {t('quotes.actions.backToList')}
      </Button>

      <div className="detail-header-panel">
        <div className="detail-header-main">
          <div className="detail-header-title">
            <h1>{quote.number}</h1>
            <Tag bordered={false} style={DEAL_STAGE_COLORS[quote.deal.stage]}>
              {t(`deals.stages.${quote.deal.stage}`)}
            </Tag>
          </div>
          <div className="detail-header-meta">
            <span>{quote.deal.client.name}</span>
            <span>{t('quotes.values.route', { from: quote.originPoint, to: quote.destinationPoint })}</span>
            <span>{formatDate(quote.createdAt)}</span>
          </div>
        </div>
        {mayManage && (
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={openEdit}>{t('common.edit')}</Button>
            <Button danger icon={<DeleteOutlined />} onClick={removeQuote}>{t('common.delete')}</Button>
          </Space>
        )}
      </div>

      {mayManage && (
        <Card className="transport-card quote-actions-card">
          <Space wrap>
            <Button icon={<SendOutlined />} loading={saving} onClick={() => void markSent()}>
              {t('quotes.actions.sent')}
            </Button>
            <Button className={quote.logist ? 'create-green' : undefined} disabled={!quote.logist || saving} icon={<TrophyOutlined />} onClick={openWin}>
              {t('quotes.actions.win')}
            </Button>
            <Button danger icon={<StopOutlined />} onClick={() => setLoseOpen(true)}>
              {t('quotes.actions.lose')}
            </Button>
          </Space>
          {!quote.logist && (
            <Typography.Paragraph type="secondary">
              {t('quotes.hints.assignBeforeWin')}
            </Typography.Paragraph>
          )}
        </Card>
      )}

      <div className="detail-columns quote-detail-columns">
        <main className="detail-main">
          <Card
            className="transport-card"
            title={t('quotes.sections.cargo')}
            extra={mayManage ? <Button type="link" icon={<EditOutlined />} onClick={openEdit}>{t('common.edit')}</Button> : undefined}
          >
            <Descriptions column={{ xs: 1, sm: 2 }} items={[
              { key: 'route', label: t('quotes.columns.route'), children: t('quotes.values.route', { from: quote.originPoint, to: quote.destinationPoint }) },
              { key: 'cargo', label: t('quotes.fields.cargoName'), children: quote.cargoName || t('common.dash') },
              { key: 'weight', label: t('quotes.fields.weight'), children: formatNumber(quote.weightKg) },
              { key: 'volume', label: t('quotes.fields.volume'), children: formatNumber(quote.volumeM3) },
              { key: 'places', label: t('quotes.fields.places'), children: quote.placesCount ? `${quote.placesCount} ${quote.placesUnit ?? ''}`.trim() : t('common.dash') },
              { key: 'dangerous', label: t('quotes.fields.isDangerous'), children: t(quote.isDangerous ? 'common.yes' : 'common.no') },
              { key: 'terms', label: t('quotes.fields.deliveryTerms'), children: quote.deliveryTerms || t('common.dash') },
              { key: 'ready', label: t('quotes.fields.cargoReadyDate'), children: formatDate(quote.cargoReadyDate) },
              { key: 'mode', label: t('quotes.fields.transportMode'), children: t(`transportations.transportModes.${quote.transportMode}`) },
            ]} />
          </Card>

          <Card
            className="transport-card"
            title={t('quotes.sections.options')}
            extra={mayEditOptions ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openOption()}>
                {t('quotes.options.add')}
              </Button>
            ) : undefined}
          >
            <Table<QuoteOption>
              rowKey="id"
              columns={columns}
              dataSource={quote.quoteOptions}
              pagination={false}
              scroll={{ x: showsClientRate ? 1100 : 950 }}
              rowClassName={(option) => option.isSelected ? 'quote-option-selected' : ''}
              locale={{ emptyText: t('quotes.options.empty') }}
            />
          </Card>
        </main>

        <aside className="detail-side">
          <Card className="transport-card" title={t('quotes.sections.money')}>
            <div className="quote-money-value">
              <Typography.Text type="secondary">{t('quotes.fields.clientTargetRate')}</Typography.Text>
              <strong>{formatMoney(quote.deal.clientTargetRate, quote.deal.clientTargetRateCurrency)}</strong>
              {quote.deal.clientTargetRateKzt && quote.deal.clientTargetRateCurrency !== 'KZT' && (
                <small>{t('quotes.values.inKzt', { value: formatMoney(quote.deal.clientTargetRateKzt, 'KZT') })}</small>
              )}
            </div>
            <Descriptions column={1} size="small" items={[
              { key: 'rateDate', label: t('quotes.fields.quoteRateDate'), children: formatDate(quote.deal.quoteRateDate) },
            ]} />
          </Card>

          <Card className="transport-card" title={t('quotes.sections.clientAndTeam')}>
            <Descriptions column={1} size="small" items={[
              { key: 'client', label: t('quotes.fields.client'), children: <Link to="/contractors">{quote.deal.client.name}</Link> },
              { key: 'entity', label: t('quotes.fields.legalEntity'), children: quote.deal.legalEntity.name },
              { key: 'responsible', label: t('quotes.fields.responsible'), children: quote.deal.responsible.fullName },
              { key: 'logist', label: t('quotes.fields.logist'), children: quote.logist?.fullName ?? (
                <Tag bordered={false} className="quote-unassigned-tag">
                  {t('quotes.values.unassigned')}
                </Tag>
              ) },
              { key: 'department', label: t('quotes.fields.department'), children: quote.deal.department?.name || t('common.dash') },
            ]} />
            <Space wrap>
              {mayManage && (
                <Button type="link" onClick={openEdit} disabled={saving}>
                  {t('quotes.actions.assignLogist')}
                </Button>
              )}
              {mayTake && !quote.logist && (
                <Button type="primary" onClick={() => void takeQuote()} loading={saving}>
                  {t('quotes.actions.take')}
                </Button>
              )}
            </Space>
          </Card>
        </aside>
      </div>

      <Modal
        open={editOpen}
        title={t('quotes.edit.title')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        width={760}
        destroyOnHidden
        onOk={() => editForm.submit()}
        onCancel={() => setEditOpen(false)}
      >
        <Form<QuoteFormValues> form={editForm} layout="vertical" onFinish={(values) => void saveQuote(values)}>
          <div className="form-grid two">
            <Form.Item name="logistId" label={t('quotes.fields.logist')} extra={t('quotes.hints.optionalLogist')} className="span-all">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('quotes.values.unassigned')}
                options={[
                  ...logists.map((item) => ({ value: item.id, label: item.fullName })),
                  ...(quote.logist && !logists.some((item) => item.id === quote.logist?.id)
                    ? [{ value: quote.logist.id, label: quote.logist.fullName }]
                    : []),
                ]}
              />
            </Form.Item>
            <Form.Item name="originPoint" label={t('quotes.fields.origin')} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="destinationPoint" label={t('quotes.fields.destination')} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="cargoName" label={t('quotes.fields.cargoName')}><Input /></Form.Item>
            <Form.Item name="transportMode" label={t('quotes.fields.transportMode')}><Select options={MODES.map((value) => ({ value, label: t(`transportations.transportModes.${value}`) }))} /></Form.Item>
            <Form.Item name="weightKg" label={t('quotes.fields.weight')}><InputNumber min={0} precision={3} className="full-width" /></Form.Item>
            <Form.Item name="volumeM3" label={t('quotes.fields.volume')}><InputNumber min={0} precision={3} className="full-width" /></Form.Item>
            <Form.Item name="placesCount" label={t('quotes.fields.placesCount')}><InputNumber min={1} precision={0} className="full-width" /></Form.Item>
            <Form.Item name="placesUnit" label={t('quotes.fields.placesUnit')}><Input /></Form.Item>
            <Form.Item name="deliveryTerms" label={t('quotes.fields.deliveryTerms')}><Select allowClear options={DELIVERY_TERMS.map((value) => ({ value, label: value }))} /></Form.Item>
            <Form.Item name="cargoReadyDate" label={t('quotes.fields.cargoReadyDate')}><DatePicker className="full-width" /></Form.Item>
            <Form.Item name="isDangerous" valuePropName="checked"><Checkbox>{t('quotes.fields.isDangerous')}</Checkbox></Form.Item>
            <Form.Item label={t('quotes.fields.clientTargetRate')}>
              <Space.Compact block>
                <Form.Item name="clientTargetRate" noStyle><MoneyInput min={0} className="money-number" /></Form.Item>
                <Form.Item name="clientTargetRateCurrency" noStyle><Select className="currency-select" options={QUOTE_CURRENCIES.map((value) => ({ value, label: value }))} /></Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="quoteRateDate" label={t('quotes.fields.quoteRateDate')}><DatePicker className="full-width" /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        open={optionOpen}
        title={t(editingOption ? 'quotes.options.editTitle' : 'quotes.options.addTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        width={720}
        destroyOnHidden
        onOk={() => optionForm.submit()}
        onCancel={() => setOptionOpen(false)}
      >
        <Form<QuoteOptionFormValues> form={optionForm} layout="vertical" onFinish={(values) => void saveOption(values)}>
          <div className="form-grid two">
            <Form.Item name="vehicleType" label={t('quotes.options.vehicleType')}><Input /></Form.Item>
            <Form.Item name="carrierId" label={t('quotes.options.carrier')}>
              <Select showSearch allowClear filterOption={false} options={carriers.map((item) => ({ value: item.id, label: item.name }))} onSearch={(value) => void searchCarriers(value)} />
            </Form.Item>
            <Form.Item label={t('quotes.options.costRate')}>
              <Space.Compact block>
                <Form.Item name="costRate" noStyle><MoneyInput min={0} className="money-number" /></Form.Item>
                <Form.Item name="costRateCurrency" noStyle><Select className="currency-select" options={QUOTE_CURRENCIES.map((value) => ({ value, label: value }))} /></Form.Item>
              </Space.Compact>
            </Form.Item>
            {mayEditClientRate && (
              <Form.Item label={t('quotes.options.clientRate')}>
                <Space.Compact block>
                  <Form.Item name="clientRate" noStyle><MoneyInput min={0} className="money-number" /></Form.Item>
                  <Form.Item name="clientRateCurrency" noStyle><Select className="currency-select" options={QUOTE_CURRENCIES.map((value) => ({ value, label: value }))} /></Form.Item>
                </Space.Compact>
              </Form.Item>
            )}
            <Form.Item name="transitDays" label={t('quotes.options.transitDays')}><InputNumber min={1} precision={0} className="full-width" /></Form.Item>
            <Form.Item name="notes" label={t('quotes.options.notes')} className="span-all"><Input.TextArea rows={4} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        open={loseOpen}
        title={t('quotes.lose.title')}
        okText={t('quotes.actions.lose')}
        okButtonProps={{ danger: true }}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        destroyOnHidden
        onOk={() => loseForm.submit()}
        onCancel={() => setLoseOpen(false)}
      >
        <Form<LoseValues> form={loseForm} layout="vertical" onFinish={(values) => void lose(values)}>
          <Form.Item name="rejectReason" label={t('quotes.lose.reason')} rules={[{ required: true, message: t('quotes.validation.rejectReason') }]}>
            <Select options={DEAL_REJECT_REASONS.map((value) => ({ value, label: t(`deals.reasons.${value}`) }))} />
          </Form.Item>
          <Form.Item name="rejectComment" label={t('quotes.lose.comment')} rules={rejectReason === 'OTHER' ? [{ required: true, whitespace: true, message: t('quotes.validation.rejectComment') }] : []}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={winOpen}
        title={t('quotes.win.title')}
        okText={t('quotes.actions.win')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        destroyOnHidden
        onOk={() => winForm.submit()}
        onCancel={() => setWinOpen(false)}
      >
        <Typography.Paragraph>{t('quotes.win.hint')}</Typography.Paragraph>
        <Form<WinValues> form={winForm} layout="vertical" onFinish={(values) => void win(values)}>
          <Form.Item name="optionId" label={t('quotes.win.option')} rules={[{ required: true, message: t('quotes.validation.winOption') }]}>
            <Select options={quote.quoteOptions.map((option) => ({
              value: option.id,
              label: t('quotes.win.optionLabel', {
                sequence: option.sequence,
                vehicle: option.vehicleType || t('common.dash'),
                cost: formatMoney(option.costRate, option.costRateCurrency),
              }),
            }))} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
