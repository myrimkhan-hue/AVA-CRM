import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MarginCard } from '../components/MarginCard';
import {
  DEAL_PIPELINE_STAGES,
  DEAL_REJECT_REASONS,
  DEAL_STAGE_COLORS,
  Deal,
  DealStage,
  RejectReason,
} from '../deals/shared';
import { STATUS_COLORS, TransportationStatus } from '../transportations/shared';
import {
  INVOICE_STATUS_COLORS,
  InvoiceStatus,
} from '../invoices/shared';

interface Transportation {
  id: string;
  number: string;
  originPoint: string;
  destinationPoint: string;
  status: TransportationStatus;
  plannedDeliveryDate: string | null;
  invoice?: {
    id: string;
    number: string;
    status: InvoiceStatus;
  } | null;
}

interface RejectValues {
  rejectReason: RejectReason;
  rejectComment?: string;
}

interface NotesValues {
  notes?: string;
}

export function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const [rejectForm] = Form.useForm<RejectValues>();
  const [notesForm] = Form.useForm<NotesValues>();
  const [deal, setDeal] = useState<Deal>();
  const [transportations, setTransportations] = useState<Transportation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const selectedReason = Form.useWatch('rejectReason', rejectForm);
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const mayEditDeals = Boolean(user?.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role)));

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  const loadDeal = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const [dealResult, transportationResult] = await Promise.all([
        apiRequest<Deal>(`/deals/${id}`),
        apiRequest<Transportation[]>(`/transportations?dealId=${encodeURIComponent(id)}`),
      ]);
      setDeal(dealResult);
      setTransportations(transportationResult);
    } catch (error) {
      setLoadFailed(true);
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => { void loadDeal(); }, [loadDeal]);

  const formatDate = useCallback((value: string | null, withTime = false) => {
    if (!value) return t('common.dash');
    return new Intl.DateTimeFormat(i18n.language, withTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(new Date(value));
  }, [i18n.language, t]);

  const updateStage = async (stage: DealStage, rejectValues?: RejectValues) => {
    if (!deal || deal.deletedAt || (stage === deal.stage && !rejectValues)) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Deal>(`/deals/${deal.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage, ...rejectValues }),
      });
      setDeal(updated);
      setRejectOpen(false);
      void message.success(t('deals.messages.stageUpdated'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const openReject = () => {
    rejectForm.setFieldsValue({
      rejectReason: deal?.rejectReason ?? undefined,
      rejectComment: deal?.rejectComment ?? undefined,
    });
    setRejectOpen(true);
  };

  const openNotes = () => {
    notesForm.setFieldsValue({ notes: deal?.notes ?? undefined });
    setNotesOpen(true);
  };

  const saveNotes = async (values: NotesValues) => {
    if (!deal) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Deal>(`/deals/${deal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setDeal(updated);
      setNotesOpen(false);
      void message.success(t('deals.messages.notesUpdated'));
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const removeDeal = () => {
    if (!deal) return;
    modal.confirm({
      title: t('deals.confirm.deleteTitle'),
      content: t('deals.confirm.deleteText', { number: deal.number }),
      okText: t('deals.actions.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await apiRequest(`/deals/${deal.id}`, { method: 'DELETE' });
          void message.success(t('deals.messages.deleted'));
          navigate('/deals', { replace: true });
        } catch (error) {
          showError(error);
          throw error;
        }
      },
    });
  };

  const transportationColumns = useMemo<ColumnsType<Transportation>>(() => [
    {
      title: t('deals.detail.transportations.number'), dataIndex: 'number', width: 180,
      render: (value: string) => <Typography.Text strong className="transportation-number">{value}</Typography.Text>,
    },
    {
      title: t('deals.detail.transportations.route'), key: 'route',
      render: (_, item) => t('transportations.values.route', { from: item.originPoint, to: item.destinationPoint }),
    },
    {
      title: t('deals.detail.transportations.status'), dataIndex: 'status', width: 165,
      render: (status: TransportationStatus) => <Tag bordered={false} style={STATUS_COLORS[status]}>{t(`transportations.statuses.${status}`)}</Tag>,
    },
    {
      title: t('deals.detail.transportations.invoice'), dataIndex: 'invoice', width: 210,
      render: (invoice: Transportation['invoice']) => invoice
        ? <Space direction="vertical" size={2}>
          <Typography.Text strong>{invoice.number}</Typography.Text>
          <Tag color={INVOICE_STATUS_COLORS[invoice.status]}>{t(`invoices.statuses.${invoice.status}`)}</Tag>
        </Space>
        : t('common.dash'),
    },
    {
      title: t('deals.detail.transportations.plan'), dataIndex: 'plannedDeliveryDate', width: 165,
      render: (value: string | null) => formatDate(value),
    },
  ], [formatDate, t]);

  if (loading) return <Spin className="detail-spin" />;
  if (loadFailed || !deal) return <Result status="warning" title={t('deals.detail.loadFailed')} extra={<Button onClick={() => navigate('/deals')}>{t('deals.detail.back')}</Button>} />;

  const pipelineIndex = DEAL_PIPELINE_STAGES.indexOf(deal.stage as (typeof DEAL_PIPELINE_STAGES)[number]);
  const activeDeal = !deal.deletedAt;

  return <section className="deal-detail-page">
    <Link className="deal-detail-back" to="/deals">{t('deals.detail.back')}</Link>

    <div className="deal-detail-heading">
      <Space wrap>
        <Typography.Title level={2}>{t('deals.detail.title', { number: deal.number })}</Typography.Title>
        <Tag bordered={false} style={DEAL_STAGE_COLORS[deal.stage]}>{t(`deals.stages.${deal.stage}`)}</Tag>
        {deal.deletedAt && <Tag>{t('deals.status.deleted')}</Tag>}
      </Space>
      <Space wrap>
        {mayEditDeals && activeDeal && <Button danger icon={<StopOutlined />} onClick={openReject}>{t('deals.detail.actions.reject')}</Button>}
        {mayEditDeals && activeDeal && <Button icon={<EditOutlined />} onClick={openNotes}>{t('deals.detail.actions.edit')}</Button>}
        {isAdmin && activeDeal && <Button danger type="text" icon={<DeleteOutlined />} onClick={removeDeal}>{t('deals.actions.delete')}</Button>}
      </Space>
    </div>

    <Card className="transport-card deal-stage-card">
      <div className="deal-stage-scale">
        {DEAL_PIPELINE_STAGES.map((stage, index) => {
          const isCurrent = deal.stage === stage;
          const isDone = pipelineIndex >= 0 && index < pipelineIndex;
          return <button
            key={stage}
            className={`deal-stage-step${isCurrent ? ' current' : ''}${isDone ? ' done' : ''}`}
            disabled={!mayEditDeals || !activeDeal || saving || isCurrent}
            onClick={() => void updateStage(stage)}
          >
            <small>{t('deals.detail.stageNumber', { number: index + 1 })}</small>
            <span>{isDone && <CheckOutlined />}{t(`deals.stages.${stage}`)}</span>
          </button>;
        })}
      </div>
      <Typography.Text type="secondary" className="deal-stage-hint">{t('deals.detail.stageHint')}</Typography.Text>
    </Card>

    <div className="deal-detail-columns">
      <div className="deal-detail-main">
        <Card className="transport-card" title={t('deals.detail.sections.transportations')}>
          <Table<Transportation>
            className="deal-transportations-table"
            rowKey="id"
            columns={transportationColumns}
            dataSource={transportations}
            pagination={false}
            scroll={{ x: 720 }}
            locale={{ emptyText: t('deals.detail.transportations.empty') }}
            onRow={(item) => ({ onClick: () => navigate(`/transportations/${item.id}`) })}
          />
        </Card>

        <Card
          className="transport-card"
          title={t('deals.detail.sections.notes')}
          extra={mayEditDeals && activeDeal ? <Button type="link" icon={<EditOutlined />} onClick={openNotes}>{t('deals.detail.actions.edit')}</Button> : undefined}
        >
          <Typography.Paragraph className="deal-notes">{deal.notes || t('common.dash')}</Typography.Paragraph>
        </Card>
      </div>

      <aside className="deal-detail-side">
        <MarginCard endpoint={`/deals/${deal.id}/margin`} />

        <Card className="transport-card" title={t('deals.detail.sections.parties')}>
          <Descriptions column={1} size="small" items={[
            { key: 'client', label: t('deals.details.client'), children: <Link to="/contractors">{deal.client.name}</Link> },
            { key: 'entity', label: t('deals.details.legalEntity'), children: `${deal.legalEntity.name} (${deal.legalEntity.numberingPrefix})` },
            { key: 'responsible', label: t('deals.details.responsible'), children: deal.responsible.fullName },
            { key: 'department', label: t('deals.details.department'), children: deal.department?.name || t('common.dash') },
          ]} />
        </Card>

        <Card className="transport-card" title={t('deals.detail.sections.timeline')}>
          <div className="deal-timeline">
            <div>
              <strong>{t(`deals.stages.${deal.stage}`)}</strong>
              <span>{t('deals.detail.timeline.currentStage')}</span>
            </div>
            <div>
              <strong>{t('deals.detail.timeline.created')}</strong>
              <span>{formatDate(deal.createdAt, true)}</span>
            </div>
            {deal.rejectReason && <div className="rejected-event">
              <strong>{t(`deals.reasons.${deal.rejectReason}`)}</strong>
              <span>{deal.rejectComment || t('deals.detail.timeline.noComment')}</span>
            </div>}
          </div>
        </Card>
      </aside>
    </div>

    <Modal
      open={rejectOpen}
      title={t('deals.rejectModal.title')}
      okText={t('deals.detail.actions.reject')}
      okButtonProps={{ danger: true }}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      onOk={() => rejectForm.submit()}
      onCancel={() => setRejectOpen(false)}
      destroyOnHidden
    >
      <Form<RejectValues> form={rejectForm} layout="vertical" requiredMark={false} onFinish={(values) => void updateStage('REJECTED', values)}>
        <Form.Item name="rejectReason" label={t('deals.form.rejectReason')} rules={[{ required: true, message: t('deals.validation.rejectReason') }]}>
          <Select options={DEAL_REJECT_REASONS.map((value) => ({ value, label: t(`deals.reasons.${value}`) }))} />
        </Form.Item>
        <Form.Item name="rejectComment" label={t('deals.form.rejectComment')} rules={selectedReason === 'OTHER' ? [{ required: true, whitespace: true, message: t('deals.validation.rejectComment') }] : []}>
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal open={notesOpen} title={t('deals.notesModal.title')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => notesForm.submit()} onCancel={() => setNotesOpen(false)} destroyOnHidden>
      <Form<NotesValues> form={notesForm} layout="vertical" onFinish={saveNotes}>
        <Form.Item name="notes" label={t('deals.form.notes')}><Input.TextArea rows={6} /></Form.Item>
      </Form>
    </Modal>
  </section>;
}
