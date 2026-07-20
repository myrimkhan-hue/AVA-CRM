import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Row,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CURRENCIES, STATUS_COLORS, type TransportationStatus } from '../transportations/shared';

type ContractorType = 'CLIENT' | 'CARRIER' | 'CUSTOMS_BROKER' | 'WAREHOUSE' | 'SUPPLIER' | 'OTHER';
type PaymentTerm = 'PREPAYMENT' | 'POSTPAYMENT';
type ViewMode = 'cards' | 'table';
type TypeFilter = ContractorType | 'ALL';

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

interface ContractorTransportation {
  id: string;
  number: string;
  originPoint: string;
  destinationPoint: string;
  status: TransportationStatus;
  role: { isClient: boolean; legOrderIndexes: number[] };
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

interface DuplicateMatch { id: string; name: string; bin: string | null }

const CONTRACTOR_TYPES: ContractorType[] = ['CLIENT', 'CARRIER', 'CUSTOMS_BROKER', 'WAREHOUSE', 'SUPPLIER', 'OTHER'];
const COLUMN_KEYS = ['name', 'types', 'bin', 'country', 'payment', 'contact', 'status', 'actions'] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
interface ColumnSetting { key: ColumnKey; visible: boolean }
interface SettingsResponse { columns: unknown }

const DEFAULT_HIDDEN = new Set<ColumnKey>(['country', 'status']);
const DEFAULT_SETTINGS: ColumnSetting[] = COLUMN_KEYS.map((key) => ({
  key,
  visible: key === 'name' || !DEFAULT_HIDDEN.has(key),
}));

function normalizeSettings(value: unknown): ColumnSetting[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS;
  const seen = new Set<ColumnKey>();
  const normalized: ColumnSetting[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { key?: unknown; visible?: unknown };
    if (!COLUMN_KEYS.includes(candidate.key as ColumnKey) || seen.has(candidate.key as ColumnKey)) continue;
    const key = candidate.key as ColumnKey;
    seen.add(key);
    normalized.push({ key, visible: key === 'name' ? true : candidate.visible === true });
  }
  for (const item of DEFAULT_SETTINGS) {
    if (!seen.has(item.key)) normalized.push(item);
  }
  return normalized;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase();
}

export function ContractorsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<ContractorFormValues>();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedId, setSelectedId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicateSignature, setDuplicateSignature] = useState<string>();
  const [related, setRelated] = useState<ContractorTransportation[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [flagKind, setFlagKind] = useState<'problem' | 'blacklist'>();
  const [flagReason, setFlagReason] = useState('');
  const [flagSaving, setFlagSaving] = useState(false);
  const [settings, setSettings] = useState<ColumnSetting[]>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<ColumnKey>();
  const lastSavedSettings = useRef('');
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
      if (includeDeleted && isAdmin) params.set('includeDeleted', 'true');
      const query = params.toString();
      setContractors(await apiRequest<Contractor[]>(`/contractors${query ? `?${query}` : ''}`));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [includeDeleted, isAdmin, search, showError]);

  useEffect(() => { void loadContractors(); }, [loadContractors]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const saved = await apiRequest<SettingsResponse | null>('/me/table-settings/contractors');
        if (!active) return;
        const nextSettings = normalizeSettings(saved?.columns);
        setSettings(nextSettings);
        lastSavedSettings.current = JSON.stringify(nextSettings);
      } catch (error: unknown) {
        if (active) showError(error);
      } finally {
        if (active) setSettingsLoaded(true);
      }
    };
    void loadSettings();
    return () => { active = false; };
  }, [showError]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const signature = JSON.stringify(settings);
    if (signature === lastSavedSettings.current) return;
    const timer = window.setTimeout(async () => {
      try {
        await apiRequest<SettingsResponse>('/me/table-settings/contractors', {
          method: 'PUT',
          body: JSON.stringify({ columns: settings }),
        });
        lastSavedSettings.current = signature;
      } catch (error: unknown) {
        showError(error);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [settings, settingsLoaded, showError]);

  const filteredContractors = useMemo(() => contractors.filter(
    (item) => typeFilter === 'ALL' || item.types.includes(typeFilter),
  ), [contractors, typeFilter]);

  useEffect(() => {
    if (!filteredContractors.some((item) => item.id === selectedId)) {
      setSelectedId(filteredContractors[0]?.id);
    }
  }, [filteredContractors, selectedId]);

  const selected = contractors.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selectedId) {
      setRelated([]);
      return;
    }
    let active = true;
    setRelatedLoading(true);
    apiRequest<ContractorTransportation[]>(`/contractors/${selectedId}/transportations`)
      .then((rows) => { if (active) setRelated(rows); })
      .catch((error: unknown) => { if (active) showError(error); })
      .finally(() => { if (active) setRelatedLoading(false); });
    return () => { active = false; };
  }, [selectedId, showError]);

  const typeOptions = useMemo(() => CONTRACTOR_TYPES.map((value) => ({
    value,
    label: t(`contractors.types.${value}`),
  })), [t]);

  const typeCounts = useMemo(() => Object.fromEntries([
    ['ALL', contractors.length],
    ...CONTRACTOR_TYPES.map((type) => [type, contractors.filter((item) => item.types.includes(type)).length]),
  ]) as Record<TypeFilter, number>, [contractors]);

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
    form.resetFields();
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
      const saved = await apiRequest<Contractor>(editing ? `/contractors/${editing.id}` : '/contractors', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      });
      void message.success(t(editing ? 'contractors.messages.updated' : 'contractors.messages.created'));
      setEditorOpen(false);
      form.resetFields();
      setSelectedId(saved.id);
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

  const paymentText = useCallback((contractor: Contractor) => {
    if (contractor.paymentTerm === 'PREPAYMENT') return t('contractors.payment.PREPAYMENT');
    if (contractor.paymentTerm === 'POSTPAYMENT') return t('contractors.payment.postpaymentDays', { days: contractor.postpaymentDays });
    return t('common.dash');
  }, [t]);

  const openFlagEditor = (kind: 'problem' | 'blacklist') => {
    if (!selected) return;
    const enabled = kind === 'problem' ? selected.isProblem : selected.isBlacklisted;
    if (enabled) {
      const body = kind === 'problem'
        ? { isProblem: false, problemComment: '' }
        : { isBlacklisted: false, blacklistReason: '' };
      void updateSelected(body, kind === 'problem' ? 'contractors.messages.problemRemoved' : 'contractors.messages.blacklistRemoved');
      return;
    }
    setFlagKind(kind);
    setFlagReason('');
  };

  const updateSelected = async (body: Partial<ContractorFormValues>, messageKey: string) => {
    if (!selected) return;
    setFlagSaving(true);
    try {
      const updated = await apiRequest<Contractor>(`/contractors/${selected.id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      });
      setContractors((current) => current.map((item) => item.id === updated.id ? updated : item));
      void message.success(t(messageKey));
      setFlagKind(undefined);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setFlagSaving(false);
    }
  };

  const saveFlag = () => {
    if (!flagKind || !flagReason.trim()) return;
    const body = flagKind === 'problem'
      ? { isProblem: true, problemComment: flagReason.trim() }
      : { isBlacklisted: true, blacklistReason: flagReason.trim() };
    void updateSelected(body, flagKind === 'problem' ? 'contractors.messages.problemAdded' : 'contractors.messages.blacklistAdded');
  };

  const typeChips = <div className="contractor-type-chips" role="group" aria-label={t('contractors.filters.type')}>
    {(['ALL', ...CONTRACTOR_TYPES] as TypeFilter[]).map((value) => (
      <button key={value} className={`contractor-type-chip${typeFilter === value ? ' active' : ''}`} onClick={() => setTypeFilter(value)}>
        {typeFilter === value && <CheckOutlined />}
        {t(value === 'ALL' ? 'contractors.types.ALL' : `contractors.types.${value}`)} <strong>{typeCounts[value]}</strong>
      </button>
    ))}
  </div>;

  const allColumns = useMemo<Record<ColumnKey, ColumnsType<Contractor>[number]>>(() => ({
    name: {
      title: t('contractors.columns.name'), key: 'name', fixed: 'left', width: 250,
      render: (_, item) => <div><Typography.Text strong>{item.name}</Typography.Text><div className="table-cell-secondary">{item.bin || t('common.dash')}</div></div>,
    },
    types: { title: t('contractors.columns.types'), key: 'types', width: 235, render: (_, item) => item.types.map((type) => <Tag bordered={false} className="contractor-type-tag" key={type}>{t(`contractors.types.${type}`)}</Tag>) },
    bin: { title: t('contractors.columns.bin'), dataIndex: 'bin', key: 'bin', width: 150, render: (value: string | null) => value || t('common.dash') },
    country: { title: t('contractors.columns.country'), dataIndex: 'country', key: 'country', width: 150, render: (value: string | null) => value || t('common.dash') },
    payment: { title: t('contractors.columns.payment'), key: 'payment', width: 180, render: (_, item) => paymentText(item) },
    contact: {
      title: t('contractors.columns.contact'), key: 'contact', width: 220,
      render: (_, item) => <div>{item.contacts[0]?.fullName || t('common.dash')}<div className="table-cell-secondary">{item.contacts[0]?.phone || item.contacts[0]?.email || t('common.dash')}</div></div>,
    },
    status: {
      title: t('contractors.columns.status'), key: 'status', width: 190,
      render: (_, item) => <div className="contractor-status-tags">{item.isProblem && <Tag color="error">{t('contractors.status.problem')}</Tag>}{item.isBlacklisted && <Tag color="error">{t('contractors.status.blacklisted')}</Tag>}{item.deletedAt && <Tag>{t('contractors.status.deleted')}</Tag>}{!item.isProblem && !item.isBlacklisted && !item.deletedAt && <Tag bordered={false}>{t('contractors.status.active')}</Tag>}</div>,
    },
    actions: {
      title: t('contractors.columns.actions'), key: 'actions', width: 220,
      render: (_, item) => <div className="contractor-row-actions" onClick={(event) => event.stopPropagation()}>
        {item.deletedAt ? isAdmin && <Button size="small" icon={<RedoOutlined />} onClick={() => void restoreContractor(item)}>{t('contractors.actions.restore')}</Button> : <>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(item)}>{t('contractors.actions.edit')}</Button>
          {isAdmin && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeContractor(item)}>{t('contractors.actions.delete')}</Button>}
        </>}
      </div>,
    },
  }), [isAdmin, paymentText, t]);

  const columns = useMemo(() => settings.filter((item) => item.visible).map((item) => allColumns[item.key]), [allColumns, settings]);

  const moveSetting = (targetKey: ColumnKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setSettings((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((item) => item.key === draggedKey);
      const targetIndex = next.findIndex((item) => item.key === targetKey);
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const settingsContent = <div className="column-settings-panel">
    <div className="column-settings-title">{t('contractors.settings.title')}</div>
    <div className="column-settings-list">
      {settings.map((item) => <div
        key={item.key}
        draggable
        className={`column-setting${draggedKey === item.key ? ' dragging' : ''}`}
        onDragStart={() => setDraggedKey(item.key)}
        onDragOver={(event) => { event.preventDefault(); moveSetting(item.key); }}
        onDragEnd={() => setDraggedKey(undefined)}
      >
        <HolderOutlined className="column-drag-handle" />
        <Checkbox checked={item.visible} disabled={item.key === 'name'} onChange={(event) => setSettings((current) => current.map((column) => column.key === item.key ? { ...column, visible: event.target.checked } : column))} />
        <span>{t(`contractors.columns.${item.key}`)}</span>
      </div>)}
    </div>
    <Button type="text" danger block className="column-settings-reset" onClick={() => setSettings(DEFAULT_SETTINGS)}>{t('contractors.settings.reset')}</Button>
    <div className="column-settings-help">{t('contractors.settings.help')}</div>
  </div>;

  return <>
    <section className="contractors-page">
      <div className="contractors-heading">
        <div className="contractors-title-row">
          <Typography.Title level={2}>{t('contractors.title')}</Typography.Title>
          <div className="contractor-view-switch">
            {(['cards', 'table'] as ViewMode[]).map((mode) => <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode)}>{t(`contractors.views.${mode}`)}</button>)}
          </div>
        </div>
        <div className="contractors-heading-actions">
          {viewMode === 'table' && <Popover trigger="click" placement="bottomRight" open={settingsOpen} onOpenChange={setSettingsOpen} content={settingsContent}>
            <Button icon={<SettingOutlined />}>{t('contractors.settings.button')}</Button>
          </Popover>}
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('contractors.add')}</Button>
        </div>
      </div>

      {viewMode === 'table' ? <>
        <div className="contractors-table-filters">
          <Input.Search allowClear value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('contractors.filters.search')} />
          {typeChips}
          {isAdmin && <label className="contractor-deleted-filter"><Switch size="small" checked={includeDeleted} onChange={setIncludeDeleted} /><span>{t('contractors.filters.includeDeleted')}</span></label>}
        </div>
        <Table<Contractor>
          className="contractors-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredContractors}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('contractors.footer.shown', { total }) }}
          locale={{ emptyText: t('contractors.empty') }}
          rowClassName={(item) => item.deletedAt ? 'inactive-row' : ''}
          onRow={(item) => ({ onClick: () => { setSelectedId(item.id); setViewMode('cards'); } })}
        />
        <div className="contractors-footer">{t('contractors.footer.summary', { shown: filteredContractors.length, total: contractors.length })}</div>
      </> : <div className="contractor-cards-layout">
        <Card className="contractor-list-card" styles={{ body: { padding: 0 } }}>
          <div className="contractor-list-filters">
            <Input.Search allowClear value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('contractors.filters.search')} />
            {typeChips}
            {isAdmin && <label className="contractor-deleted-filter"><Switch size="small" checked={includeDeleted} onChange={setIncludeDeleted} /><span>{t('contractors.filters.includeDeleted')}</span></label>}
          </div>
          <div className="contractor-list">
            {loading ? <Spin className="contractor-list-spin" /> : filteredContractors.length ? filteredContractors.map((item) => <button
              key={item.id}
              className={`contractor-list-item${selectedId === item.id ? ' active' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="contractor-avatar">{initials(item.name)}</span>
              <span className="contractor-list-copy">
                <span className="contractor-list-name">{item.name}{item.isProblem && <em>{t('contractors.status.problem')}</em>}{item.isBlacklisted && <em>{t('contractors.status.blacklisted')}</em>}</span>
                <span>{item.types.map((type) => t(`contractors.types.${type}`)).join(', ')} · {item.bin || t('common.notSpecified')}</span>
              </span>
            </button>) : <Empty className="contractor-list-empty" description={t('contractors.empty')} />}
          </div>
        </Card>
        <div className="contractor-detail-stack">
          {selected ? <ContractorDetails
            contractor={selected}
            related={related}
            relatedLoading={relatedLoading}
            paymentText={paymentText}
            onEdit={() => openEdit(selected)}
            onDelete={() => removeContractor(selected)}
            onRestore={() => void restoreContractor(selected)}
            onToggleFlag={openFlagEditor}
            onTransportation={(id) => navigate(`/transportations/${id}`)}
            isAdmin={isAdmin}
          /> : <Card className="contractor-detail-card"><Empty description={t('contractors.details.select')} /></Card>}
        </div>
      </div>}
    </section>

    <Modal open={Boolean(flagKind)} title={t(flagKind === 'blacklist' ? 'contractors.flags.blacklistTitle' : 'contractors.flags.problemTitle')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={flagSaving} okButtonProps={{ disabled: !flagReason.trim() }} onOk={saveFlag} onCancel={() => setFlagKind(undefined)} destroyOnHidden>
      <Typography.Paragraph type="secondary">{t(flagKind === 'blacklist' ? 'contractors.flags.blacklistHelp' : 'contractors.flags.problemHelp')}</Typography.Paragraph>
      <Input.TextArea rows={4} value={flagReason} onChange={(event) => setFlagReason(event.target.value)} placeholder={t('contractors.flags.reasonPlaceholder')} />
    </Modal>

    <Modal open={editorOpen} title={t(editing ? 'contractors.form.editTitle' : 'contractors.form.createTitle')} width={1040} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => form.submit()} onCancel={() => setEditorOpen(false)} destroyOnHidden styles={{ body: { maxHeight: '72vh', overflowY: 'auto', background: '#f6f7f9', padding: 16 } }}>
      <Form<ContractorFormValues> form={form} layout="vertical" requiredMark={false} onFinish={saveContractor} onValuesChange={(changed) => { if ('name' in changed || 'bin' in changed) resetDuplicateWarning(); }}>
        {duplicates.length > 0 && <Alert className="form-alert" type="warning" showIcon message={t('contractors.duplicates.title')} description={<ul>{duplicates.map((item) => <li key={item.id}>{t('contractors.duplicates.item', { name: item.name, bin: item.bin || t('common.notSpecified') })}</li>)}</ul>} />}
        <Card className="contractor-form-section" title={t('contractors.form.sections.requisites')}>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="name" label={t('contractors.form.name')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.name') }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="types" label={t('contractors.form.types')} rules={[{ required: true, type: 'array', min: 1, message: t('contractors.validation.types') }]}><Select mode="multiple" options={typeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="bin" label={t('contractors.form.bin')}><Input onBlur={() => void checkDuplicates()} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="country" label={t('contractors.form.country')}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="legalAddress" label={t('contractors.form.legalAddress')}><Input /></Form.Item></Col>
            <Col xs={24} md={paymentTerm === 'POSTPAYMENT' ? 12 : 24}><Form.Item name="paymentTerm" label={t('contractors.form.paymentTerm')}><Select allowClear onChange={(value: PaymentTerm | undefined) => { if (value !== 'POSTPAYMENT') form.setFieldValue('postpaymentDays', undefined); }} options={[{ value: 'PREPAYMENT', label: t('contractors.payment.PREPAYMENT') }, { value: 'POSTPAYMENT', label: t('contractors.payment.POSTPAYMENT') }]} /></Form.Item></Col>
            {paymentTerm === 'POSTPAYMENT' && <Col xs={24} md={12}><Form.Item name="postpaymentDays" label={t('contractors.form.postpaymentDays')} rules={[{ required: true, message: t('contractors.validation.postpaymentDays') }, { type: 'number', min: 1, message: t('contractors.validation.postpaymentDays') }]}><InputNumber min={1} precision={0} className="full-width" /></Form.Item></Col>}
            <Col span={24}><Form.Item name="notes" label={t('contractors.form.notes')}><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Card>

        <Card className="contractor-form-section" title={t('contractors.form.sections.status')}>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="isProblem" label={t('contractors.form.problem')} valuePropName="checked"><Switch /></Form.Item>{isProblem && <Form.Item name="problemComment" label={t('contractors.form.problemComment')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.problemComment') }]}><Input.TextArea rows={2} /></Form.Item>}</Col>
            <Col xs={24} md={12}><Form.Item name="isBlacklisted" label={t('contractors.form.blacklisted')} valuePropName="checked"><Switch /></Form.Item>{isBlacklisted && <Form.Item name="blacklistReason" label={t('contractors.form.blacklistReason')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.blacklistReason') }]}><Input.TextArea rows={2} /></Form.Item>}</Col>
          </Row>
        </Card>

        <Card className="contractor-form-section" title={t('contractors.form.contacts')}>
          <Form.List name="contacts">{(fields, { add, remove }) => <>{fields.map((field) => <Card size="small" className="nested-form-card" key={field.key} extra={<Button type="text" danger icon={<MinusCircleOutlined />} aria-label={t('contractors.form.removeContact')} onClick={() => remove(field.name)} />}><Row gutter={12}><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'fullName']} label={t('contractors.form.contactFullName')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.contactName') }]}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'position']} label={t('contractors.form.position')}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'phone']} label={t('contractors.form.phone')}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item {...field} name={[field.name, 'email']} label={t('contractors.form.email')} rules={[{ type: 'email', message: t('contractors.validation.email') }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item {...field} name={[field.name, 'whatsapp']} label={t('contractors.form.whatsapp')}><Input /></Form.Item></Col></Row></Card>)}<Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>{t('contractors.form.addContact')}</Button></>}</Form.List>
        </Card>

        <Card className="contractor-form-section" title={t('contractors.form.bankAccounts')}>
          <Form.List name="bankAccounts">{(fields, { add, remove }) => <>{fields.map((field) => <Card size="small" className="nested-form-card" key={field.key} extra={<Button type="text" danger icon={<MinusCircleOutlined />} aria-label={t('contractors.form.removeAccount')} onClick={() => remove(field.name)} />}><Row gutter={12}><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'bankName']} label={t('contractors.form.bankName')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.bankName') }]}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'accountNumber']} label={t('contractors.form.accountNumber')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.accountNumber') }]}><Input /></Form.Item></Col><Col xs={24} md={8}><Form.Item {...field} name={[field.name, 'currency']} label={t('contractors.form.currency')} rules={[{ required: true, message: t('contractors.validation.currency') }]}><Select options={CURRENCIES.map((value) => ({ value, label: value }))} /></Form.Item></Col><Col span={24}><Form.Item {...field} name={[field.name, 'notes']} label={t('contractors.form.accountNotes')}><Input /></Form.Item></Col></Row></Card>)}<Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>{t('contractors.form.addAccount')}</Button></>}</Form.List>
        </Card>
      </Form>
    </Modal>
  </>;
}

function ContractorDetails({ contractor, related, relatedLoading, paymentText, onEdit, onDelete, onRestore, onToggleFlag, onTransportation, isAdmin }: {
  contractor: Contractor;
  related: ContractorTransportation[];
  relatedLoading: boolean;
  paymentText: (item: Contractor) => string;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggleFlag: (kind: 'problem' | 'blacklist') => void;
  onTransportation: (id: string) => void;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const relatedColumns: ColumnsType<ContractorTransportation> = [
    { title: t('contractors.related.number'), dataIndex: 'number', key: 'number', width: 170, render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    {
      title: t('contractors.related.routeRole'), key: 'route',
      render: (_, item) => <div>{t('transportations.values.route', { from: item.originPoint, to: item.destinationPoint })}<div className="table-cell-secondary">{[
        item.role.isClient ? t('contractors.related.clientRole') : null,
        ...item.role.legOrderIndexes.map((number) => t('contractors.related.legRole', { number })),
      ].filter(Boolean).join(' · ')}</div></div>,
    },
    { title: t('contractors.related.status'), dataIndex: 'status', key: 'status', width: 180, render: (status: TransportationStatus) => <Tag bordered={false} style={STATUS_COLORS[status]}>{t(`transportations.statuses.${status}`)}</Tag> },
  ];

  return <>
    <Card className="contractor-detail-card">
      <div className="contractor-detail-heading">
        <span className="contractor-avatar large">{initials(contractor.name)}</span>
        <div className="contractor-detail-title">
          <div><Typography.Title level={3}>{contractor.name}</Typography.Title>{contractor.types.map((type) => <Tag bordered={false} className="contractor-type-tag" key={type}>{t(`contractors.types.${type}`)}</Tag>)}</div>
          {contractor.deletedAt && <Tag>{t('contractors.status.deleted')}</Tag>}
        </div>
        <div className="contractor-detail-actions">
          {contractor.deletedAt ? isAdmin && <Button icon={<RedoOutlined />} onClick={onRestore}>{t('contractors.actions.restore')}</Button> : <>
            <Button icon={<EditOutlined />} onClick={onEdit}>{t('contractors.actions.edit')}</Button>
            {isAdmin && <Button danger icon={<DeleteOutlined />} onClick={onDelete}>{t('contractors.actions.delete')}</Button>}
          </>}
        </div>
      </div>

      <div className="contractor-detail-grid">
        <DetailValue label={t('contractors.form.bin')} value={contractor.bin} />
        <DetailValue label={t('contractors.form.country')} value={contractor.country} />
        <DetailValue label={t('contractors.form.legalAddress')} value={contractor.legalAddress} />
        <DetailValue label={t('contractors.form.paymentTerm')} value={paymentText(contractor)} />
        <DetailValue label={t('contractors.form.notes')} value={contractor.notes} />
      </div>

      {!contractor.deletedAt && <div className="contractor-flag-actions">
        <Button danger={contractor.isProblem} onClick={() => onToggleFlag('problem')}>{t(contractor.isProblem ? 'contractors.flags.removeProblem' : 'contractors.flags.addProblem')}</Button>
        <Button danger={contractor.isBlacklisted} onClick={() => onToggleFlag('blacklist')}>{t(contractor.isBlacklisted ? 'contractors.flags.removeBlacklist' : 'contractors.flags.addBlacklist')}</Button>
      </div>}
      {contractor.isProblem && <Alert type="warning" showIcon message={t('contractors.details.problem')} description={contractor.problemComment || t('common.notSpecified')} />}
      {contractor.isBlacklisted && <Alert type="error" showIcon message={t('contractors.details.blacklisted')} description={contractor.blacklistReason || t('common.notSpecified')} />}
    </Card>

    <div className="contractor-info-columns">
      <Card className="contractor-detail-card" title={t('contractors.details.contacts')}>
        {contractor.contacts.length ? <div className="contractor-info-list">{contractor.contacts.map((item, index) => <div key={item.id ?? index}><Typography.Text strong>{item.fullName}</Typography.Text><span>{[item.position, item.phone, item.email, item.whatsapp && t('contractors.details.whatsappValue', { value: item.whatsapp })].filter(Boolean).join(' · ')}</span></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('contractors.details.noContacts')} />}
      </Card>
      <Card className="contractor-detail-card" title={t('contractors.details.accounts')}>
        {contractor.bankAccounts.length ? <div className="contractor-info-list">{contractor.bankAccounts.map((item, index) => <div key={item.id ?? index}><Typography.Text strong>{t('contractors.details.accountTitle', { bank: item.bankName, currency: item.currency })}</Typography.Text><span>{[item.accountNumber, item.notes].filter(Boolean).join(' · ')}</span></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('contractors.details.noAccounts')} />}
      </Card>
    </div>

    <Card className="contractor-detail-card" title={t('contractors.related.title')}>
      <Table<ContractorTransportation> className="contractor-related-table" rowKey="id" columns={relatedColumns} dataSource={related} loading={relatedLoading} pagination={false} scroll={{ x: 620 }} locale={{ emptyText: t('contractors.related.empty') }} onRow={(item) => ({ onClick: () => onTransportation(item.id) })} />
    </Card>
  </>;
}

function DetailValue({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTranslation();
  return <div><span>{label}</span><strong>{value || t('common.dash')}</strong></div>;
}
