import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import type { OperatingExpenseTypeRecord } from '../api/types';

interface TypeFormValues {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export function OperatingExpenseTypesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<TypeFormValues>();
  const [items, setItems] = useState<OperatingExpenseTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OperatingExpenseTypeRecord | null>(null);
  const [actionId, setActionId] = useState<string>();

  const showError = useCallback((error: unknown) => {
    void message.error(
      error instanceof ApiError
        ? error.message || t('errors.request')
        : t('errors.connection'),
    );
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiRequest<OperatingExpenseTypeRecord[]>('/operating-expense-types'));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ name: '', sortOrder: 0, isActive: true });
    setEditorOpen(true);
  };

  const openEdit = (item: OperatingExpenseTypeRecord) => {
    setEditing(item);
    form.setFieldsValue({
      name: item.name,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setEditorOpen(true);
  };

  const save = async (values: TypeFormValues) => {
    setSaving(true);
    try {
      await apiRequest(
        editing ? `/operating-expense-types/${editing.id}` : '/operating-expense-types',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(values),
        },
      );
      void message.success(t(editing
        ? 'operatingExpenseTypes.messages.updated'
        : 'operatingExpenseTypes.messages.created'));
      setEditorOpen(false);
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: OperatingExpenseTypeRecord) => {
    setActionId(item.id);
    try {
      await apiRequest(`/operating-expense-types/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      void message.success(t(item.isActive
        ? 'operatingExpenseTypes.messages.deactivated'
        : 'operatingExpenseTypes.messages.activated'));
      await load();
    } catch (error) {
      showError(error);
    } finally {
      setActionId(undefined);
    }
  };

  const columns: ColumnsType<OperatingExpenseTypeRecord> = [
    { title: t('operatingExpenseTypes.columns.name'), dataIndex: 'name' },
    {
      title: t('operatingExpenseTypes.columns.sortOrder'),
      dataIndex: 'sortOrder',
      width: 150,
    },
    {
      title: t('operatingExpenseTypes.columns.status'),
      dataIndex: 'isActive',
      width: 150,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'default'}>
          {t(value
            ? 'operatingExpenseTypes.status.active'
            : 'operatingExpenseTypes.status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('operatingExpenseTypes.columns.actions'),
      key: 'actions',
      width: 260,
      render: (_, item) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(item)}>
            {t('operatingExpenseTypes.actions.edit')}
          </Button>
          <Popconfirm
            title={t(item.isActive
              ? 'operatingExpenseTypes.confirm.deactivate'
              : 'operatingExpenseTypes.confirm.activate')}
            onConfirm={() => void toggleActive(item)}
          >
            <Button size="small" danger={item.isActive} loading={actionId === item.id}>
              {t(item.isActive
                ? 'operatingExpenseTypes.actions.deactivate'
                : 'operatingExpenseTypes.actions.activate')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="operating-expense-types-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{t('operatingExpenseTypes.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('operatingExpenseTypes.subtitle')}</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('operatingExpenseTypes.actions.create')}
        </Button>
      </div>
      <Card>
        <Table<OperatingExpenseTypeRecord>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={false}
          rowClassName={(item) => item.isActive ? '' : 'inactive-row'}
          locale={{ emptyText: t('operatingExpenseTypes.empty') }}
        />
      </Card>

      <Modal
        open={editorOpen}
        title={t(editing
          ? 'operatingExpenseTypes.form.editTitle'
          : 'operatingExpenseTypes.form.createTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => form.submit()}
        onCancel={() => setEditorOpen(false)}
        destroyOnHidden
      >
        <Form<TypeFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void save(values)}
        >
          <Form.Item name="name" label={t('operatingExpenseTypes.form.name')} rules={[{
            required: true,
            whitespace: true,
            message: t('operatingExpenseTypes.validation.name'),
          }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="sortOrder" label={t('operatingExpenseTypes.form.sortOrder')}>
            <InputNumber className="full-width" precision={0} />
          </Form.Item>
          <Form.Item name="isActive" label={t('operatingExpenseTypes.form.isActive')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
