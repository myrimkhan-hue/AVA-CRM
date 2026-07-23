import { CheckCircleFilled } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Collapse, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Steps, Typography } from 'antd';
import { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MoneyInput } from '../components/MoneyInput';
import { compact, CURRENCIES, errorText, MODES, TransportMode } from '../transportations/shared';

interface Deal { id: string; number: string; client: { name: string }; legalEntity: { name: string }; responsible: { fullName: string } }
interface Ref { id: string; name?: string; fullName?: string; isActive?: boolean }
interface Values {
  dealId?: string; logistId?: string; plannedDeliveryDate?: Dayjs; cargoName?: string; placesCount?: number; placesUnit?: string;
  weightKg?: number; volumeM3?: number; cargoValue?: number; cargoValueCurrency?: string; transportMode: TransportMode;
  isDangerous?: boolean; isTempControlled?: boolean; shipperName?: string; consigneeName?: string; accompanyingDocs?: string[];
  originPoint?: string; destinationPoint?: string; loadingAddress?: string; loadingContactName?: string;
  loadingContactPhone?: string; unloadingAddress?: string; unloadingContactName?: string; unloadingContactPhone?: string; bodyType?: string;
  specialConditions?: string; clientRate?: number; clientRateCurrency?: string; subcontractorId?: string; subcontractorRate?: number;
  subcontractorRateCurrency?: string; plannedStartDate?: Dayjs; vehicleNumber?: string; trailerNumber?: string;
  driverFullName?: string; driverPhone?: string; driverIin?: string; driverLicenseNumber?: string; driverLicenseDate?: Dayjs; driverLicenseIssuer?: string;
}

const date = (value?: Dayjs) => value?.format('YYYY-MM-DD');

