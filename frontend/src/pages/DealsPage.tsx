import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  RedoOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
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

type DealStage = 'NEW' | 'RATE_CALCULATION' | 'RATE_SENT' | 'AGREED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'REJECTED';
type RejectReason = 'EXPENSIVE' | 'TIMING' | 'COMPETITOR' | 'NO_CONTACT' | 'OTHER';

interface Reference { id: string; name: string }
interface LegalEntity extends Reference { numberingPrefix: string }
interface UserReference { id: string; fullName: string; isActive?: boolean }
interface ContractorReference { id: string; name: string }
interface Deal {
  id: string;
  number: string;
  client: Reference;
  legalEntity: LegalEntity;
  responsible: { id: string; fullName: string };
  department: Reference | null;
  stage: DealStage;
  rejectReason: RejectReason | null;
  rejectComment: string | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
}
interface CreateValues { clientId: string; legalEntityId: string; responsibleId?: string; notes?: string }
interface StageValues { stage: DealStage; rejectReason?: RejectReason; rejectComment?: string }
interface NotesValues { notes?: string }

const STAGES: DealStage[] = ['NEW', 'RATE_CALCULATION', 'RATE_SENT', 'AGREED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED'];
const REASONS: RejectReason[] = ['EXPENSIVE', 'TIMING', 'COMPETITOR', 'NO_CONTACT', 'OTHER'];
const STAGE_COLORS: Record<DealStage, string> = {
  NEW: 'default', RATE_CALCULATION: 'blue', RATE_SENT: 'blue', AGREED: 'cyan',
  IN_PROGRESS: 'orange', COMPLETED: 'green', CLOSED: '#237804', REJECTED: 'red',
};

