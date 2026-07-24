import {
  HistoryOutlined,
  PhoneOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { parseCsv } from '../leads/csv';
import {
  LEAD_IMPORT_FIELDS,
  LEAD_NOT_INTERESTED_REASONS,
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  LeadImportBatchResult,
  LeadImportField,
  LeadNotInterestedReason,
  LeadRecord,
  LeadStatus,
} from '../leads/shared';

interface UserReference { id: string; fullName: string; isActive?: boolean; roles: string[] }
interface DepartmentReference { id: string; name: string }
interface LegalEntityReference { id: string; name: string; numberingPrefix: string }
interface ImportBatchRecord {
  id: string; fileName: string; rowsTotal: number; rowsCreated: number;
  rowsExistingClient: number; rowsDuplicateLead: number; createdAt: string;
  importedBy: { id: string; fullName: string };
}
interface EditValues { name: string; phone?: string; bin?: string; city?: string; contactName?: string; email?: string; notes?: string }
interface TouchValues { status: LeadStatus; comment: string; callBackAt?: Dayjs; notInterestedReason?: LeadNotInterestedReason; notInterestedComment?: string }

type LeadTab = 'all' | 'my';
type StatusFilter = LeadStatus | 'ALL';

const MANAGE_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'];
const TOUCH_STATUSES: LeadStatus[] = ['IN_PROGRESS', 'CALL_BACK', 'NOT_REACHED', 'NOT_INTERESTED'];

const HEADER_GUESSES: Record<LeadImportField, string[]> = {
  name: ['название', 'наименование', 'компания', 'клиент', 'организация', 'name'],
  phone: ['телефон', 'тел', 'phone'],
  bin: ['бин', 'иин', 'bin'],
  city: ['город', 'city'],
  contactName: ['контакт', 'фио', 'contact'],
  email: ['email', 'почта', 'e-mail'],
  notes: ['примечание', 'комментарий', 'заметка', 'notes'],
};

function guessField(header: string): LeadImportField | '' {
  const normalized = header.trim().toLocaleLowerCase();
  const found = LEAD_IMPORT_FIELDS.find((field) => HEADER_GUESSES[field].some((token) => normalized.includes(token)));
  return found ?? '';
}

function isOverdueCallback(lead: LeadRecord): boolean {
  return lead.status === 'CALL_BACK' && Boolean(lead.callBackAt) && dayjs(lead.callBackAt).isBefore(dayjs());
}

export function LeadsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const canManage = Boolean(user?.roles.some((role) => MANAGE_ROLES.includes(role)));
  const canPickDepartment = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role)));
  const isManagerOnly = user?.roles.length === 1 && user.roles[0] === 'MANAGER';

  const [tab, setTab] = useState<LeadTab>(isManagerOnly ? 'my' : 'all');

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [responsibleFilter, setResponsibleFilter] = useState<string>();
  const [departmentFilter, setDepartmentFilter] = useState<string>();
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const [myLeads, setMyLeads] = useState<LeadRecord[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);

  const [users, setUsers] = useState<UserReference[]>([]);
  const [canSelectUsers, setCanSelectUsers] = useState(false);
  const [departments, setDepartments] = useState<DepartmentReference[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntityReference[]>([]);

  const [detailId, setDetailId] = useState<string>();
  const [detailLead, setDetailLead] = useState<LeadRecord>();
  const [detailLoading, setDetailLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm<EditValues>();
  const [saving, setSaving] = useState(false);

  const [touchLeadId, setTouchLeadId] = useState<string>();
  const [touchForm] = Form.useForm<TouchValues>();
  const touchStatus = Form.useWatch('status', touchForm);
  const touchReason = Form.useWatch('notInterestedReason', touchForm);
  const [touchSaving, setTouchSaving] = useState(false);

  const [convertLeadId, setConvertLeadId] = useState<string>();
  const [convertForm] = Form.useForm<{ legalEntityId: string }>();
  const [convertSaving, setConvertSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm] = Form.useForm<{ responsibleId: string }>();
  const [assignSaving, setAssignSaving] = useState(false);

  const [distributeOpen, setDistributeOpen] = useState(false);
  const [distributeForm] = Form.useForm<{ managerIds: string[] }>();
  const [distributeSaving, setDistributeSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<'source' | 'mapping'>('source');
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<number, LeadImportField | ''>>({});
  const [importDepartmentId, setImportDepartmentId] = useState<string>();
  const [importPasteText, setImportPasteText] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importResult, setImportResult] = useState<LeadImportBatchResult>();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [importBatches, setImportBatches] = useState<ImportBatchRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (canManage) {
        if (unassignedOnly) params.set('unassigned', 'true');
        else if (responsibleFilter) params.set('responsibleId', responsibleFilter);
        if (departmentFilter) params.set('departmentId', departmentFilter);
      }
      const query = params.toString();
      setLeads(await apiRequest<LeadRecord[]>(`/leads${query ? `?${query}` : ''}`));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoadingAll(false);
    }
  }, [canManage, departmentFilter, responsibleFilter, search, showError, statusFilter, unassignedOnly]);

  const loadMy = useCallback(async () => {
    setLoadingMy(true);
    try {
      setMyLeads(await apiRequest<LeadRecord[]>('/leads/my-calls'));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoadingMy(false);
    }
  }, [showError]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { void loadMy(); }, [loadMy]);

  useEffect(() => {
    apiRequest<DepartmentReference[]>('/departments').then(setDepartments).catch(showError);
    apiRequest<LegalEntityReference[]>('/legal-entities').then(setLegalEntities).catch(showError);
  }, [showError]);

  useEffect(() => {
    if (!canManage) return;
    apiRequest<UserReference[]>('/users')
      .then((result) => { setUsers(result.filter((item) => item.isActive !== false)); setCanSelectUsers(true); })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) { setCanSelectUsers(false); return; }
        showError(error);
      });
  }, [canManage, showError]);

  const managers = useMemo(
    () => users.filter((item) => item.roles.some((role) => ['MANAGER', 'DEPARTMENT_HEAD'].includes(role))),
    [users],
  );

  const refreshLists = useCallback(async () => {
    await Promise.all([loadAll(), loadMy()]);
  }, [loadAll, loadMy]);

  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    apiRequest<LeadRecord>(`/leads/${id}`)
      .then(setDetailLead)
      .catch((error: unknown) => showError(error))
      .finally(() => setDetailLoading(false));
  }, [showError]);

  const closeDetail = () => { setDetailId(undefined); setDetailLead(undefined); };

  const applyDetailUpdate = (updated: LeadRecord) => {
    setDetailLead(updated);
    void refreshLists();
  };

  const openEdit = () => {
    if (!detailLead) return;
    editForm.setFieldsValue({
      name: detailLead.name,
      phone: detailLead.phone ?? undefined,
      bin: detailLead.bin ?? undefined,
      city: detailLead.city ?? undefined,
      contactName: detailLead.contactName ?? undefined,
      email: detailLead.email ?? undefined,
      notes: detailLead.notes ?? undefined,
    });
    setEditOpen(true);
  };

  const submitEdit = async (values: EditValues) => {
    if (!detailLead) return;
    setSaving(true);
    try {
      const updated = await apiRequest<LeadRecord>(`/leads/${detailLead.id}`, { method: 'PATCH', body: JSON.stringify(values) });
      void message.success(t('leads.messages.updated'));
      setEditOpen(false);
      applyDetailUpdate(updated);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openTouch = (id: string) => {
    setTouchLeadId(id);
    touchForm.resetFields();
    touchForm.setFieldsValue({ status: 'IN_PROGRESS' });
  };

  const submitTouch = async (values: TouchValues) => {
    if (!touchLeadId) return;
    setTouchSaving(true);
    try {
      const body: Record<string, unknown> = { status: values.status, comment: values.comment.trim() };
      if (values.status === 'CALL_BACK' && values.callBackAt) body.callBackAt = values.callBackAt.toISOString();
      if (values.status === 'NOT_INTERESTED') {
        body.notInterestedReason = values.notInterestedReason;
        if (values.notInterestedReason === 'OTHER') body.notInterestedComment = values.notInterestedComment?.trim();
      }
      const updated = await apiRequest<LeadRecord>(`/leads/${touchLeadId}/touch`, { method: 'PATCH', body: JSON.stringify(body) });
      void message.success(t('leads.messages.touched'));
      setTouchLeadId(undefined);
      if (detailId === touchLeadId) setDetailLead(updated);
      await refreshLists();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setTouchSaving(false);
    }
  };

  const openConvert = (id: string) => {
    setConvertLeadId(id);
    convertForm.resetFields();
  };

  const submitConvert = async (values: { legalEntityId: string }) => {
    if (!convertLeadId) return;
    setConvertSaving(true);
    try {
      const updated = await apiRequest<LeadRecord>(`/leads/${convertLeadId}/convert`, {
        method: 'POST', body: JSON.stringify(values),
      });
      void message.success(t('leads.messages.converted'));
      setConvertLeadId(undefined);
      if (detailId === convertLeadId) setDetailLead(updated);
      await refreshLists();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setConvertSaving(false);
    }
  };

  const submitAssign = async (values: { responsibleId: string }) => {
    setAssignSaving(true);
    try {
      const result = await apiRequest<{ updated: number }>('/leads/assign', {
        method: 'PATCH', body: JSON.stringify({ leadIds: selectedRowKeys, responsibleId: values.responsibleId }),
      });
      void message.success(t('leads.messages.assigned', { count: result.updated }));
      setAssignOpen(false);
      setSelectedRowKeys([]);
      await loadAll();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setAssignSaving(false);
    }
  };

  const submitDistribute = async (values: { managerIds: string[] }) => {
    setDistributeSaving(true);
    try {
      const result = await apiRequest<{ updated: number }>('/leads/distribute', {
        method: 'PATCH', body: JSON.stringify({ leadIds: selectedRowKeys, managerIds: values.managerIds }),
      });
      void message.success(t('leads.messages.assigned', { count: result.updated }));
      setDistributeOpen(false);
      setSelectedRowKeys([]);
      await loadAll();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setDistributeSaving(false);
    }
  };

  const resetImport = () => {
    setImportStep('source');
    setImportFileName('');
    setImportHeaders([]);
    setImportRows([]);
    setImportMapping({});
    setImportDepartmentId(undefined);
    setImportPasteText('');
    setImportResult(undefined);
  };

  const openImport = () => { resetImport(); setImportOpen(true); };
  const closeImport = () => { setImportOpen(false); if (importResult) void loadAll(); };

  const applyParsed = (fileName: string, headers: string[], rows: string[][]) => {
    if (!headers.length || !rows.length) {
      void message.error(t('leads.import.emptyFile'));
      return;
    }
    setImportFileName(fileName);
    setImportHeaders(headers);
    setImportRows(rows);
    setImportMapping(Object.fromEntries(headers.map((header, index) => [index, guessField(header)])));
    setImportStep('mapping');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { headers, rows } = parseCsv(String(reader.result ?? ''));
      applyParsed(file.name, headers, rows);
    };
    reader.readAsText(file, 'utf-8');
  };

  const applyPaste = () => {
    const { headers, rows } = parseCsv(importPasteText);
    applyParsed(t('leads.import.pastedFileName', { date: dayjs().format('DD.MM.YYYY HH:mm') }), headers, rows);
  };

  const mappedNameIndex = Object.entries(importMapping).find(([, field]) => field === 'name')?.[0];

  const submitImport = async () => {
    if (mappedNameIndex === undefined) return;
    const nameIndex = Number(mappedNameIndex);
    const rows = importRows
      .map((row) => {
        const entry: Record<string, string> = {};
        for (const [indexKey, field] of Object.entries(importMapping)) {
          if (!field) continue;
          entry[field] = (row[Number(indexKey)] ?? '').trim();
        }
        return entry;
      })
      .filter((row) => row.name);
    if (!rows.length || !importRows.some((row) => (row[nameIndex] ?? '').trim())) {
      void message.error(t('leads.import.emptyFile'));
      return;
    }
    setImportSaving(true);
    try {
      const result = await apiRequest<LeadImportBatchResult>('/leads/import', {
        method: 'POST',
        body: JSON.stringify({ fileName: importFileName, departmentId: importDepartmentId, rows }),
      });
      setImportResult(result);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setImportSaving(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    apiRequest<ImportBatchRecord[]>('/leads/import-batches')
      .then(setImportBatches)
      .catch((error: unknown) => showError(error))
      .finally(() => setHistoryLoading(false));
  };

  const statusOptions = useMemo(() => LEAD_STATUSES.map((value) => ({ value, label: t(`leads.status.${value}`) })), [t]);
  const touchStatusOptions = useMemo(() => TOUCH_STATUSES.map((value) => ({ value, label: t(`leads.status.${value}`) })), [t]);
  const reasonOptions = useMemo(() => LEAD_NOT_INTERESTED_REASONS.map((value) => ({ value, label: t(`leads.notInterestedReasons.${value}`) })), [t]);

  const allColumns: ColumnsType<LeadRecord> = [
    {
      title: t('leads.columns.name'), key: 'name', fixed: 'left', width: 240,
      render: (_, item) => <div>
        <Typography.Text strong>{item.name}</Typography.Text>
        {item.isExistingClient && <Tag color="gold" style={{ marginLeft: 6 }}>{t('leads.existingClientTag')}</Tag>}
        <div className="table-cell-secondary">{[item.bin, item.city].filter(Boolean).join(' · ') || t('common.dash')}</div>
      </div>,
    },
    {
      title: t('leads.columns.contact'), key: 'contact', width: 200,
      render: (_, item) => <div>{item.phone || t('common.dash')}<div className="table-cell-secondary">{item.contactName || t('common.dash')}</div></div>,
    },
    {
      title: t('leads.columns.status'), key: 'status', width: 170,
      render: (_, item) => <Tag bordered={false} style={LEAD_STATUS_COLORS[item.status]}>{t(`leads.status.${item.status}`)}</Tag>,
    },
    { title: t('leads.columns.responsible'), key: 'responsible', width: 170, render: (_, item) => item.responsible?.fullName || t('leads.detail.unassigned') },
    { title: t('leads.columns.department'), key: 'department', width: 150, render: (_, item) => item.department?.name || t('common.dash') },
    { title: t('leads.columns.createdAt'), key: 'createdAt', width: 130, render: (_, item) => new Date(item.createdAt).toLocaleDateString('ru-RU') },
  ];

  const myColumns: ColumnsType<LeadRecord> = [
    {
      title: t('leads.columns.name'), key: 'name', width: 240,
      render: (_, item) => <div>
        <Typography.Text strong>{item.name}</Typography.Text>
        <div className="table-cell-secondary">{item.phone || t('common.dash')}</div>
      </div>,
    },
    {
      title: t('leads.columns.status'), key: 'status', width: 170,
      render: (_, item) => <Tag bordered={false} style={LEAD_STATUS_COLORS[item.status]}>{t(`leads.status.${item.status}`)}</Tag>,
    },
    {
      title: t('leads.myCalls.columns.callBack'), key: 'callBackAt', width: 170,
      render: (_, item) => item.callBackAt
        ? <span className={isOverdueCallback(item) ? 'overdue-note' : undefined}>{new Date(item.callBackAt).toLocaleString('ru-RU')}</span>
        : t('common.dash'),
    },
    { title: t('leads.myCalls.columns.attempts'), key: 'attempts', width: 110, render: (_, item) => item.notReachedAttempts },
    {
      title: t('leads.columns.actions'), key: 'actions', width: 160,
      render: (_, item) => <Button size="small" icon={<PhoneOutlined />} onClick={(event) => { event.stopPropagation(); openTouch(item.id); }}>{t('leads.myCalls.quickTouch')}</Button>,
    },
  ];

  return <>
    <section className="leads-page">
      <div className="leads-heading">
        <div className="leads-title-row">
          <Typography.Title level={2}>{t('leads.title')}</Typography.Title>
          <Segmented<LeadTab> value={tab} onChange={setTab} options={[
            { value: 'all', label: t('leads.tabs.all') },
            { value: 'my', label: t('leads.tabs.my') },
          ]} />
        </div>
        {canManage && <div className="leads-heading-actions">
          <Button icon={<HistoryOutlined />} onClick={openHistory}>{t('leads.actions.importHistory')}</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={openImport}>{t('leads.actions.import')}</Button>
        </div>}
      </div>

      {tab === 'all' ? <>
        <div className="leads-filters">
          <Input.Search allowClear value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('leads.filters.search')} />
          <Select allowClear value={statusFilter === 'ALL' ? undefined : statusFilter} onChange={(value) => setStatusFilter(value ?? 'ALL')} placeholder={t('leads.filters.allStatuses')} options={statusOptions} />
          {canManage && <Select allowClear disabled={unassignedOnly} value={responsibleFilter} onChange={setResponsibleFilter} placeholder={t('leads.filters.allResponsibles')} options={managers.map((item) => ({ value: item.id, label: item.fullName }))} />}
          {canManage && canPickDepartment && <Select allowClear value={departmentFilter} onChange={setDepartmentFilter} placeholder={t('leads.filters.allDepartments')} options={departments.map((item) => ({ value: item.id, label: item.name }))} />}
          {canManage && <label className="leads-unassigned-filter"><Switch size="small" checked={unassignedOnly} onChange={setUnassignedOnly} /><span>{t('leads.filters.unassignedOnly')}</span></label>}
        </div>

        {canManage && selectedRowKeys.length > 0 && <div className="leads-bulk-bar">
          <span>{t('leads.bulk.selected', { count: selectedRowKeys.length })}</span>
          <Button icon={<UserAddOutlined />} onClick={() => { assignForm.resetFields(); setAssignOpen(true); }}>{t('leads.bulk.assign')}</Button>
          <Button icon={<TeamOutlined />} onClick={() => { distributeForm.resetFields(); setDistributeOpen(true); }}>{t('leads.bulk.distribute')}</Button>
        </div>}

        <Table<LeadRecord>
          className="leads-table"
          rowKey="id"
          columns={allColumns}
          dataSource={leads}
          loading={loadingAll}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('contractors.footer.shown', { total }) }}
          locale={{ emptyText: t('leads.empty') }}
          rowSelection={canManage ? { selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) } : undefined}
          onRow={(item) => ({ onClick: () => openDetail(item.id) })}
        />
      </> : <Table<LeadRecord>
        className="leads-table"
        rowKey="id"
        columns={myColumns}
        dataSource={myLeads}
        loading={loadingMy}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: t('leads.myCalls.empty') }}
        rowClassName={(item) => isOverdueCallback(item) ? 'overdue-row' : ''}
        onRow={(item) => ({ onClick: () => openDetail(item.id) })}
      />}
    </section>

    <Modal open={Boolean(detailId)} title={detailLead?.name} width={760} footer={null} onCancel={closeDetail} destroyOnHidden>
      {detailLoading && <Spin className="contractor-list-spin" />}
      {!detailLoading && detailLead && <LeadDetail
        lead={detailLead}
        onEdit={openEdit}
        onTouch={() => openTouch(detailLead.id)}
        onConvert={() => openConvert(detailLead.id)}
        onGoToDeal={() => { if (detailLead.convertedDeal) navigate(`/deals/${detailLead.convertedDeal.id}`); }}
      />}
    </Modal>

    <Modal open={editOpen} title={t('leads.editForm.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => editForm.submit()} onCancel={() => setEditOpen(false)} destroyOnHidden>
      <Form<EditValues> form={editForm} layout="vertical" requiredMark={false} onFinish={(values) => void submitEdit(values)}>
        <Form.Item name="name" label={t('leads.fields.name')} rules={[{ required: true, whitespace: true, message: t('leads.validation.name') }]}><Input /></Form.Item>
        <Form.Item name="phone" label={t('leads.fields.phone')}><Input /></Form.Item>
        <Form.Item name="bin" label={t('leads.fields.bin')}><Input /></Form.Item>
        <Form.Item name="city" label={t('leads.fields.city')}><Input /></Form.Item>
        <Form.Item name="contactName" label={t('leads.fields.contactName')}><Input /></Form.Item>
        <Form.Item name="email" label={t('leads.fields.email')} rules={[{ type: 'email', message: t('contractors.validation.email') }]}><Input /></Form.Item>
        <Form.Item name="notes" label={t('leads.fields.notes')}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>

    <Modal open={Boolean(touchLeadId)} title={t('leads.touchForm.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={touchSaving} onOk={() => touchForm.submit()} onCancel={() => setTouchLeadId(undefined)} destroyOnHidden>
      <Form<TouchValues> form={touchForm} layout="vertical" requiredMark={false} onFinish={(values) => void submitTouch(values)}>
        <Form.Item name="status" label={t('leads.touchForm.status')} rules={[{ required: true }]}><Select options={touchStatusOptions} /></Form.Item>
        <Form.Item name="comment" label={t('leads.touchForm.comment')} rules={[{ required: true, whitespace: true, message: t('leads.validation.comment') }]}><Input.TextArea rows={3} placeholder={t('leads.touchForm.commentPlaceholder')} /></Form.Item>
        {touchStatus === 'CALL_BACK' && <Form.Item name="callBackAt" label={t('leads.touchForm.callBackAt')} rules={[{ required: true, message: t('leads.validation.callBackAt') }]}><DatePicker showTime format="DD.MM.YYYY HH:mm" className="full-width" /></Form.Item>}
        {touchStatus === 'NOT_INTERESTED' && <Form.Item name="notInterestedReason" label={t('leads.touchForm.notInterestedReason')} rules={[{ required: true, message: t('leads.validation.notInterestedReason') }]}><Select options={reasonOptions} /></Form.Item>}
        {touchStatus === 'NOT_INTERESTED' && touchReason === 'OTHER' && <Form.Item name="notInterestedComment" label={t('leads.touchForm.notInterestedComment')} rules={[{ required: true, whitespace: true, message: t('leads.validation.notInterestedComment') }]}><Input.TextArea rows={2} /></Form.Item>}
      </Form>
    </Modal>

    <Modal open={Boolean(convertLeadId)} title={t('leads.convertForm.title')} okText={t('leads.detail.convert')} cancelText={t('common.cancel')} confirmLoading={convertSaving} onOk={() => convertForm.submit()} onCancel={() => setConvertLeadId(undefined)} destroyOnHidden>
      <Form<{ legalEntityId: string }> form={convertForm} layout="vertical" requiredMark={false} onFinish={(values) => void submitConvert(values)}>
        <Form.Item name="legalEntityId" label={t('leads.convertForm.legalEntity')} rules={[{ required: true, message: t('leads.validation.legalEntity') }]}>
          <Select options={legalEntities.map((item) => ({ value: item.id, label: `${item.name} (${item.numberingPrefix})` }))} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal open={assignOpen} title={t('leads.assignForm.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={assignSaving} onOk={() => assignForm.submit()} onCancel={() => setAssignOpen(false)} destroyOnHidden>
      {!canSelectUsers && <Alert type="warning" showIcon className="form-alert" message={t('leads.assignForm.noUsersAccess')} />}
      <Form<{ responsibleId: string }> form={assignForm} layout="vertical" requiredMark={false} onFinish={(values) => void submitAssign(values)}>
        <Form.Item name="responsibleId" label={t('leads.assignForm.responsible')} rules={[{ required: true, message: t('leads.validation.responsible') }]}>
          <Select options={managers.map((item) => ({ value: item.id, label: item.fullName }))} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal open={distributeOpen} title={t('leads.distributeForm.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={distributeSaving} onOk={() => distributeForm.submit()} onCancel={() => setDistributeOpen(false)} destroyOnHidden>
      {!canSelectUsers && <Alert type="warning" showIcon className="form-alert" message={t('leads.assignForm.noUsersAccess')} />}
      <Form<{ managerIds: string[] }> form={distributeForm} layout="vertical" requiredMark={false} onFinish={(values) => void submitDistribute(values)}>
        <Form.Item name="managerIds" label={t('leads.distributeForm.managers')} rules={[{ required: true, type: 'array', min: 1, message: t('leads.validation.managers') }]}>
          <Select mode="multiple" options={managers.map((item) => ({ value: item.id, label: item.fullName }))} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      open={importOpen}
      title={t('leads.import.title')}
      width={860}
      onCancel={closeImport}
      footer={importResult
        ? <Button type="primary" onClick={closeImport}>{t('leads.import.done')}</Button>
        : importStep === 'mapping'
          ? [
            <Button key="back" onClick={() => setImportStep('source')}>{t('common.cancel')}</Button>,
            <Button key="submit" type="primary" loading={importSaving} disabled={mappedNameIndex === undefined} onClick={() => void submitImport()}>{t('leads.import.submit')}</Button>,
          ]
          : null}
      destroyOnHidden
    >
      {importResult ? <div className="leads-import-result">
        <Alert type="success" showIcon message={t('leads.import.result.title')} />
        <div className="leads-import-result-grid">
          <div><span>{t('leads.import.result.total')}</span><strong>{importResult.rowsTotal}</strong></div>
          <div><span>{t('leads.import.result.created')}</span><strong>{importResult.rowsCreated}</strong></div>
          <div><span>{t('leads.import.result.existingClient')}</span><strong>{importResult.rowsExistingClient}</strong></div>
          <div><span>{t('leads.import.result.duplicate')}</span><strong>{importResult.rowsDuplicateLead}</strong></div>
        </div>
      </div> : importStep === 'source' ? <div className="leads-import-source">
        <div>
          <Typography.Paragraph>{t('leads.import.uploadHint')}</Typography.Paragraph>
          <input id="leads-import-file" type="file" accept=".csv,.txt" onChange={handleFileChange} style={{ display: 'none' }} />
          <Button icon={<UploadOutlined />} onClick={() => document.getElementById('leads-import-file')?.click()}>{t('leads.import.uploadButton')}</Button>
        </div>
        <Divider>{t('common.or')}</Divider>
        <div>
          <Typography.Paragraph>{t('leads.import.pasteLabel')}</Typography.Paragraph>
          <Input.TextArea rows={6} value={importPasteText} onChange={(event) => setImportPasteText(event.target.value)} placeholder={t('leads.import.pastePlaceholder')} />
          <Button className="leads-import-paste-apply" disabled={!importPasteText.trim()} onClick={applyPaste}>{t('leads.import.pasteApply')}</Button>
        </div>
      </div> : <div className="leads-import-mapping">
        <Typography.Paragraph type="secondary">{t('leads.import.mappingHint')}</Typography.Paragraph>
        {canPickDepartment && <Select allowClear className="full-width leads-import-department" value={importDepartmentId} onChange={setImportDepartmentId} placeholder={t('leads.import.department')} options={departments.map((item) => ({ value: item.id, label: item.name }))} />}
        <div className="leads-import-mapping-grid">
          {importHeaders.map((header, index) => <div key={index} className="leads-import-mapping-row">
            <span>{header || t('leads.import.column', { number: index + 1 })}</span>
            <Select
              allowClear
              value={importMapping[index] || undefined}
              placeholder={t('leads.import.skipColumn')}
              onChange={(value) => setImportMapping((current) => ({ ...current, [index]: (value as LeadImportField) || '' }))}
              options={LEAD_IMPORT_FIELDS.map((field) => ({ value: field, label: t(`leads.fields.${field}`) }))}
            />
          </div>)}
        </div>
        {mappedNameIndex === undefined && <Alert type="warning" showIcon className="form-alert" message={t('leads.import.needName')} />}
        <Typography.Paragraph className="leads-import-rows-count">{t('leads.import.rowsFound', { count: importRows.length })}</Typography.Paragraph>
      </div>}
    </Modal>

    <Modal open={historyOpen} title={t('leads.history.title')} footer={null} width={860} onCancel={() => setHistoryOpen(false)} destroyOnHidden>
      <Table<ImportBatchRecord>
        rowKey="id"
        loading={historyLoading}
        dataSource={importBatches}
        pagination={false}
        scroll={{ x: 640 }}
        locale={{ emptyText: t('leads.history.empty') }}
        columns={[
          { title: t('leads.history.columns.file'), dataIndex: 'fileName', key: 'fileName' },
          { title: t('leads.history.columns.date'), key: 'date', render: (_, item) => new Date(item.createdAt).toLocaleString('ru-RU') },
          { title: t('leads.history.columns.importedBy'), key: 'importedBy', render: (_, item) => item.importedBy.fullName },
          { title: t('leads.history.columns.total'), dataIndex: 'rowsTotal', key: 'rowsTotal' },
          { title: t('leads.history.columns.created'), dataIndex: 'rowsCreated', key: 'rowsCreated' },
          { title: t('leads.history.columns.existingClient'), dataIndex: 'rowsExistingClient', key: 'rowsExistingClient' },
          { title: t('leads.history.columns.duplicate'), dataIndex: 'rowsDuplicateLead', key: 'rowsDuplicateLead' },
        ]}
      />
    </Modal>
  </>;
}

function LeadDetail({ lead, onEdit, onTouch, onConvert, onGoToDeal }: {
  lead: LeadRecord;
  onEdit: () => void;
  onTouch: () => void;
  onConvert: () => void;
  onGoToDeal: () => void;
}) {
  const { t } = useTranslation();
  const canConvert = lead.status !== 'CONVERTED' && Boolean(lead.responsibleId);

  return <div className="leads-detail">
    <div className="leads-detail-tags">
      <Tag bordered={false} style={LEAD_STATUS_COLORS[lead.status]}>{t(`leads.status.${lead.status}`)}</Tag>
      {lead.isExistingClient && <Tag color="gold">{t('leads.existingClientTag')}{lead.matchedContractor ? `: ${lead.matchedContractor.name}` : ''}</Tag>}
    </div>

    <div className="contractor-detail-grid leads-detail-grid">
      <DetailValue label={t('leads.fields.phone')} value={lead.phone} />
      <DetailValue label={t('leads.fields.bin')} value={lead.bin} />
      <DetailValue label={t('leads.fields.city')} value={lead.city} />
      <DetailValue label={t('leads.fields.contactName')} value={lead.contactName} />
      <DetailValue label={t('leads.fields.email')} value={lead.email} />
      <DetailValue label={t('leads.columns.responsible')} value={lead.responsible?.fullName ?? t('leads.detail.unassigned')} />
      <DetailValue label={t('leads.columns.department')} value={lead.department?.name} />
      <DetailValue label={t('leads.detail.source')} value={t(`leads.source.${lead.source}`)} />
      {lead.importBatch && <DetailValue label={t('leads.detail.importSource')} value={`${lead.importBatch.fileName} (${new Date(lead.importBatch.createdAt).toLocaleDateString('ru-RU')})`} />}
      <DetailValue label={t('leads.fields.notes')} value={lead.notes} />
    </div>

    {lead.status === 'NOT_INTERESTED' && <Alert type="warning" showIcon message={t(`leads.notInterestedReasons.${lead.notInterestedReason}`)} description={lead.notInterestedComment || undefined} />}

    {lead.convertedDeal ? <Alert type="success" showIcon message={t('leads.detail.convertedInfo', { number: lead.convertedDeal.number })} action={<Button size="small" onClick={onGoToDeal}>{t('leads.detail.goToDeal')}</Button>} /> : <div className="leads-detail-actions">
      <Button onClick={onEdit}>{t('leads.detail.edit')}</Button>
      <Button type="primary" onClick={onTouch}>{t('leads.detail.touch')}</Button>
      <Button disabled={!canConvert} onClick={onConvert}>{t('leads.detail.convert')}</Button>
      {!lead.responsibleId && <span className="leads-detail-hint">{t('leads.detail.convertNeedsResponsible')}</span>}
    </div>}

    <Divider>{t('leads.detail.history.title')}</Divider>
    {lead.activities?.length ? <div className="history-list">
      {lead.activities.map((activity) => <div key={activity.id}>
        <Typography.Text strong>{t(`leads.status.${activity.fromStatus}`)} → {t(`leads.status.${activity.toStatus}`)}</Typography.Text>
        <span>{activity.comment}</span>
        <small>{activity.user.fullName} · {new Date(activity.createdAt).toLocaleString('ru-RU')}{activity.callBackAt ? ` · ${t('leads.touchForm.callBackAt')}: ${new Date(activity.callBackAt).toLocaleString('ru-RU')}` : ''}</small>
      </div>)}
    </div> : <Typography.Text type="secondary">{t('leads.detail.history.empty')}</Typography.Text>}
  </div>;
}

function DetailValue({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTranslation();
  return <div><span>{label}</span><strong>{value || t('common.dash')}</strong></div>;
}
