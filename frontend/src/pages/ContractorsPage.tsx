import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
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
import { useAuth } from '../auth/AuthContext';

type ContractorType = 'CLIENT' | 'CARRIER' | 'CUSTOMS_BROKER' | 'WAREHOUSE' | 'SUPPLIER' | 'OTHER';
type PaymentTerm = 'PREPAYMENT' | 'POSTPAYMENT';

interface ContractorContact {
  id?: string;
  fullName: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
}

interface ContractorBankAccount {
  id?: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  notes?: string | null;
}

interface Contractor {
  id: string;
  name: string;
  types: ContractorType[];
  bin: string | null;
  country: string | null;
  legalAddress: string | null;
  paymentTerm: PaymentTerm | null;
  postpaymentDays: number | null;
  notes: string | null;
  isProblem: boolean;
  problemComment: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  deletedAt: string | null;
  contacts: ContractorContact[];
  bankAccounts: ContractorBankAccount[];
}

interface ContractorFormValues {
  name: string;
  types: ContractorType[];
  bin?: string;
  country?: string;
  legalAddress?: string;
  paymentTerm?: PaymentTerm;
  postpaymentDays?: number;
  notes?: string;
  isProblem?: boolean;
  problemComment?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  contacts?: ContractorContact[];
  bankAccounts?: ContractorBankAccount[];
}

interface DuplicateMatch {
  id: string;
  name: string;
  bin: string | null;
}

const CONTRACTOR_TYPES: ContractorType[] = ['CLIENT', 'CARRIER', 'CUSTOMS_BROKER', 'WAREHOUSE', 'SUPPLIER', 'OTHER'];
const CURRENCIES = ['KZT', 'USD', 'RUB', 'CNY', 'EUR'];

