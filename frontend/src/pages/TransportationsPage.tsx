import {
  CheckOutlined,
  HolderOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Input,
  Popover,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type TransportationStatus =
  | 'REQUEST_ACCEPTED'
  | 'CARGO_PICKED'
  | 'IN_TRANSIT'
  | 'CUSTOMS'
  | 'DELIVERED'
  | 'CLOSED';
type TransportMode = 'AUTO' | 'RAIL' | 'SEA' | 'AIR' | 'MULTIMODAL';
type LegStatus = 'WAITING' | 'IN_PROGRESS' | 'DONE';

interface TransportationLeg {
  id: string;
  orderIndex: number;
  fromPoint: string;
  toPoint: string;
  mode: Exclude<TransportMode, 'MULTIMODAL'> | 'BROKER';
  status: LegStatus;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  vehicleNumber: string | null;
  subcontractor: { id: string; name: string } | null;
}

interface Transportation {
  id: string;
  number: string;
  status: TransportationStatus;
  cargoName: string | null;
  placesCount: number | null;
  placesUnit: string | null;
  weightKg: string | number | null;
  volumeM3: string | number | null;
  originPoint: string;
  destinationPoint: string;
  transportMode: TransportMode;
  plannedDeliveryDate: string | null;
  pickupEventDate: string | null;
  unloadingEventDate: string | null;
  actualDeliveryDate: string | null;
  deletedAt: string | null;
  deal: {
    id: string;
    number: string;
    client: { id: string; name: string };
    legalEntity: { id: string; name: string };
  };
  logist: { id: string; fullName: string };
  legs: TransportationLeg[];
}

const COLUMN_KEYS = [
  'num', 'client', 'route', 'transport', 'leg', 'status', 'plan', 'fact', 'manager',
  'vehicle', 'weight', 'volume', 'legsCount',
] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
interface ColumnSetting { key: ColumnKey; visible: boolean }
interface SettingsResponse { columns: unknown }

const DEFAULT_HIDDEN = new Set<ColumnKey>(['vehicle', 'weight', 'volume', 'legsCount']);
const DEFAULT_SETTINGS: ColumnSetting[] = COLUMN_KEYS.map((key) => ({
  key,
  visible: key === 'num' || !DEFAULT_HIDDEN.has(key),
}));
const FINAL_STATUSES = new Set<TransportationStatus>(['DELIVERED', 'CLOSED']);
const STATUS_COLORS: Record<TransportationStatus, { background: string; color: string }> = {
  REQUEST_ACCEPTED: { background: '#E7E9FD', color: '#4F46E5' },
  CARGO_PICKED: { background: '#D5F0EC', color: '#0F766E' },
  IN_TRANSIT: { background: '#FDF0D5', color: '#B45309' },
  CUSTOMS: { background: '#EFE9FD', color: '#7C3AED' },
  DELIVERED: { background: '#DCF5E4', color: '#15803D' },
  CLOSED: { background: '#EDF0F4', color: '#66707D' },
};

function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function todayOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function actualDelivery(item: Transportation): Date | null {
  return dateOnly(item.actualDeliveryDate ?? item.unloadingEventDate);
}

function overdueDays(item: Transportation): number {
  const plan = dateOnly(item.plannedDeliveryDate);
  if (!plan) return 0;
  const actual = actualDelivery(item);
  if (actual && actual > plan) return daysBetween(plan, actual);
  const today = todayOnly();
  return !FINAL_STATUSES.has(item.status) && today > plan ? daysBetween(plan, today) : 0;
}

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
    normalized.push({ key, visible: key === 'num' ? true : candidate.visible === true });
  }
  for (const item of DEFAULT_SETTINGS) {
    if (!seen.has(item.key)) normalized.push(item);
  }
  return normalized;
}

