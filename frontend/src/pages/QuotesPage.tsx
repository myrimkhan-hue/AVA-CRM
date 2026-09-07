import { PlusOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Input, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DEAL_STAGE_COLORS } from '../deals/shared';
import {
  QUOTE_STAGES,
  Quote,
  QuoteListResponse,
  QuoteReference,
  QuoteStage,
  QuoteUserReference,
  hasManagerQuoteRights,
} from '../quotes/shared';

const PAGE_SIZE = 20;
/** Значение фильтра «Логист» для свободных просчётов: не id сотрудника, а признак «никто не назначен». */
const UNASSIGNED = '__unassigned__';

export function QuotesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Quote[]>([]);
  const [users, setUsers] = useState<QuoteUserReference[]>([]);
  const [departments, setDepartments] = useState<QuoteReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<QuoteStage>();
  const [responsibleId, setResponsibleId] = useState<string>();
  const [logistId, setLogistId] = useState<string>();
  const [departmentId, setDepartmentId] = useState<string>();
  const [period, setPeriod] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const mayCreate = hasManagerQuoteRights(user?.roles);

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (stage) params.set('stage', stage);
      if (responsibleId) params.set('responsibleId', responsibleId);
      // Отдельного контрола под «свободные» нет: это пункт в том же выборе логиста.
      if (logistId === UNASSIGNED) params.set('unassigned', 'true');
      else if (logistId) params.set('logistId', logistId);
      if (departmentId) params.set('departmentId', departmentId);
      if (period?.[0]) params.set('from', period[0].format('YYYY-MM-DD'));
      if (period?.[1]) params.set('to', period[1].format('YYYY-MM-DD'));
      const result = await apiRequest<QuoteListResponse>(`/quotes?${params.toString()}`);
      setRows(result.items);
      setTotal(result.total);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [departmentId, logistId, page, period, responsibleId, search, showError, stage]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    Promise.all([
      apiRequest<QuoteUserReference[]>('/references/users'),
      apiRequest<QuoteReference[]>('/departments'),
    ]).then(([userRows, departmentRows]) => {
      setUsers(userRows);
      setDepartments(departmentRows);
    }).catch(showError);
  }, [showError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const formatDate = useCallback((value: string) => new Intl.DateTimeFormat(
    i18n.language,
    { dateStyle: 'medium' },
  ).format(new Date(value)), [i18n.language]);

  const formatNumber = useCallback((value: string | number | null) => {
    if (value === null) return t('common.dash');
    return new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(Number(value));
  }, [i18n.language, t]);

  const formatMoney = useCallback((value: string | number | null, currency: string | null) => {
    if (value === null || !currency) return t('common.dash');
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }, [i18n.language, t]);

  const stageTag = useCallback((value: QuoteStage) => (
    <Tag bordered={false} style={DEAL_STAGE_COLORS[value]}>
      {t(`deals.stages.${value}`)}
    </Tag>
  ), [t]);

  const columns = useMemo<ColumnsType<Quote>>(() => [
    {
      title: t('quotes.columns.number'),
      dataIndex: 'number',
      width: 145,
      render: (value: string) => <span className="transportation-number">{value}</span>,
    },
    {
      title: t('quotes.columns.client'),
      key: 'client',
      width: 210,
      render: (_, row) => row.deal.client.name,
    },
    {
      title: t('quotes.columns.route'),
      key: 'route',
      width: 250,
      render: (_, row) => t('quotes.values.route', {
        from: row.originPoint,
        to: row.destinationPoint,
      }),
    },
    {
      title: t('quotes.columns.cargo'),
      dataIndex: 'cargoName',
      width: 180,
      render: (value: string | null) => value || t('common.dash'),
    },
    {
      title: t('quotes.columns.weight'),
      dataIndex: 'weightKg',
      width: 105,
      render: (value: string | number | null) => formatNumber(value),
    },
    {
      title: t('quotes.columns.stage'),
      key: 'stage',
      width: 160,
      render: (_, row) => stageTag(row.deal.stage),
    },
    {
      title: t('quotes.columns.responsible'),
      key: 'responsible',
      width: 185,
      render: (_, row) => row.deal.responsible.fullName,
    },
    {
      title: t('quotes.columns.logist'),
      key: 'logist',
      width: 185,
      render: (_, row) => row.logist?.fullName ?? (
        <Tag bordered={false} className="quote-unassigned-tag">
          {t('quotes.values.unassigned')}
        </Tag>
      ),
    },
    {
      title: t('quotes.columns.clientTargetRate'),
      key: 'clientTargetRate',
      width: 165,
      align: 'right',
      render: (_, row) => formatMoney(
        row.deal.clientTargetRate,
        row.deal.clientTargetRateCurrency,
      ),
    },
    {
      title: t('quotes.columns.createdAt'),
      dataIndex: 'createdAt',
      width: 130,
      render: formatDate,
    },
  ], [formatDate, formatMoney, formatNumber, stageTag, t]);

  const managers = users.filter((item) => item.roles.some(
    (role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role),
  ));
  const logists = users.filter((item) => item.roles.includes('LOGIST'));

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStage(undefined);
    setResponsibleId(undefined);
    setLogistId(undefined);
    setDepartmentId(undefined);
    setPeriod(null);
    setPage(1);
  };

  const hasFilters = Boolean(searchInput || stage || responsibleId || logistId || departmentId || period);

  return (
    <section className="quotes-page">
      <div className="quotes-heading">
        <div>
          <Typography.Title level={2}>{t('quotes.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('quotes.subtitle')}</Typography.Text>
        </div>
        {mayCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotes/new')}>
            {t('quotes.actions.create')}
          </Button>
        )}
      </div>

      <div className="quote-filters">
        <Input.Search
          allowClear
          value={searchInput}
          placeholder={t('quotes.filters.search')}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Select
          allowClear
          value={stage}
          placeholder={t('quotes.filters.stage')}
          options={QUOTE_STAGES.map((value) => ({
            value,
            label: t(`deals.stages.${value}`),
          }))}
          onChange={(value) => { setStage(value); setPage(1); }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          value={responsibleId}
          placeholder={t('quotes.filters.responsible')}
          options={managers.map((item) => ({ value: item.id, label: item.fullName }))}
          onChange={(value) => { setResponsibleId(value); setPage(1); }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          value={logistId}
          placeholder={t('quotes.filters.logist')}
          options={[
            { value: UNASSIGNED, label: t('quotes.values.unassigned') },
            ...logists.map((item) => ({ value: item.id, label: item.fullName })),
          ]}
          onChange={(value) => { setLogistId(value); setPage(1); }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          value={departmentId}
          placeholder={t('quotes.filters.department')}
          options={departments.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => { setDepartmentId(value); setPage(1); }}
        />
        <DatePicker.RangePicker
          className="full-width"
          value={period}
          placeholder={[t('quotes.filters.from'), t('quotes.filters.to')]}
          onChange={(value) => { setPeriod(value); setPage(1); }}
        />
        {hasFilters && (
          <Button type="text" onClick={resetFilters}>{t('quotes.filters.reset')}</Button>
        )}
      </div>

      <Table<Quote>
        className="quotes-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1700 }}
        locale={{ emptyText: t('quotes.empty') }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (count) => t('quotes.pagination.total', { count }),
          onChange: setPage,
        }}
        onRow={(row) => ({
          className: 'quote-table-row',
          onClick: () => navigate(`/quotes/${row.id}`),
        })}
      />
    </section>
  );
}