export function ContractorsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<ContractorFormValues>();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContractorType>();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [viewing, setViewing] = useState<Contractor | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicateSignature, setDuplicateSignature] = useState<string>();
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const paymentTerm = Form.useWatch('paymentTerm', form);
  const isProblem = Form.useWatch('isProblem', form);
  const isBlacklisted = Form.useWatch('isBlacklisted', form);

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadContractors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (includeDeleted && isAdmin) params.set('includeDeleted', 'true');
      const query = params.toString();
      setContractors(await apiRequest<Contractor[]>(`/contractors${query ? `?${query}` : ''}`));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [includeDeleted, isAdmin, search, showError, typeFilter]);

  useEffect(() => { void loadContractors(); }, [loadContractors]);

  const typeOptions = useMemo(() => CONTRACTOR_TYPES.map((value) => ({
    value,
    label: t(`contractors.types.${value}`),
  })), [t]);

  const resetDuplicateWarning = () => {
    setDuplicates([]);
    setDuplicateSignature(undefined);
  };

  const openCreate = () => {
    setEditing(null);
    resetDuplicateWarning();
    form.resetFields();
    form.setFieldsValue({ types: [], isProblem: false, isBlacklisted: false, contacts: [], bankAccounts: [] });
    setEditorOpen(true);
  };

  const openEdit = (contractor: Contractor) => {
    setEditing(contractor);
    resetDuplicateWarning();
    form.setFieldsValue({
      name: contractor.name,
      types: contractor.types,
      bin: contractor.bin ?? undefined,
      country: contractor.country ?? undefined,
      legalAddress: contractor.legalAddress ?? undefined,
      paymentTerm: contractor.paymentTerm ?? undefined,
      postpaymentDays: contractor.postpaymentDays ?? undefined,
      notes: contractor.notes ?? undefined,
      isProblem: contractor.isProblem,
      problemComment: contractor.problemComment ?? undefined,
      isBlacklisted: contractor.isBlacklisted,
      blacklistReason: contractor.blacklistReason ?? undefined,
      contacts: contractor.contacts.map(({ id: _id, ...item }) => item),
      bankAccounts: contractor.bankAccounts.map(({ id: _id, ...item }) => item),
    });
    setEditorOpen(true);
  };

  const duplicateKey = (name?: string, bin?: string) => `${name?.trim().toLocaleLowerCase() ?? ''}|${bin?.trim() ?? ''}`;

  const checkDuplicates = async (values?: Pick<ContractorFormValues, 'name' | 'bin'>) => {
    const name = values?.name ?? form.getFieldValue('name');
    const bin = values?.bin ?? form.getFieldValue('bin');
    if (!name?.trim() && !bin?.trim()) {
      resetDuplicateWarning();
      return [];
    }
    const params = new URLSearchParams();
    if (name?.trim()) params.set('name', name.trim());
    if (bin?.trim()) params.set('bin', bin.trim());
    if (editing) params.set('excludeId', editing.id);
    try {
      const matches = await apiRequest<DuplicateMatch[]>(`/contractors/duplicates?${params.toString()}`);
      setDuplicates(matches);
      setDuplicateSignature(matches.length ? duplicateKey(name, bin) : undefined);
      return matches;
    } catch (error: unknown) {
      showError(error);
      throw error;
    }
  };

  const saveContractor = async (values: ContractorFormValues) => {
    const signature = duplicateKey(values.name, values.bin);
    if (signature !== duplicateSignature) {
      try {
        const matches = await checkDuplicates(values);
        if (matches.length) return;
      } catch {
        return;
      }
    }
    setSaving(true);
    try {
      await apiRequest(editing ? `/contractors/${editing.id}` : '/contractors', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      });
      void message.success(t(editing ? 'contractors.messages.updated' : 'contractors.messages.created'));
      setEditorOpen(false);
      form.resetFields();
      await loadContractors();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const removeContractor = (contractor: Contractor) => {
    modal.confirm({
      title: t('contractors.confirm.deleteTitle'),
      content: t('contractors.confirm.deleteText', { name: contractor.name }),
      okText: t('contractors.actions.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await apiRequest(`/contractors/${contractor.id}`, { method: 'DELETE' });
          void message.success(t('contractors.messages.deleted'));
          await loadContractors();
        } catch (error: unknown) {
          showError(error);
          throw error;
        }
      },
    });
  };

  const restoreContractor = async (contractor: Contractor) => {
    try {
      await apiRequest(`/contractors/${contractor.id}/restore`, { method: 'PATCH' });
      void message.success(t('contractors.messages.restored'));
      await loadContractors();
    } catch (error: unknown) {
      showError(error);
    }
  };

  const paymentText = (contractor: Contractor) => {
    if (contractor.paymentTerm === 'PREPAYMENT') return t('contractors.payment.PREPAYMENT');
    if (contractor.paymentTerm === 'POSTPAYMENT') return t('contractors.payment.postpaymentDays', { days: contractor.postpaymentDays });
    return t('common.dash');
  };

  const columns: ColumnsType<Contractor> = [
    {
      title: t('contractors.columns.name'), dataIndex: 'name', key: 'name',
      render: (name: string, item) => <Space wrap><Typography.Text strong>{name}</Typography.Text>{item.isBlacklisted && <Tag color="red">{t('contractors.status.blacklisted')}</Tag>}{item.isProblem && <Tag color="orange">{t('contractors.status.problem')}</Tag>}{item.deletedAt && <Tag>{t('contractors.status.deleted')}</Tag>}</Space>,
    },
    { title: t('contractors.columns.types'), dataIndex: 'types', key: 'types', render: (types: ContractorType[]) => types.map((type) => <Tag key={type}>{t(`contractors.types.${type}`)}</Tag>) },
    { title: t('contractors.columns.bin'), dataIndex: 'bin', key: 'bin', render: (value: string | null) => value || t('common.dash') },
    { title: t('contractors.columns.country'), dataIndex: 'country', key: 'country', render: (value: string | null) => value || t('common.dash') },
    { title: t('contractors.columns.payment'), key: 'payment', render: (_, item) => paymentText(item) },
    {
      title: t('contractors.columns.contact'), key: 'contact',
      render: (_, item) => item.contacts[0] ? <Space direction="vertical" size={0}><span>{item.contacts[0].fullName}</span><Typography.Text type="secondary">{item.contacts[0].phone || t('common.dash')}</Typography.Text></Space> : t('common.dash'),
    },
    {
      title: t('contractors.columns.actions'), key: 'actions', width: 290,
      render: (_, item) => item.deletedAt ? (
        isAdmin && <Button size="small" icon={<RedoOutlined />} onClick={() => void restoreContractor(item)}>{t('contractors.actions.restore')}</Button>
      ) : (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(item)}>{t('contractors.actions.open')}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(item)}>{t('contractors.actions.edit')}</Button>
          {isAdmin && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeContractor(item)}>{t('contractors.actions.delete')}</Button>}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div className="page-heading">
        <div><Typography.Title level={2}>{t('contractors.title')}</Typography.Title><Typography.Text type="secondary">{t('contractors.subtitle')}</Typography.Text></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('contractors.add')}</Button>
      </div>
      <div className="contractor-filters">
        <Input.Search allowClear value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('contractors.filters.search')} />
        <Select allowClear value={typeFilter} onChange={setTypeFilter} placeholder={t('contractors.filters.type')} options={typeOptions} />
        {isAdmin && <Space><Switch checked={includeDeleted} onChange={setIncludeDeleted} /><Typography.Text>{t('contractors.filters.includeDeleted')}</Typography.Text></Space>}
      </div>
      <Table rowKey="id" columns={columns} dataSource={contractors} loading={loading} scroll={{ x: 1250 }} rowClassName={(item) => item.deletedAt ? 'inactive-row' : ''} pagination={{ pageSize: 10, showSizeChanger: false }} />

      <Drawer open={Boolean(viewing)} title={viewing?.name} width={720} onClose={() => setViewing(null)}>
        {viewing && <ContractorDetails contractor={viewing} paymentText={paymentText} />}
      </Drawer>

      <Modal open={editorOpen} title={t(editing ? 'contractors.form.editTitle' : 'contractors.form.createTitle')} width={1000} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => form.submit()} onCancel={() => setEditorOpen(false)} destroyOnHidden styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}>
        <Form<ContractorFormValues> form={form} layout="vertical" requiredMark={false} onFinish={saveContractor} onValuesChange={(changed) => { if ('name' in changed || 'bin' in changed) resetDuplicateWarning(); }}>
          {duplicates.length > 0 && <Alert className="form-alert" type="warning" showIcon message={t('contractors.duplicates.title')} description={<ul>{duplicates.map((item) => <li key={item.id}>{t('contractors.duplicates.item', { name: item.name, bin: item.bin || t('common.notSpecified') })}</li>)}</ul>} />}
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="name" label={t('contractors.form.name')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.name') }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="types" label={t('contractors.form.types')} rules={[{ required: true, type: 'array', min: 1, message: t('contractors.validation.types') }]}><Select mode="multiple" options={typeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="bin" label={t('contractors.form.bin')}><Input onBlur={() => void checkDuplicates()} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="country" label={t('contractors.form.country')}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="legalAddress" label={t('contractors.form.legalAddress')}><Input /></Form.Item></Col>
            <Col xs={24} md={paymentTerm === 'POSTPAYMENT' ? 12 : 24}><Form.Item name="paymentTerm" label={t('contractors.form.paymentTerm')}><Select allowClear onChange={(value: PaymentTerm | undefined) => { if (value !== 'POSTPAYMENT') form.setFieldValue('postpaymentDays', undefined); }} options={[{ value: 'PREPAYMENT', label: t('contractors.payment.PREPAYMENT') }, { value: 'POSTPAYMENT', label: t('contractors.payment.POSTPAYMENT') }]} /></Form.Item></Col>
            {paymentTerm === 'POSTPAYMENT' && <Col xs={24} md={12}><Form.Item name="postpaymentDays" label={t('contractors.form.postpaymentDays')} rules={[{ required: true, message: t('contractors.validation.postpaymentDays') }, { type: 'number', min: 1, message: t('contractors.validation.postpaymentDays') }]}><InputNumber min={1} precision={0} className="full-width" /></Form.Item></Col>}
          </Row>
          <Form.Item name="notes" label={t('contractors.form.notes')}><Input.TextArea rows={3} /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="isProblem" label={t('contractors.form.problem')} valuePropName="checked"><Switch /></Form.Item>{isProblem && <Form.Item name="problemComment" label={t('contractors.form.problemComment')}><Input.TextArea rows={2} /></Form.Item>}</Col>
            <Col xs={24} md={12}><Form.Item name="isBlacklisted" label={t('contractors.form.blacklisted')} valuePropName="checked"><Switch /></Form.Item>{isBlacklisted && <Form.Item name="blacklistReason" label={t('contractors.form.blacklistReason')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.blacklistReason') }]}><Input.TextArea rows={2} /></Form.Item>}</Col>
          </Row>
          <Divider orientation="left">{t('contractors.form.contacts')}</Divider>
          <Form.List name="contacts">{(fields, { add, remove }) => <>{fields.map((field) => <Card size="small" className="nested-form-card" key={field.key} extra={<Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} /> }><Row gutter={12}><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'fullName']} label={t('contractors.form.contactFullName')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.contactName') }]}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'position']} label={t('contractors.form.position')}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'phone']} label={t('contractors.form.phone')}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item {...field} name={[field.name, 'email']} label={t('contractors.form.email')} rules={[{ type: 'email', message: t('contractors.validation.email') }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item {...field} name={[field.name, 'whatsapp']} label={t('contractors.form.whatsapp')}><Input /></Form.Item></Col></Row></Card>)}<Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>{t('contractors.form.addContact')}</Button></>}</Form.List>
          <Divider orientation="left">{t('contractors.form.bankAccounts')}</Divider>
          <Form.List name="bankAccounts">{(fields, { add, remove }) => <>{fields.map((field) => <Card size="small" className="nested-form-card" key={field.key} extra={<Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />}><Row gutter={12}><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'bankName']} label={t('contractors.form.bankName')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.bankName') }]}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'accountNumber']} label={t('contractors.form.accountNumber')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.accountNumber') }]}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'currency']} label={t('contractors.form.currency')} rules={[{ required: true, message: t('contractors.validation.currency') }]}><Select options={CURRENCIES.map((value) => ({ value, label: value }))} /></Form.Item></Col><Col span={24}><Form.Item {...field} name={[field.name, 'notes']} label={t('contractors.form.accountNotes')}><Input /></Form.Item></Col></Row></Card>)}<Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>{t('contractors.form.addAccount')}</Button></>}</Form.List>
        </Form>
      </Modal>
    </Card>
  );
}