export function TransportationsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, contextHolder] = message.useMessage();
  const [rows, setRows] = useState<Transportation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<TransportationStatus | 'ALL'>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [settings, setSettings] = useState<ColumnSetting[]>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<ColumnKey>();
  const lastSavedSettings = useRef('');
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  const showError = useCallback((error: unknown) => {
    void toast.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [t, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (isAdmin && includeDeleted) params.set('includeDeleted', 'true');
        const query = params.toString();
        const transportations = await apiRequest<Transportation[]>(`/transportations${query ? `?${query}` : ''}`);
        if (!active) return;
        setRows(transportations);
      } catch (error: unknown) {
        if (active) showError(error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [debouncedSearch, includeDeleted, isAdmin, showError]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const saved = await apiRequest<SettingsResponse | null>('/me/table-settings/transportations');
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
        await apiRequest<SettingsResponse>('/me/table-settings/transportations', {
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

  const formatDate = useCallback((value: string | null) => {
    const date = dateOnly(value);
    return date ? new Intl.DateTimeFormat(i18n.language).format(date) : t('common.dash');
  }, [i18n.language, t]);
  const formatNumber = useCallback((value: string | number | null, maximumFractionDigits = 3) => (
    value === null ? t('common.dash') : new Intl.NumberFormat(i18n.language, { maximumFractionDigits }).format(Number(value))
  ), [i18n.language, t]);

  const nonStatusFiltered = useMemo(() => {
    return rows.filter((item) => {
      return !onlyOverdue || overdueDays(item) > 0;
    });
  }, [onlyOverdue, rows]);

  const filteredRows = useMemo(() => nonStatusFiltered.filter(
    (item) => status === 'ALL' || item.status === status,
  ), [nonStatusFiltered, status]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(
      ['ALL', ...Object.keys(STATUS_COLORS)].map((key) => [key, 0]),
    ) as Record<TransportationStatus | 'ALL', number>;
    result.ALL = nonStatusFiltered.length;
    nonStatusFiltered.forEach((item) => { result[item.status] += 1; });
    return result;
  }, [nonStatusFiltered]);

  const allColumns = useMemo<Record<ColumnKey, ColumnsType<Transportation>[number]>>(() => ({
    num: {
      title: t('transportations.columns.num'), key: 'num', fixed: 'left', width: 205,
      render: (_, item) => <div><Typography.Text strong className="transportation-number">{item.number}</Typography.Text><div className="table-cell-secondary">{item.cargoName || t('common.dash')}</div></div>,
    },
    client: { title: t('transportations.columns.client'), key: 'client', width: 190, render: (_, item) => item.deal.client.name },
    route: { title: t('transportations.columns.route'), key: 'route', width: 220, render: (_, item) => t('transportations.values.route', { from: item.originPoint, to: item.destinationPoint }) },
    transport: { title: t('transportations.columns.transport'), key: 'transport', width: 155, render: (_, item) => t(`transportations.transportModes.${item.transportMode}`) },
    leg: {
      title: t('transportations.columns.leg'), key: 'leg', width: 240,
      render: (_, item) => {
        const leg = item.legs[0];
        return leg ? <div>{t('transportations.values.route', { from: leg.fromPoint, to: leg.toPoint })}<div className="table-cell-secondary">{leg.subcontractor?.name || t('common.dash')}</div></div> : t('common.dash');
      },
    },
    status: {
      title: t('transportations.columns.status'), key: 'status', width: 155,
      render: (_, item) => <Tag bordered={false} style={STATUS_COLORS[item.status]}>{t(`transportations.statuses.${item.status}`)}</Tag>,
    },
    plan: {
      title: t('transportations.columns.plan'), key: 'plan', width: 150,
      render: (_, item) => <div>{formatDate(item.plannedDeliveryDate)}{overdueDays(item) > 0 && <div className="overdue-note">{t('transportations.values.overdue', { days: overdueDays(item) })}</div>}</div>,
    },
    fact: { title: t('transportations.columns.fact'), key: 'fact', width: 150, render: (_, item) => formatDate(item.actualDeliveryDate ?? item.unloadingEventDate) },
    manager: { title: t('transportations.columns.manager'), key: 'manager', width: 180, render: (_, item) => item.logist.fullName },
    vehicle: { title: t('transportations.columns.vehicle'), key: 'vehicle', width: 185, render: (_, item) => item.legs[0]?.vehicleNumber || t('common.dash') },
    weight: { title: t('transportations.columns.weight'), key: 'weight', width: 120, align: 'right', render: (_, item) => formatNumber(item.weightKg) },
    volume: { title: t('transportations.columns.volume'), key: 'volume', width: 120, align: 'right', render: (_, item) => formatNumber(item.volumeM3) },
    legsCount: { title: t('transportations.columns.legsCount'), key: 'legsCount', width: 115, align: 'right', render: (_, item) => item.legs.length },
  }), [formatDate, formatNumber, t]);

  const columns = useMemo(() => settings.filter((item) => item.visible).map((item) => allColumns[item.key]), [allColumns, settings]);
  const resetFilters = () => {
    setSearch(''); setStatus('ALL'); setOnlyOverdue(false); setIncludeDeleted(false);
  };
  const hasFilters = Boolean(search || status !== 'ALL' || onlyOverdue || includeDeleted);

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
    <div className="column-settings-title">{t('transportations.settings.title')}</div>
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
            disabled={item.key === 'num'}
            onChange={(event) => setSettings((current) => current.map((column) => column.key === item.key ? { ...column, visible: event.target.checked } : column))}
          />
          <span>{t(`transportations.columns.${item.key}`)}</span>
          {item.key === 'legsCount' && <span className="calculated-mark">{t('transportations.settings.calculated')}</span>}
        </div>
      ))}
    </div>
    <Button type="text" danger block className="column-settings-reset" onClick={() => setSettings(DEFAULT_SETTINGS)}>{t('transportations.settings.reset')}</Button>
    <div className="column-settings-help">{t('transportations.settings.help')}</div>
  </div>;

  return <>
    {contextHolder}
    <section className="transportations-page">
      <div className="transportations-heading">
        <Typography.Title level={2}>{t('transportations.title')}</Typography.Title>
        <div className="transportations-heading-side">
          <Typography.Text type="secondary">{t('transportations.scope.currentUser', { name: user?.fullName })}</Typography.Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/transportations/new')}>{t('transportations.actions.create')}</Button>
        </div>
      </div>

      <div className="status-chips" role="group" aria-label={t('transportations.filters.status')}>
        {(['ALL', ...Object.keys(STATUS_COLORS)] as Array<TransportationStatus | 'ALL'>).map((value) => (
          <button key={value} className={`status-chip${status === value ? ' active' : ''}`} onClick={() => setStatus(value)}>
            {status === value && <CheckOutlined />}{t(value === 'ALL' ? 'transportations.statuses.ALL' : `transportations.statuses.${value}`)} <strong>{counts[value]}</strong>
          </button>
        ))}
      </div>

      <div className="transportation-filters">
        <Input.Search allowClear value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('transportations.filters.search')} />
        <Checkbox checked={onlyOverdue} onChange={(event) => setOnlyOverdue(event.target.checked)}>{t('transportations.filters.onlyOverdue')}</Checkbox>
        {isAdmin && <Checkbox checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)}>{t('transportations.filters.includeDeleted')}</Checkbox>}
        {hasFilters && <Button type="text" onClick={resetFilters}>{t('transportations.filters.reset')}</Button>}
        <Popover trigger="click" placement="bottomRight" open={settingsOpen} onOpenChange={setSettingsOpen} content={settingsContent}>
          <Button icon={<SettingOutlined />}>{t('transportations.settings.button')}</Button>
        </Popover>
      </div>

      <Table<Transportation>
        className="transportations-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredRows}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('transportations.footer.shown', { shown: total, total: filteredRows.length }) }}
        locale={{ emptyText: t('transportations.empty') }}
        rowClassName={(item) => [overdueDays(item) > 0 ? 'overdue-row' : '', item.deletedAt ? 'inactive-row' : ''].filter(Boolean).join(' ')}
        onRow={(item) => ({ onClick: () => navigate(`/transportations/${item.id}`) })}
      />
      <div className="transportations-footer">
        <span>{t('transportations.footer.summary', { shown: filteredRows.length, total: rows.length, overdue: filteredRows.filter((item) => overdueDays(item) > 0).length })}</span>
        <span>{t('transportations.footer.hint')}</span>
      </div>
    </section>
  </>;
}
