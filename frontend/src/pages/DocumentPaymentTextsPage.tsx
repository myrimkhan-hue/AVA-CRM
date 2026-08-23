import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import type {
  DocumentPaymentTextRecord,
  DocumentPaymentTextType,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface FormValues {
  type: DocumentPaymentTextType;
  shortName: string;
  text: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

const TEXT_TYPES: DocumentPaymentTextType[] = [
  'PAYMENT_METHOD',
  'PAYMENT_CONDITIONS',
];

export function DocumentPaymentTextsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<DocumentPaymentTextRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentPaymentTextRecord | null>(null);
  const formIsActive = Form.useWatch('isActive', form);
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      setItems(await apiRequest<DocumentPaymentTextRecord[]>('/document-payment-texts'));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, showError]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      type: 'PAYMENT_METHOD',
      shortName: '',
      text: '',
      sortOrder: 0,
      isDefault: false,
      isActive: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (item: DocumentPaymentTextRecord) => {
    setEditing(item);
    form.setFieldsValue({
      type: item.type,
      shortName: item.shortName,
      text: item.text,
      sortOrder: item.sortOrder,
      isDefault: item.isDefault,
      isActive: item.isActive,
    });
    setEditorOpen(true);
  };

  const save = async (values: FormValues) => {
    setSaving(true);
    try {
      await apiRequest(
        editing ? `/document-payment-texts/${editing.id}` : '/document-payment-texts',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(values),
        },
      );
      void message.success(t(
        editing
          ? 'documentPaymentTexts.messages.updated'
          : 'documentPaymentTexts.messages.created',
      ));
      setEditorOpen(false);
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<DocumentPaymentTextRecord> = [
    {
      title: t('documentPaymentTexts.columns.type'),
      dataIndex: 'type',
      width: 180,
      render: (type: DocumentPaymentTextType) => t(`documentPaymentTexts.types.${type}`),
    },
    {
      title: t('documentPaymentTexts.columns.shortName'),
      dataIndex: 'shortName',
      width: 210,
    },
    {
      title: t('documentPaymentTexts.columns.text'),
      dataIndex: 'text',
      ellipsis: true,
    },
    {
      title: t('documentPaymentTexts.columns.sortOrder'),
      dataIndex: 'sortOrder',
      width: 100,
    },
    {
      title: t('documentPaymentTexts.columns.status'),
      key: 'status',
      width: 180,
      render: (_, item) => (
        <Space>
          <Tag color={item.isActive ? 'green' : 'default'}>
            {t(item.isActive
              ? 'documentPaymentTexts.status.active'
              : 'documentPaymentTexts.status.inactive')}
          </Tag>
          {item.isDefault && (
            <Tag color="blue">{t('documentPaymentTexts.status.default')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('documentPaymentTexts.columns.actions'),
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, item) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(item)}
        >
          {t('documentPaymentTexts.actions.edit')}
        </Button>
      ),
    },
  ];

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="document-payment-texts-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('documentPaymentTexts.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('documentPaymentTexts.subtitle')}
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('documentPaymentTexts.actions.add')}
        </Button>
      </div>

      <Card>
        <Table<DocumentPaymentTextRecord>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 1050 }}
          pagination={false}
          locale={{ emptyText: t('documentPaymentTexts.empty') }}
        />
      </Card>

      <Modal
        open={editorOpen}
        title={t(editing
          ? 'documentPaymentTexts.form.editTitle'
          : 'documentPaymentTexts.form.createTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => form.submit()}
        onCancel={() => setEditorOpen(false)}
        destroyOnHidden
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void save(values)}
        >
          <Form.Item
            name="type"
            label={t('documentPaymentTexts.form.type')}
            rules={[{ required: true, message: t('documentPaymentTexts.form.typeRequired') }]}
          >
            <Select options={TEXT_TYPES.map((value) => ({
              value,
              label: t(`documentPaymentTexts.types.${value}`),
            }))} />
          </Form.Item>
          <Form.Item
            name="shortName"
            label={t('documentPaymentTexts.form.shortName')}
            rules={[{
              required: true,
              whitespace: true,
              message: t('documentPaymentTexts.form.shortNameRequired'),
            }]}
          ><Input /></Form.Item>
          <Form.Item
            name="text"
            label={t('documentPaymentTexts.form.text')}
            rules={[{
              required: true,
              whitespace: true,
              message: t('documentPaymentTexts.form.textRequired'),
            }]}
          ><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="sortOrder" label={t('documentPaymentTexts.form.sortOrder')}>
            <InputNumber className="full-width" precision={0} />
          </Form.Item>
          <Space size="large">
            <Form.Item
              name="isDefault"
              label={t('documentPaymentTexts.form.isDefault')}
              valuePropName="checked"
            >
              <Switch disabled={!formIsActive} />
            </Form.Item>
            <Form.Item
              name="isActive"
              label={t('documentPaymentTexts.form.isActive')}
              valuePropName="checked"
            >
              <Switch
                onChange={(checked) => {
                  if (!checked) form.setFieldValue('isDefault', false);
                }}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
