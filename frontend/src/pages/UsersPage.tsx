import {
  CheckCircleOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import { Department, Role, UserRecord } from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface UserFormValues {
  fullName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  roles: string[];
  password?: string;
}

interface PasswordFormValues {
  password: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'default',
  DIRECTOR: 'geekblue',
  DEPARTMENT_HEAD: 'gold',
  MANAGER: 'blue',
  LOGIST: 'cyan',
  FINANCIER: 'purple',
};

export function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRecord | null>(null);
  const [userForm] = Form.useForm<UserFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const isAdmin = currentUser?.roles.includes('ADMIN');

  const showError = useCallback(
    (error: unknown) => {
      void message.error(
        error instanceof ApiError
          ? error.message || t('errors.request')
          : t('errors.connection'),
      );
    },
    [message, t],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, departmentData, roleData] = await Promise.all([
        apiRequest<UserRecord[]>('/users'),
        apiRequest<Department[]>('/departments'),
        apiRequest<Role[]>('/roles'),
      ]);
      setUsers(userData);
      setDepartments(departmentData);
      setRoles(roleData);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  const roleNames = useMemo(
    () => new Map(roles.map((role) => [role.code, role.name])),
    [roles],
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  const openCreate = () => {
    setEditingUser(null);
    userForm.resetFields();
    setEditorOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? undefined,
      departmentId: user.departmentId ?? undefined,
      roles: user.roles,
    });
    setEditorOpen(true);
  };

  const saveUser = async (values: UserFormValues) => {
    setSaving(true);
    try {
      if (editingUser) {
        const { password: _password, ...payload } = values;
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        void message.success(t('users.messages.updated'));
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        void message.success(t('users.messages.created'));
      }
      setEditorOpen(false);
      userForm.resetFields();
      await loadData();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async ({ password }: PasswordFormValues) => {
    if (!passwordUser) return;
    setSaving(true);
    try {
      await apiRequest(`/users/${passwordUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
      void message.success(t('users.messages.passwordReset'));
      setPasswordUser(null);
      passwordForm.resetFields();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (user: UserRecord) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    modal.confirm({
      title: t(`users.confirm.${action}Title`),
      content: t(`users.confirm.${action}Text`, { name: user.fullName }),
      okText: t(`users.actions.${action}`),
      cancelText: t('common.cancel'),
      okButtonProps: user.isActive ? { danger: true } : undefined,
      async onOk() {
        try {
          await apiRequest(`/users/${user.id}/${action}`, { method: 'PATCH' });
          void message.success(t(`users.messages.${action}d`));
          await loadData();
        } catch (error: unknown) {
          showError(error);
          throw error;
        }
      },
    });
  };

  const columns: ColumnsType<UserRecord> = [
    { title: t('users.columns.fullName'), dataIndex: 'fullName', key: 'fullName' },
    { title: t('users.columns.email'), dataIndex: 'email', key: 'email' },
    {
      title: t('users.columns.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string | null) => phone || t('common.notSpecified'),
    },
    {
      title: t('users.columns.department'),
      key: 'department',
      render: (_, user) => user.department?.name ?? t('common.notSpecified'),
    },
    {
      title: t('users.columns.roles'),
      dataIndex: 'roles',
      key: 'roles',
      render: (codes: string[]) => codes.map((code) => (
        <Tag key={code} color={ROLE_COLORS[code]}>{roleNames.get(code) ?? code}</Tag>
      )),
    },
    {
      title: t('users.columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {t(active ? 'users.status.active' : 'users.status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('users.columns.actions'),
      key: 'actions',
      width: 320,
      render: (_, user) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(user)}>{t('users.actions.edit')}</Button>
          <Button size="small" icon={<LockOutlined />} onClick={() => { passwordForm.resetFields(); setPasswordUser(user); }}>{t('users.actions.resetPassword')}</Button>
          <Button
            size="small"
            danger={user.isActive}
            disabled={user.id === currentUser?.id && user.isActive}
            icon={user.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
            onClick={() => toggleActive(user)}
          >
            {t(user.isActive ? 'users.actions.deactivate' : 'users.actions.activate')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div className="page-heading">
        <div><Typography.Title level={2}>{t('users.title')}</Typography.Title><Typography.Text type="secondary">{t('users.subtitle')}</Typography.Text></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('users.add')}</Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        scroll={{ x: 1100 }}
        rowClassName={(user) => user.isActive ? '' : 'inactive-row'}
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />

      <Modal
        open={editorOpen}
        title={t(editingUser ? 'users.form.editTitle' : 'users.form.createTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => userForm.submit()}
        onCancel={() => setEditorOpen(false)}
        destroyOnHidden
      >
        <Form<UserFormValues> form={userForm} layout="vertical" onFinish={saveUser} requiredMark={false}>
          <Form.Item name="fullName" label={t('users.form.fullName')} rules={[{ required: true, message: t('validation.fullNameRequired') }]}><Input /></Form.Item>
          <Form.Item name="email" label={t('users.form.email')} rules={[{ required: true, message: t('validation.emailRequired') }, { type: 'email', message: t('validation.emailInvalid') }]}><Input /></Form.Item>
          <Form.Item name="phone" label={t('users.form.phone')}><Input /></Form.Item>
          <Form.Item name="departmentId" label={t('users.form.department')}><Select allowClear placeholder={t('users.form.departmentPlaceholder')} options={departments.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="roles" label={t('users.form.roles')} rules={[{ required: true, type: 'array', min: 1, message: t('validation.rolesRequired') }]}><Select mode="multiple" placeholder={t('users.form.rolesPlaceholder')} options={roles.map((role) => ({ value: role.code, label: role.name }))} /></Form.Item>
          {!editingUser && <Form.Item name="password" label={t('users.form.password')} rules={[{ required: true, message: t('validation.passwordRequired') }, { min: 8, message: t('validation.passwordMin') }]}><Input.Password /></Form.Item>}
        </Form>
      </Modal>

      <Modal
        open={Boolean(passwordUser)}
        title={t('users.password.title', { name: passwordUser?.fullName })}
        okText={t('users.actions.resetPassword')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        onOk={() => passwordForm.submit()}
        onCancel={() => setPasswordUser(null)}
        destroyOnHidden
      >
        <Form<PasswordFormValues> form={passwordForm} layout="vertical" onFinish={resetPassword} requiredMark={false}>
          <Form.Item name="password" label={t('users.password.newPassword')} rules={[{ required: true, message: t('validation.passwordRequired') }, { min: 8, message: t('validation.passwordMin') }]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