function ContractorDetails({ contractor, paymentText }: { contractor: Contractor; paymentText: (item: Contractor) => string }) {
  const { t } = useTranslation();
  return <Space direction="vertical" size="large" className="full-width">
    {contractor.isBlacklisted && <Alert type="error" showIcon message={t('contractors.details.blacklisted')} description={contractor.blacklistReason} />}
    {contractor.isProblem && <Alert type="warning" showIcon message={t('contractors.details.problem')} description={contractor.problemComment || t('common.notSpecified')} />}
    <Descriptions bordered column={1} size="small" title={t('contractors.details.requisites')}>
      <Descriptions.Item label={t('contractors.form.types')}>{contractor.types.map((type) => <Tag key={type}>{t(`contractors.types.${type}`)}</Tag>)}</Descriptions.Item>
      <Descriptions.Item label={t('contractors.form.bin')}>{contractor.bin || t('common.dash')}</Descriptions.Item>
      <Descriptions.Item label={t('contractors.form.country')}>{contractor.country || t('common.dash')}</Descriptions.Item>
      <Descriptions.Item label={t('contractors.form.legalAddress')}>{contractor.legalAddress || t('common.dash')}</Descriptions.Item>
      <Descriptions.Item label={t('contractors.form.paymentTerm')}>{paymentText(contractor)}</Descriptions.Item>
      <Descriptions.Item label={t('contractors.form.notes')}>{contractor.notes || t('common.dash')}</Descriptions.Item>
    </Descriptions>
    <List header={<Typography.Title level={5}>{t('contractors.details.contacts')}</Typography.Title>} bordered dataSource={contractor.contacts} locale={{ emptyText: t('contractors.details.noContacts') }} renderItem={(item) => <List.Item><List.Item.Meta title={item.fullName} description={[item.position, item.phone, item.email, item.whatsapp && t('contractors.details.whatsappValue', { value: item.whatsapp })].filter(Boolean).join(' · ')} /></List.Item>} />
    <List header={<Typography.Title level={5}>{t('contractors.details.accounts')}</Typography.Title>} bordered dataSource={contractor.bankAccounts} locale={{ emptyText: t('contractors.details.noAccounts') }} renderItem={(item) => <List.Item><List.Item.Meta title={t('contractors.details.accountTitle', { bank: item.bankName, currency: item.currency })} description={[item.accountNumber, item.notes].filter(Boolean).join(' · ')} /></List.Item>} />
  </Space>;
}
