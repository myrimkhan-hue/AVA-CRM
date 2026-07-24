import {
  EyeOutlined,
  HolderOutlined,
  PlusOutlined,
  RedoOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Modal,
  Popover,
  Segmented,
  Select,
  Space,
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
import { PasteRequisitesBox } from '../components/PasteRequisitesBox';
import {
  DEAL_STAGE_COLORS,
  DEAL_STAGES,
  Deal,
  DealLegalEntity,
  DealStage,
} from '../deals/shared';
import { mapParsedToFields, ParsedRequisites } from '../documents/parse-requisites';

interface UserReference { id: string; fullName: string; isActive?: boolean }
interface ContractorReference { id: string; name: string }
interface CreateValues { clientId: string; legalEntityId: string; responsibleId?: string; notes?: string }
interface QuickClientValues { name: string; bin?: string; country?: string; legalAddress?: string }
interface ColumnSetting { key: ColumnKey; visible: boolean }
interface SettingsResponse { columns: unknown }

const QUICK_CLIENT_PASTE_FIELDS: readonly (keyof ParsedRequisites)[] = ['name', 'bin', 'address'];

const QUICK_CLIENT_PASTE_MAPPING: Partial<Record<keyof ParsedRequisites, keyof QuickClientValues>> = {
  name: 'name',
  bin: 'bin',
  address: 'legalAddress',
};

const COLUMN_KEYS = ['number', 'client', 'responsible', 'department', 'legalEntity', 'stage', 'createdAt', 'transportations', 'actions'] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
type ViewMode = 'table' | 'kanban';

const DEFAULT_SETTINGS: ColumnSetting[] = COLUMN_KEYS.map((key) => ({ key, visible: true }));

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
    normalized.push({ key, visible: key === 'number' ? true : candidate.visible === true });
  }
  for (const item of DEFAULT_SETTINGS) {
    if (!seen.has(item.key)) normalized.push(item);
  }
  return normalized;
}