export function NewTransportationPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<Values>();
  const [step, setStep] = useState(0);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealUnavailable, setDealUnavailable] = useState(false);
  const [users, setUsers] = useState<Ref[]>([]);
  const [carriers, setCarriers] = useState<Ref[]>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: string }>();
  const values = Form.useWatch([], form) ?? form.getFieldsValue();
  const selectedDeal = deals.find((item) => item.id === values.dealId);
  const canSeeClientRate = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role)));
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  const showError = useCallback((error: unknown) => void message.error(errorText(error, t('errors.connection'))), [message, t]);
  useEffect(() => {
    apiRequest<Deal[]>('/deals').then((items) => { setDeals(items); setDealUnavailable(items.length === 0); }).catch((error) => {
      if (error instanceof ApiError && error.status === 403) setDealUnavailable(true); else showError(error);
    });
    if (isAdmin) apiRequest<Ref[]>('/users').then((items) => setUsers(items.filter((item) => item.isActive !== false))).catch(showError);
  }, [isAdmin, showError]);

  const findCarriers = async (search = '') => {
    try {
      const params = new URLSearchParams({ type: 'CARRIER' });
      if (search) params.set('search', search);
      setCarriers(await apiRequest<Ref[]>(`/contractors?${params}`));
    } catch (error) { showError(error); }
  };

  const next = async () => {
    const fields: (keyof Values)[] = step === 0 ? ['dealId'] : step === 2 ? ['originPoint', 'destinationPoint'] : [];
    try { await form.validateFields(fields); setStep((current) => current + 1); } catch { /* Ant Form highlights fields. */ }
  };

  const submit = async () => {
    const raw = await form.validateFields();
    const initialLeg = compact({
      fromPoint: raw.originPoint, toPoint: raw.destinationPoint, mode: raw.transportMode === 'MULTIMODAL' ? 'AUTO' : raw.transportMode,
      subcontractorId: raw.subcontractorId, subcontractorRate: raw.subcontractorRate, subcontractorRateCurrency: raw.subcontractorRateCurrency,
      plannedStartDate: date(raw.plannedStartDate), vehicleNumber: raw.vehicleNumber, trailerNumber: raw.trailerNumber,
      driverFullName: raw.driverFullName, driverPhone: raw.driverPhone, driverIin: raw.driverIin, driverLicenseNumber: raw.driverLicenseNumber,
      driverLicenseDate: date(raw.driverLicenseDate), driverLicenseIssuer: raw.driverLicenseIssuer,
    });
    const payload = compact({ ...raw, plannedDeliveryDate: date(raw.plannedDeliveryDate),
      plannedStartDate: undefined, driverLicenseDate: undefined, initialLeg });
    ['subcontractorId','subcontractorRate','subcontractorRateCurrency','vehicleNumber','trailerNumber','driverFullName','driverPhone','driverIin','driverLicenseNumber','driverLicenseIssuer'].forEach((key) => delete (payload as Record<string, unknown>)[key]);
    setSaving(true);
    try { setCreated(await apiRequest('/transportations', { method: 'POST', body: JSON.stringify(payload) })); }
    catch (error) { showError(error); } finally { setSaving(false); }
  };

  const money = (name: keyof Values, currency: keyof Values, initial = 'KZT') => <Space.Compact block><Form.Item name={name} noStyle><MoneyInput min={0} className="money-number" /></Form.Item><Form.Item name={currency} noStyle initialValue={initial}><Select className="currency-select" options={CURRENCIES.map((value) => ({ value }))} /></Form.Item></Space.Compact>;
  const field = (name: keyof Values, label: string, node = <Input />) => <Form.Item name={name} label={label}>{node}</Form.Item>;
  const summary = useMemo(() => [
    [t('transportationWizard.fields.deal'), selectedDeal?.number], [t('transportationWizard.fields.client'), selectedDeal?.client.name],
    [t('transportationWizard.fields.legalEntity'), selectedDeal?.legalEntity.name], [t('transportationWizard.fields.transportMode'), t(`transportations.transportModes.${values.transportMode ?? 'AUTO'}`)],
    [t('transportationWizard.fields.plannedDelivery'), date(values.plannedDeliveryDate)], [t('transportationWizard.fields.logist'), users.find((item) => item.id === values.logistId)?.fullName ?? user?.fullName],
    [t('transportationWizard.fields.route'), values.originPoint && values.destinationPoint ? `${values.originPoint} → ${values.destinationPoint}` : undefined],
    ...(canSeeClientRate ? [[t('transportationWizard.fields.clientRate'), values.clientRate ? `${values.clientRate} ${values.clientRateCurrency}` : undefined]] : []),
    [t('transportationWizard.fields.subcontractorRate'), values.subcontractorRate ? `${values.subcontractorRate} ${values.subcontractorRateCurrency}` : undefined],
  ], [canSeeClientRate, selectedDeal, t, user, users, values]);

  return <section className="transportation-workspace wizard-page">
    <Typography.Link onClick={() => navigate('/transportations')}>{t('transportationWizard.back')}</Typography.Link>
    <Typography.Title level={2}>{t('transportationWizard.title')}</Typography.Title>
    <Steps current={step} items={['deal','cargo','route','review'].map((key) => ({ title: t(`transportationWizard.steps.${key}`) }))} />
    <Card className="transport-card wizard-card">
      <Form form={form} layout="vertical" initialValues={{ transportMode: 'AUTO', placesUnit: 'паллеты', cargoValueCurrency: 'USD', clientRateCurrency: 'USD', subcontractorRateCurrency: 'KZT', isDangerous: false, isTempControlled: false }}>
        <div style={{ display: step === 0 ? undefined : 'none' }}><Typography.Title level={4}>{t('transportationWizard.sections.deal')}</Typography.Title>
          {dealUnavailable && <Alert className="form-alert" type="warning" showIcon message={t('transportationWizard.dealsUnavailable')} description={t('transportationWizard.askManager')} />}
          <div className="form-grid two"><Form.Item name="dealId" label={t('transportationWizard.fields.deal')} rules={[{ required: true, message: t('transportationWizard.validation.deal') }]}><Select showSearch disabled={dealUnavailable} optionFilterProp="label" placeholder={t('transportationWizard.dealPlaceholder')} options={deals.map((deal) => ({ value: deal.id, label: `${deal.number} · ${deal.client.name}` }))} /></Form.Item>
          <Form.Item label={t('transportationWizard.fields.client')}><Input disabled value={selectedDeal?.client.name} /></Form.Item>
          <Form.Item label={t('transportationWizard.fields.legalEntity')}><Input disabled value={selectedDeal?.legalEntity.name} /></Form.Item>
          {isAdmin && <Form.Item name="logistId" label={t('transportationWizard.fields.logist')}><Select allowClear options={users.map((item) => ({ value: item.id, label: item.fullName }))} /></Form.Item>}
          {field('plannedDeliveryDate', t('transportationWizard.fields.plannedDelivery'), <DatePicker className="full-width" />)}</div></div>
        <div style={{ display: step === 1 ? undefined : 'none' }}><Typography.Title level={4}>{t('transportationWizard.sections.cargo')}</Typography.Title><div className="form-grid three">
          {field('cargoName', t('transportationWizard.fields.cargoName'))}<Form.Item label={t('transportationWizard.fields.places')}><Space.Compact block><Form.Item name="placesCount" noStyle><InputNumber min={1} /></Form.Item><Form.Item name="placesUnit" noStyle><Select options={['паллеты','коробки','ролики','биг-бэги','места'].map((value) => ({ value, label: t(`transportationWizard.units.${value}`) }))} /></Form.Item></Space.Compact></Form.Item>
          {field('weightKg', t('transportationWizard.fields.weight'), <InputNumber min={0} className="full-width" />)}{field('volumeM3', t('transportationWizard.fields.volume'), <InputNumber min={0} className="full-width" />)}
          <Form.Item label={t('transportationWizard.fields.cargoValue')}>{money('cargoValue','cargoValueCurrency','USD')}</Form.Item><Form.Item name="transportMode" label={t('transportationWizard.fields.transportMode')}><Select options={MODES.map((value) => ({ value, label: t(`transportations.transportModes.${value}`) }))} /></Form.Item></div>
          <Space wrap><Form.Item name="isDangerous" valuePropName="checked"><Checkbox>{t('transportationWizard.fields.dangerous')}</Checkbox></Form.Item><Form.Item name="isTempControlled" valuePropName="checked"><Checkbox>{t('transportationWizard.fields.temperature')}</Checkbox></Form.Item></Space>
          <div className="form-grid two">{field('shipperName', t('transportationWizard.fields.shipper'))}{field('consigneeName', t('transportationWizard.fields.consignee'))}<Form.Item name="accompanyingDocs" label={t('transportationWizard.fields.docs')} className="span-all"><Select mode="tags" options={['CMR','СНТ','ТТН','Доверенность','ЭСФ'].map((value) => ({ value, label: value }))} tokenSeparators={[',']} placeholder={t('transportationWizard.customDoc')} /></Form.Item></div></div>
        <div style={{ display: step === 2 ? undefined : 'none' }}><Typography.Title level={4}>{t('transportationWizard.sections.route')}</Typography.Title><div className="form-grid two">
          <Form.Item name="originPoint" label={t('transportationWizard.fields.origin')} rules={[{ required: true, message: t('transportationWizard.validation.origin') }]}><Input /></Form.Item><Form.Item name="destinationPoint" label={t('transportationWizard.fields.destination')} rules={[{ required: true, message: t('transportationWizard.validation.destination') }]}><Input /></Form.Item></div>
          <Collapse className="optional-collapse" items={[{ key: 'details', label: t('transportationWizard.sections.addresses'), children: <div className="form-grid two">{field('loadingAddress', t('transportationWizard.fields.loadingAddress'))}{field('loadingContactName', t('transportationWizard.fields.loadingContact'))}{field('loadingContactPhone', t('transportationWizard.fields.loadingPhone'))}{field('unloadingAddress', t('transportationWizard.fields.unloadingAddress'))}{field('unloadingContactName', t('transportationWizard.fields.unloadingContact'))}{field('unloadingContactPhone', t('transportationWizard.fields.unloadingPhone'))}<Form.Item name="bodyType" label={t('transportationWizard.fields.bodyType')}><Select options={['TENT','REFRIGERATOR','CONTAINER','OPEN_PLATFORM','ISOTHERM'].map((value) => ({ value: t(`transportationWizard.bodyTypes.${value}`), label: t(`transportationWizard.bodyTypes.${value}`) }))} /></Form.Item>{field('specialConditions', t('transportationWizard.fields.specialConditions'), <Input.TextArea />)}</div> }]} />
          {canSeeClientRate && <Card size="small" title={t('transportationWizard.sections.client')}><Form.Item label={t('transportationWizard.fields.clientRate')}>{money('clientRate','clientRateCurrency','USD')}</Form.Item></Card>}
          <Card size="small" title={t('transportationWizard.sections.carrier')}><div className="form-grid two"><Form.Item name="subcontractorId" label={t('transportationWizard.fields.carrier')}><Select showSearch filterOption={false} onFocus={() => void findCarriers()} onSearch={(value) => void findCarriers(value)} options={carriers.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><Form.Item label={t('transportationWizard.fields.subcontractorRate')}>{money('subcontractorRate','subcontractorRateCurrency')}</Form.Item>{field('plannedStartDate', t('transportationWizard.fields.plannedPickup'), <DatePicker className="full-width" />)}{field('vehicleNumber', t('transportationWizard.fields.vehicle'))}{field('trailerNumber', t('transportationWizard.fields.trailer'))}</div>
          <Typography.Title level={5}>{t('transportationWizard.sections.driver')}</Typography.Title><div className="form-grid three">{field('driverFullName', t('transportationWizard.fields.driverName'))}{field('driverPhone', t('transportationWizard.fields.driverPhone'))}{field('driverIin', t('transportationWizard.fields.iin'))}{field('driverLicenseNumber', t('transportationWizard.fields.license'))}{field('driverLicenseDate', t('transportationWizard.fields.licenseDate'), <DatePicker className="full-width" />)}{field('driverLicenseIssuer', t('transportationWizard.fields.licenseIssuer'))}</div></Card></div>
        {step === 3 && <><Typography.Title level={4}>{t('transportationWizard.sections.review')}</Typography.Title><div className="summary-grid">{summary.map(([label, value]) => <Card size="small" key={label}><Typography.Text type="secondary">{label}</Typography.Text><div>{value || t('common.dash')}</div></Card>)}</div></>}
      </Form>
      <div className="wizard-actions"><Button disabled={step === 0} onClick={() => setStep((value) => value - 1)}>{t('transportationWizard.actions.back')}</Button>{step < 3 ? <Button type="primary" disabled={step === 0 && dealUnavailable} onClick={() => void next()}>{t('transportationWizard.actions.next')}</Button> : <Button className="create-green" loading={saving} onClick={() => void submit()}>{t('transportationWizard.actions.create')}</Button>}</div>
    </Card>
    <Modal open={Boolean(created)} footer={null} closable={false} centered><div className="success-modal"><CheckCircleFilled /><Typography.Title level={3}>{t('transportationWizard.success.title')}</Typography.Title><Typography.Text>{t('transportationWizard.success.number', { number: created?.number })}</Typography.Text><Space><Button onClick={() => navigate('/transportations')}>{t('transportationWizard.success.list')}</Button><Button type="primary" onClick={() => navigate(`/transportations/${created?.id}`)}>{t('transportationWizard.success.open')}</Button></Space></div></Modal>
  </section>;
}