export function DealsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const [createForm] = Form.useForm<CreateValues>();
  const [stageForm] = Form.useForm<StageValues>();
  const [notesForm] = Form.useForm<NotesValues>();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
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
  const [viewing, setViewing] = useState<Deal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const isFinancierOnly = Boolean(user?.roles.includes('FINANCIER') && !user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role)));
  const mayRequestUsers = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'].includes(role)));
  const selectedStage = Form.useWatch('stage', stageForm);
  const selectedReason = Form.useWatch('rejectReason', stageForm);

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
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, [includeDeleted, isAdmin, legalEntityFilter, search, showError, stageFilter]);

  useEffect(() => { void loadDeals(); }, [loadDeals]);
  useEffect(() => {
    apiRequest<LegalEntity[]>('/legal-entities').then(setLegalEntities).catch(showError);
  }, [showError]);

  const loadClients = useCallback(async (value = '') => {
    try {
      const params = new URLSearchParams({ type: 'CLIENT' });
      if (value.trim()) params.set('search', value.trim());
      setClients(await apiRequest<ContractorReference[]>(`/contractors?${params.toString()}`));
    } catch (error) { showError(error); }
  }, [showError]);

  const loadUsers = useCallback(async () => {
    if (!mayRequestUsers) { setCanSelectResponsible(false); return; }
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
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  };

  const saveStage = async (values: StageValues) => {
    if (!viewing) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Deal>(`/deals/${viewing.id}/stage`, { method: 'PATCH', body: JSON.stringify(values) });
      setViewing(updated);
      setStageOpen(false);
      void message.success(t('deals.messages.stageUpdated'));
      await loadDeals();
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  };

  const saveNotes = async (values: NotesValues) => {
    if (!viewing) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Deal>(`/deals/${viewing.id}`, { method: 'PATCH', body: JSON.stringify(values) });
      setViewing(updated);
      setNotesOpen(false);
      void message.success(t('deals.messages.notesUpdated'));
      await loadDeals();
    } catch (error) { showError(error); }
    finally { setSaving(false); }
  };

  const removeDeal = (deal: Deal) => modal.confirm({
    title: t('deals.confirm.deleteTitle'),
    content: t('deals.confirm.deleteText', { number: deal.number }),
    okText: t('deals.actions.delete'), cancelText: t('common.cancel'), okButtonProps: { danger: true },
    async onOk() {
      try {
        await apiRequest(`/deals/${deal.id}`, { method: 'DELETE' });
        setViewing(null);
        void message.success(t('deals.messages.deleted'));
        await loadDeals();
      } catch (error) { showError(error); throw error; }
    },
  });

  const restoreDeal = async (deal: Deal) => {
    try {
      await apiRequest(`/deals/${deal.id}/restore`, { method: 'PATCH' });
      void message.success(t('deals.messages.restored'));
      await loadDeals();
    } catch (error) { showError(error); }
  };

  const stageTag = (stage: DealStage) => <Tag color={STAGE_COLORS[stage]}>{t(`deals.stages.${stage}`)}</Tag>;
  const date = (value: string) => new Intl.DateTimeFormat('ru-RU').format(new Date(value));
  const stageOptions = STAGES.map((value) => ({ value, label: t(`deals.stages.${value}`) }));
  const reasonOptions = REASONS.map((value) => ({ value, label: t(`deals.reasons.${value}`) }));

  const columns: ColumnsType<Deal> = [
    { title: t('deals.columns.number'), dataIndex: 'number', render: (value: string, item) => <Space><Typography.Text strong className="deal-number">{value}</Typography.Text>{item.deletedAt && <Tag>{t('deals.status.deleted')}</Tag>}</Space> },
    { title: t('deals.columns.client'), dataIndex: ['client', 'name'] },
    { title: t('deals.columns.legalEntity'), dataIndex: 'legalEntity', render: (value: LegalEntity) => <Tag>{value.numberingPrefix}</Tag> },
    { title: t('deals.columns.responsible'), dataIndex: ['responsible', 'fullName'] },
    { title: t('deals.columns.department'), dataIndex: 'department', render: (value: Reference | null) => value?.name || t('common.dash') },
    { title: t('deals.columns.stage'), dataIndex: 'stage', render: stageTag },
    { title: t('deals.columns.createdAt'), dataIndex: 'createdAt', render: date },
    { title: t('deals.columns.actions'), key: 'actions', render: (_, item) => item.deletedAt ? (isAdmin && <Button size="small" icon={<RedoOutlined />} onClick={() => void restoreDeal(item)}>{t('deals.actions.restore')}</Button>) : <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(item)}>{t('deals.actions.open')}</Button> },
  ];

  return <Card>
    <div className="page-heading">
      <div><Typography.Title level={2}>{t('deals.title')}</Typography.Title><Typography.Text type="secondary">{t('deals.subtitle')}</Typography.Text></div>
      {!isFinancierOnly && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('deals.add')}</Button>}
    </div>
    <div className="contractor-filters">
      <Input.Search allowClear value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('deals.filters.search')} />
      <Select allowClear value={stageFilter} onChange={setStageFilter} placeholder={t('deals.filters.stage')} options={stageOptions} />
      <Select allowClear value={legalEntityFilter} onChange={setLegalEntityFilter} placeholder={t('deals.filters.legalEntity')} options={legalEntities.map((item) => ({ value: item.id, label: item.name }))} />
      {isAdmin && <Space><Switch checked={includeDeleted} onChange={setIncludeDeleted} /><Typography.Text>{t('deals.filters.includeDeleted')}</Typography.Text></Space>}
    </div>
    <Table rowKey="id" columns={columns} dataSource={deals} loading={loading} scroll={{ x: 1250 }} rowClassName={(item) => item.deletedAt ? 'inactive-row' : ''} pagination={{ pageSize: 10, showSizeChanger: false }} />

    <Drawer open={Boolean(viewing)} width={680} title={viewing?.number} onClose={() => setViewing(null)} extra={viewing && !viewing.deletedAt && isAdmin ? <Button danger icon={<DeleteOutlined />} onClick={() => removeDeal(viewing)}>{t('deals.actions.delete')}</Button> : null}>
      {viewing && <>
        <Descriptions column={1} bordered size="small" items={[
          { key: 'client', label: t('deals.details.client'), children: viewing.client.name },
          { key: 'entity', label: t('deals.details.legalEntity'), children: `${viewing.legalEntity.name} (${viewing.legalEntity.numberingPrefix})` },
          { key: 'responsible', label: t('deals.details.responsible'), children: viewing.responsible.fullName },
          { key: 'department', label: t('deals.details.department'), children: viewing.department?.name || t('common.dash') },
          { key: 'stage', label: t('deals.details.stage'), children: stageTag(viewing.stage) },
          ...(viewing.rejectReason ? [{ key: 'reason', label: t('deals.details.rejectReason'), children: <>{t(`deals.reasons.${viewing.rejectReason}`)}{viewing.rejectComment ? ` — ${viewing.rejectComment}` : ''}</> }] : []),
          { key: 'notes', label: t('deals.details.notes'), children: viewing.notes || t('common.dash') },
          { key: 'created', label: t('deals.details.createdAt'), children: date(viewing.createdAt) },
        ]} />
        {!viewing.deletedAt && !isFinancierOnly && <Space wrap className="deal-actions">
          <Button icon={<SwapOutlined />} onClick={() => { stageForm.setFieldsValue({ stage: viewing.stage, rejectReason: viewing.rejectReason ?? undefined, rejectComment: viewing.rejectComment ?? undefined }); setStageOpen(true); }}>{t('deals.actions.changeStage')}</Button>
          <Button icon={<EditOutlined />} onClick={() => { notesForm.setFieldsValue({ notes: viewing.notes ?? undefined }); setNotesOpen(true); }}>{t('deals.actions.editNotes')}</Button>
        </Space>}
      </>}
    </Drawer>

    <Modal open={createOpen} title={t('deals.form.createTitle')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => createForm.submit()} onCancel={() => setCreateOpen(false)} destroyOnHidden>
      <Form<CreateValues> form={createForm} layout="vertical" requiredMark={false} onFinish={createDeal}>
        <Form.Item name="clientId" label={t('deals.form.client')} rules={[{ required: true, message: t('deals.validation.client') }]}><Select showSearch filterOption={false} onSearch={clientSearch} options={clients.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
        <Form.Item name="legalEntityId" label={t('deals.form.legalEntity')} rules={[{ required: true, message: t('deals.validation.legalEntity') }]}><Select options={legalEntities.map((item) => ({ value: item.id, label: `${item.name} (${item.numberingPrefix})` }))} /></Form.Item>
        {canSelectResponsible && <Form.Item name="responsibleId" label={t('deals.form.responsible')}><Select allowClear options={users.map((item) => ({ value: item.id, label: item.fullName }))} /></Form.Item>}
        <Form.Item name="notes" label={t('deals.form.notes')}><Input.TextArea rows={4} /></Form.Item>
      </Form>
    </Modal>

    <Modal open={stageOpen} title={t('deals.stageModal.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => stageForm.submit()} onCancel={() => setStageOpen(false)} destroyOnHidden>
      <Form<StageValues> form={stageForm} layout="vertical" requiredMark={false} onFinish={saveStage}>
        <Form.Item name="stage" label={t('deals.form.stage')} rules={[{ required: true, message: t('deals.validation.stage') }]}><Select options={stageOptions} onChange={(value) => { if (value !== 'REJECTED') stageForm.setFieldsValue({ rejectReason: undefined, rejectComment: undefined }); }} /></Form.Item>
        {selectedStage === 'REJECTED' && <>
          <Form.Item name="rejectReason" label={t('deals.form.rejectReason')} rules={[{ required: true, message: t('deals.validation.rejectReason') }]}><Select options={reasonOptions} /></Form.Item>
          <Form.Item name="rejectComment" label={t('deals.form.rejectComment')} rules={selectedReason === 'OTHER' ? [{ required: true, whitespace: true, message: t('deals.validation.rejectComment') }] : []}><Input.TextArea rows={3} /></Form.Item>
        </>}
      </Form>
    </Modal>

    <Modal open={notesOpen} title={t('deals.notesModal.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => notesForm.submit()} onCancel={() => setNotesOpen(false)} destroyOnHidden>
      <Form<NotesValues> form={notesForm} layout="vertical" onFinish={saveNotes}><Form.Item name="notes" label={t('deals.form.notes')}><Input.TextArea rows={5} /></Form.Item></Form>
    </Modal>
  </Card>;
}