export function DealsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [createForm] = Form.useForm<CreateValues>();
  const [quickClientForm] = Form.useForm<QuickClientValues>();
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientSaving, setQuickClientSaving] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [legalEntities, setLegalEntities] = useState<DealLegalEntity[]>([]);
  const [clients, setClients] = useState<ContractorReference[]>([]);
  const [users, setUsers] = useState<UserReference[]>([]);
  const [canSelectResponsible, setCanSelectResponsible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<DealStage>();
  const [legalEntityFilter, setLegalEntityFilter] = useState<string>();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [settings, setSettings] = useState<ColumnSetting[]>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<ColumnKey>();
  const lastSavedSettings = useRef('');
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const mayEditDeals = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role)));
  const mayRequestUsers = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'].includes(role)));

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (stageFilter) params.set('stage', stageFilter);
      if (legalEntityFilter) params.set('legalEntityId', legalEntityFilter);
      if (includeDeleted && isAdmin) params.set('includeDeleted', 'true');
      const query = params.toString();
      setDeals(await apiRequest<Deal[]>(`/deals${query ? `?${query}` : ''}`));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [includeDeleted, isAdmin, legalEntityFilter, search, showError, stageFilter]);

  useEffect(() => { void loadDeals(); }, [loadDeals]);
  useEffect(() => {
    apiRequest<DealLegalEntity[]>('/legal-entities').then(setLegalEntities).catch(showError);
  }, [showError]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const saved = await apiRequest<SettingsResponse | null>('/me/table-settings/deals');
        if (!active) return;
        const nextSettings = normalizeSettings(saved?.columns);
        setSettings(nextSettings);
        lastSavedSettings.current = JSON.stringify(nextSettings);
      } catch (error) {
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
        await apiRequest<SettingsResponse>('/me/table-settings/deals', {
          method: 'PUT',
          body: JSON.stringify({ columns: settings }),
        });
        lastSavedSettings.current = signature;
      } catch (error) {
        showError(error);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [settings, settingsLoaded, showError]);

  const loadClients = useCallback(async (value = '') => {
    try {
      const params = new URLSearchParams({ type: 'CLIENT' });
      if (value.trim()) params.set('search', value.trim());
      setClients(await apiRequest<ContractorReference[]>(`/contractors?${params.toString()}`));
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  const loadUsers = useCallback(async () => {
    if (!mayRequestUsers) {
      setCanSelectResponsible(false);
      return;
    }
    try {
      const result = await apiRequest<UserReference[]>('/users');
      setUsers(result.filter((item) => item.isActive !== false));
      setCanSelectResponsible(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setCanSelectResponsible(false);
        return;
      }
      showError(error);
    }
  }, [mayRequestUsers, showError]);

  const openCreate = () => {
    createForm.resetFields();
    setCreateOpen(true);
    void loadClients();
    void loadUsers();
  };

  const clientSearch = useMemo(() => {
    let timer: number | undefined;
    return (value: string) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadClients(value), 400);
    };
  }, [loadClients]);

  const createDeal = async (values: CreateValues) => {
    setSaving(true);
    try {
      const created = await apiRequest<Deal>('/deals', { method: 'POST', body: JSON.stringify(values) });
      void message.success(t('deals.messages.created', { number: created.number }));
      setCreateOpen(false);
      await loadDeals();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openQuickClient = () => {
    quickClientForm.resetFields();
    setQuickClientOpen(true);
  };

  const createQuickClient = async (values: QuickClientValues) => {
    setQuickClientSaving(true);
    try {
      const created = await apiRequest<ContractorReference>('/contractors', {
        method: 'POST',
        body: JSON.stringify({ ...values, types: ['CLIENT'] }),
      });
      setClients((current) => [created, ...current]);
      createForm.setFieldValue('clientId', created.id);
      setQuickClientOpen(false);
      void message.success(t('deals.quickClient.created', { name: created.name }));
    } catch (error) {
      showError(error);
    } finally {
      setQuickClientSaving(false);
    }
  };

  const restoreDeal = async (deal: Deal) => {
    try {
      await apiRequest(`/deals/${deal.id}/restore`, { method: 'PATCH' });
      void message.success(t('deals.messages.restored'));
      await loadDeals();
    } catch (error) {
      showError(error);
    }
  };

  const formatDate = useCallback((value: string) => (
    new Intl.DateTimeFormat(i18n.language).format(new Date(value))
  ), [i18n.language]);
  const stageTag = useCallback((stage: DealStage) => (
    <Tag bordered={false} style={DEAL_STAGE_COLORS[stage]}>{t(`deals.stages.${stage}`)}</Tag>
  ), [t]);
  const stageOptions = DEAL_STAGES.map((value) => ({ value, label: t(`deals.stages.${value}`) }));

  const allColumns = useMemo<Record<ColumnKey, ColumnsType<Deal>[number]>>(() => ({
    number: {
      title: t('deals.columns.number'), key: 'number', fixed: 'left', width: 190,
      render: (_, item) => <Space><Typography.Text strong className="deal-number">{item.number}</Typography.Text>{item.deletedAt && <Tag>{t('deals.status.deleted')}</Tag>}</Space>,
    },
    client: { title: t('deals.columns.client'), key: 'client', width: 220, render: (_, item) => item.client.name },
    responsible: { title: t('deals.columns.responsible'), key: 'responsible', width: 190, render: (_, item) => item.responsible.fullName },
    department: { title: t('deals.columns.department'), key: 'department', width: 170, render: (_, item) => item.department?.name || t('common.dash') },
    legalEntity: { title: t('deals.columns.legalEntity'), key: 'legalEntity', width: 160, render: (_, item) => <Tag bordered={false}>{item.legalEntity.numberingPrefix}</Tag> },
    stage: { title: t('deals.columns.stage'), key: 'stage', width: 180, render: (_, item) => stageTag(item.stage) },
    createdAt: { title: t('deals.columns.createdAt'), key: 'createdAt', width: 140, render: (_, item) => formatDate(item.createdAt) },
    transportations: { title: t('deals.columns.transportations'), key: 'transportations', width: 130, align: 'right', render: (_, item) => item._count.transportations },
    actions: {
      title: t('deals.columns.actions'), key: 'actions', width: 145,
      render: (_, item) => item.deletedAt && isAdmin
        ? <Button size="small" icon={<RedoOutlined />} onClick={(event) => { event.stopPropagation(); void restoreDeal(item); }}>{t('deals.actions.restore')}</Button>
        : <Button size="small" type="text" icon={<EyeOutlined />} onClick={(event) => { event.stopPropagation(); navigate(`/deals/${item.id}`); }}>{t('deals.actions.open')}</Button>,
    },
  }), [formatDate, isAdmin, navigate, stageTag, t]);

  const columns = useMemo(
    () => settings.filter((item) => item.visible).map((item) => allColumns[item.key]),
    [allColumns, settings],
  );

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
    <div className="column-settings-title">{t('deals.settings.title')}</div>
    <div className="column-settings-list">
      {settings.map((item) => (
        <div
          key={item.key}
          draggable
          className={`column-setting${draggedKey === item.key ? ' dragging' : ''}`}
          onDragStart={() => setDraggedKey(item.key)}
          onDragOver={(event) => { event.preventDefault(); moveSetting(item.key); }}
          onDragEnd={() => setDraggedKey(undefined)}
        >
          <HolderOutlined className="column-drag-handle" />
          <Checkbox
            checked={item.visible}
            disabled={item.key === 'number'}
            onChange={(event) => setSettings((current) => current.map((column) => column.key === item.key ? { ...column, visible: event.target.checked } : column))}
          />
          <span>{t(`deals.columns.${item.key}`)}</span>
        </div>
      ))}
    </div>
    <Button type="text" danger block className="column-settings-reset" onClick={() => setSettings(DEFAULT_SETTINGS)}>{t('deals.settings.reset')}</Button>
    <div className="column-settings-help">{t('deals.settings.help')}</div>
  </div>;

  return <>
    <section className="deals-page">
      <div className="deals-heading">
        <div className="deals-title-row">
          <div>
            <Typography.Title level={2}>{t('deals.title')}</Typography.Title>
            <Typography.Text type="secondary">{t('deals.subtitle')}</Typography.Text>
          </div>
          <Segmented<ViewMode>
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'table', label: t('deals.views.table') },
              { value: 'kanban', label: t('deals.views.kanban') },
            ]}
          />
        </div>
        {mayEditDeals && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('deals.add')}</Button>}
      </div>

      <div className="deals-filters">
        <Input.Search allowClear value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('deals.filters.search')} />
        <Select allowClear value={stageFilter} onChange={setStageFilter} placeholder={t('deals.filters.stage')} options={stageOptions} />
        <Select allowClear value={legalEntityFilter} onChange={setLegalEntityFilter} placeholder={t('deals.filters.legalEntity')} options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} />
        {isAdmin && <Checkbox checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)}>{t('deals.filters.includeDeleted')}</Checkbox>}
        {viewMode === 'table' && <Popover trigger="click" placement="bottomRight" open={settingsOpen} onOpenChange={setSettingsOpen} content={settingsContent}>
          <Button icon={<SettingOutlined />}>{t('deals.settings.button')}</Button>
        </Popover>}
      </div>

      {viewMode === 'table' ? <>
        <Table<Deal>
          className="deals-table"
          rowKey="id"
          columns={columns}
          dataSource={deals}
          loading={loading}
          scroll={{ x: 'max-content' }}
          rowClassName={(item) => item.deletedAt ? 'inactive-row' : ''}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('deals.footer.shown', { total }) }}
          locale={{ emptyText: t('deals.empty') }}
          onRow={(item) => ({ onClick: () => navigate(`/deals/${item.id}`) })}
        />
        <div className="deals-footer">{t('deals.footer.summary', { total: deals.length })}</div>
      </> : <div className="deal-kanban" aria-busy={loading}>
        {DEAL_STAGES.map((stage) => {
          const stageDeals = deals.filter((deal) => deal.stage === stage);
          return <section className="deal-kanban-column" key={stage}>
            <div className="deal-kanban-column-heading">
              {stageTag(stage)}
              <span>{stageDeals.length}</span>
            </div>
            <div className="deal-kanban-cards">
              {stageDeals.map((deal) => <article
                className="deal-kanban-card"
                key={deal.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/deals/${deal.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/deals/${deal.id}`);
                  }
                }}
              >
                <span className="deal-kanban-number">{deal.number}{deal.deletedAt && <Tag>{t('deals.status.deleted')}</Tag>}</span>
                <strong>{deal.client.name}</strong>
                <span>{t('deals.kanban.responsible')}: {deal.responsible.fullName}</span>
                <span>{t('deals.kanban.department')}: {deal.department?.name || t('common.dash')}</span>
                <span>{t('deals.kanban.legalEntity')}: {deal.legalEntity.numberingPrefix}</span>
                {deal.deletedAt && isAdmin && <Button size="small" icon={<RedoOutlined />} onClick={(event) => { event.stopPropagation(); void restoreDeal(deal); }}>{t('deals.actions.restore')}</Button>}
              </article>)}
              {!loading && stageDeals.length === 0 && <div className="deal-kanban-empty">{t('deals.kanban.empty')}</div>}
            </div>
          </section>;
        })}
      </div>}
    </section>

    <Modal open={createOpen} title={t('deals.form.createTitle')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => createForm.submit()} onCancel={() => setCreateOpen(false)} destroyOnHidden>
      <Form<CreateValues> form={createForm} layout="vertical" requiredMark={false} onFinish={createDeal}>
        <Form.Item name="clientId" label={t('deals.form.client')} rules={[{ required: true, message: t('deals.validation.client') }]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={clientSearch}
            options={clients.map((item) => ({ value: item.id, label: item.name }))}
            popupRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '4px 0' }} />
                <Button
                  type="text"
                  block
                  icon={<PlusOutlined />}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openQuickClient}
                >
                  {t('deals.form.addClient')}
                </Button>
              </>
            )}
          />
        </Form.Item>
        <Form.Item name="legalEntityId" label={t('deals.form.legalEntity')} rules={[{ required: true, message: t('deals.validation.legalEntity') }]}><Select options={legalEntities.map((item) => ({ value: item.id, label: `${item.name} (${item.numberingPrefix})` }))} /></Form.Item>
        {canSelectResponsible && <Form.Item name="responsibleId" label={t('deals.form.responsible')}><Select allowClear options={users.map((item) => ({ value: item.id, label: item.fullName }))} /></Form.Item>}
        <Form.Item name="notes" label={t('deals.form.notes')}><Input.TextArea rows={4} /></Form.Item>
      </Form>
    </Modal>

    <Modal
      open={quickClientOpen}
      title={t('deals.quickClient.title')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={quickClientSaving}
      onOk={() => quickClientForm.submit()}
      onCancel={() => setQuickClientOpen(false)}
      destroyOnHidden
    >
      <Form<QuickClientValues> form={quickClientForm} layout="vertical" requiredMark={false} onFinish={createQuickClient}>
        <PasteRequisitesBox
          fields={QUICK_CLIENT_PASTE_FIELDS}
          onApply={(parsed) => quickClientForm.setFieldsValue(mapParsedToFields(parsed, QUICK_CLIENT_PASTE_MAPPING))}
        />
        <Form.Item name="name" label={t('contractors.form.name')} rules={[{ required: true, whitespace: true, message: t('contractors.validation.name') }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="bin" label={t('contractors.form.bin')}>
          <Input />
        </Form.Item>
        <Form.Item name="country" label={t('contractors.form.country')}>
          <Input />
        </Form.Item>
        <Form.Item name="legalAddress" label={t('contractors.form.legalAddress')}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  </>;
}
