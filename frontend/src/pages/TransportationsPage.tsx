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
  Pagination,
  Popover,
  Skeleton,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
const PAGE_SIZE = 20;
const PRIMARY_KEYS = new Set<ColumnKey>(['num', 'client', 'route', 'transport', 'leg', 'status', 'plan', 'fact']);
const STATUS_COLORS: Record<TransportationStatus, { background: string; color: string }> = {
  REQUEST_ACCEPTED: { background: 'var(--indigo-soft)', color: 'var(--indigo-fg)' },
  CARGO_PICKED: { background: 'var(--teal-soft)', color: 'var(--teal-fg)' },
  IN_TRANSIT: { background: 'var(--amber-soft)', color: 'var(--amber-fg)' },
  CUSTOMS: { background: 'var(--purple-soft)', color: 'var(--purple-fg)' },
  DELIVERED: { background: 'var(--green-soft)', color: 'var(--green-fg)' },
  CLOSED: { background: 'var(--card2)', color: 'var(--text3)' },
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

function currentLeg(item: Transportation): TransportationLeg | undefined {
  return item.legs.find((leg) => leg.status === 'IN_PROGRESS')
    ?? item.legs.find((leg) => leg.status === 'WAITING')
    ?? item.legs.at(-1);
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
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get('search') ?? '';
  const [toast, contextHolder] = message.useMessage();
  const [rows, setRows] = useState<Transportation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(routeSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(routeSearch.trim());
  const [status, setStatus] = useState<TransportationStatus | 'ALL'>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [settings, setSettings] = useState<ColumnSetting[]>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<ColumnKey>();
  const [currentPage, setCurrentPage] = useState(1);
  const lastSavedSettings = useRef('');
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  const showError = useCallback((error: unknown) => {
    void toast.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [t, toast]);

  useEffect(() => {
    setSearch(routeSearch);
    setDebouncedSearch(routeSearch.trim());
  }, [routeSearch]);

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

  const visibleKeys = useMemo(
    () => new Set(settings.filter((item) => item.visible).map((item) => item.key)),
    [settings],
  );
  const additionalSettings = useMemo(
    () => settings.filter((item) => item.visible && !PRIMARY_KEYS.has(item.key)),
    [settings],
  );
  const overdueCount = useMemo(
    () => rows.filter((item) => overdueDays(item) > 0).length,
    [rows],
  );
  const pagedRows = useMemo(() => {
    const firstIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(firstIndex, firstIndex + PAGE_SIZE);
  }, [currentPage, filteredRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, includeDeleted, onlyOverdue, status]);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    setCurrentPage((page) => Math.min(page, lastPage));
  }, [filteredRows.length]);

  const additionalValue = (key: ColumnKey, item: Transportation): string | number => {
    switch (key) {
      case 'manager': return item.logist.fullName;
      case 'vehicle': return item.legs[0]?.vehicleNumber || t('common.dash');
      case 'weight': return formatNumber(item.weightKg);
      case 'volume': return formatNumber(item.volumeM3);
      case 'legsCount': return item.legs.length;
      default: return t('common.dash');
    }
  };
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
          data-column-key={item.key}
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
          <button type="button" key={value} className={`status-chip${status === value ? ' active' : ''}`} onClick={() => setStatus(value)}>
            {status === value && <CheckOutlined />}{t(value === 'ALL' ? 'transportations.statuses.ALL' : `transportations.statuses.${value}`)} <strong>{counts[value]}</strong>
          </button>
        ))}
      </div>

      <div className="transportation-filters">
        <Input.Search allowClear value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('transportations.filters.search')} />
        <span className="transportation-overdue-filter">
          <Checkbox checked={onlyOverdue} onChange={(event) => setOnlyOverdue(event.target.checked)}>{t('transportations.filters.onlyOverdue')}</Checkbox>
          <strong>{overdueCount}</strong>
        </span>
        {isAdmin && <Checkbox className="transportation-deleted-filter" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)}>{t('transportations.filters.includeDeleted')}</Checkbox>}
        {hasFilters && <Button type="text" className="transportation-reset-filters" onClick={resetFilters}>{t('transportations.filters.reset')}</Button>}
        <Popover trigger="click" placement="bottomRight" open={settingsOpen} onOpenChange={setSettingsOpen} content={settingsContent}>
          <Button className="transportation-settings-button" icon={<SettingOutlined />}>{t('transportations.settings.button')}</Button>
        </Popover>
      </div>

      {loading ? (
        <div className="transportation-card-list" aria-label={t('transportations.loading')}>
          <div className="transportation-card-list-inner">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="transportation-card transportation-card-skeleton" key={index}>
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
              </div>
            ))}
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="transportation-empty">
          <strong>{t(hasFilters ? 'transportations.empty.filteredTitle' : 'transportations.empty.initialTitle')}</strong>
          <span>{t(hasFilters ? 'transportations.empty.filteredDescription' : 'transportations.empty.initialDescription')}</span>
        </div>
      ) : (
        <div className="transportation-card-list">
          <div className="transportation-card-list-inner">
            {pagedRows.map((item) => {
              const leg = currentLeg(item);
              const daysOverdue = overdueDays(item);
              const showRouteBlock = visibleKeys.has('route') || visibleKeys.has('transport') || visibleKeys.has('leg');

              return (
                <article
                  className={`transportation-card${daysOverdue > 0 ? ' overdue' : ''}${item.deletedAt ? ' deleted' : ''}`}
                  data-transportation-id={item.id}
                  data-overdue={daysOverdue > 0}
                  data-deleted={Boolean(item.deletedAt)}
                  key={item.id}
                  role="link"
                  tabIndex={0}
                  aria-label={t('transportations.actions.open', { number: item.number })}
                  onClick={() => navigate(`/transportations/${item.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/transportations/${item.id}`);
                    }
                  }}
                >
                  <div className="transportation-card-main">
                    <div className="transportation-card-number-cell" data-field-key="num">
                      <span className="transportation-number">{item.number}</span>
                      {item.deletedAt && <span className="transportation-deleted-mark">{t('transportations.values.deleted')}</span>}
                    </div>

                    {showRouteBlock && (
                      <div className="transportation-card-route-cell">
                        {visibleKeys.has('route') && (
                          <div className="transportation-card-route" data-field-key="route">
                            {t('transportations.values.route', { from: item.originPoint, to: item.destinationPoint })}
                          </div>
                        )}
                        {(visibleKeys.has('transport') || visibleKeys.has('leg')) && (
                          <div className="transportation-card-route-meta">
                            {visibleKeys.has('transport') && (
                              <span data-field-key="transport">{t(`transportations.transportModes.${item.transportMode}`)}</span>
                            )}
                            {visibleKeys.has('transport') && visibleKeys.has('leg') && <span aria-hidden="true">·</span>}
                            {visibleKeys.has('leg') && (
                              <span data-field-key="leg">
                                {leg
                                  ? t('transportations.values.route', { from: leg.fromPoint, to: leg.toPoint })
                                  : t('common.dash')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {visibleKeys.has('client') && (
                      <div className="transportation-card-client" data-field-key="client">{item.deal.client.name}</div>
                    )}
                    {visibleKeys.has('status') && (
                      <div className="transportation-card-status" data-field-key="status">
                        <Tag bordered={false} style={STATUS_COLORS[item.status]}>{t(`transportations.statuses.${item.status}`)}</Tag>
                      </div>
                    )}
                    {visibleKeys.has('plan') && (
                      <div
                        className={`transportation-card-date${daysOverdue > 0 ? ' overdue' : ''}`}
                        data-field-key="plan"
                        title={t('transportations.columns.plan')}
                      >
                        <span>{formatDate(item.plannedDeliveryDate)}</span>
                        {daysOverdue > 0 && <small>{t('transportations.values.overdue', { days: daysOverdue })}</small>}
                      </div>
                    )}
                    {visibleKeys.has('fact') && (
                      <div className="transportation-card-date transportation-card-fact" data-field-key="fact" title={t('transportations.columns.fact')}>
                        {formatDate(item.actualDeliveryDate ?? item.unloadingEventDate)}
                      </div>
                    )}
                  </div>

                  {additionalSettings.length > 0 && (
                    <div className="transportation-card-details">
                      {additionalSettings.map(({ key }) => (
                        <div className="transportation-card-detail" data-field-key={key} key={key}>
                          <span>{t(`transportations.columns.${key}`)}:</span>
                          <strong>{additionalValue(key, item)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filteredRows.length > 0 && (
        <div className="transportation-pagination">
          <span>{t('transportations.footer.shown', { shown: pagedRows.length, total: filteredRows.length })}</span>
          <Pagination
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={filteredRows.length}
            showSizeChanger={false}
            onChange={setCurrentPage}
          />
        </div>
      )}
      <div className="transportations-footer">
        <span>{t('transportations.footer.summary', { shown: filteredRows.length, total: rows.length, overdue: filteredRows.filter((item) => overdueDays(item) > 0).length })}</span>
        <span>{t('transportations.footer.hint')}</span>
      </div>
    </section>
  </>;
}
