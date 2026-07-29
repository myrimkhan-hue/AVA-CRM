import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Modal, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { WhatsAppTemplateRecord } from '../whatsapp/shared';

interface FormValues { title: string; body: string }

export function WhatsappTemplatesPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplateRecord | null>(null);

  const showError = useCallback((error: unknown) => {
    void message.error(error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'));
  }, [message, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await apiRequest<WhatsAppTemplateRecord[]>('/whatsapp/templates'));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setEditorOpen(true);
  };

  const openEdit = (template: WhatsAppTemplateRecord) => {
    setEditing(template);
    form.setFieldsValue({ title: template.title, body: template.body });
    setEditorOpen(true);
  };

  const save = async (values: FormValues) => {
    setSaving(true);
    try {
      await apiRequest(editing ? `/whatsapp/templates/${editing.id}` : '/whatsapp/templates', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      });
      void message.success(t(editing ? 'whatsapp.templatesPage.updated' : 'whatsapp.templatesPage.created'));
      setEditorOpen(false);
      await load();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: WhatsAppTemplateRecord) => {
    try {
      await apiRequest(`/whatsapp/templates/${template.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      await load();
    } catch (error: unknown) {
      showError(error);
    }
  };

  const remove = (template: WhatsAppTemplateRecord) => {
    modal.confirm({
      title: t('whatsapp.templatesPage.confirmDeleteTitle'),
      content: t('whatsapp.templatesPage.confirmDeleteText', { title: template.title }),
      okText: t('common.save'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await apiRequest(`/whatsapp/templates/${template.id}`, { method: 'DELETE' });
          void message.success(t('whatsapp.templatesPage.deleted'));
          await load();
        } catch (error: unknown) {
          showError(error);
          throw error;
        }
      },
    });
  };

  return <div className="whatsapp-templates-page">
    <div className="page-heading">
      <Typography.Paragraph type="secondary">{t('whatsapp.templatesPage.hint')}</Typography.Paragraph>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('whatsapp.templatesPage.add')}</Button>
    </div>
    {!loading && !templates.length && <Typography.Text type="secondary">{t('whatsapp.templatesPage.empty')}</Typography.Text>}
    {templates.map((template) => <Card key={template.id} size="small" className="whatsapp-unmatched-card" loading={loading}>
      <div className="whatsapp-unmatched-info">
        <strong>{template.title}</strong>
        <div className="whatsapp-template-body">{template.body}</div>
      </div>
      <div>
        <Switch checked={template.isActive} onChange={() => void toggleActive(template)} checkedChildren={t('whatsapp.templatesPage.active')} unCheckedChildren={t('whatsapp.templatesPage.inactive')} />
        <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(template)} />
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(template)} />
      </div>
    </Card>)}

    <Modal open={editorOpen} title={t(editing ? 'whatsapp.templatesPage.editTitle' : 'whatsapp.templatesPage.createTitle')} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={() => form.submit()} onCancel={() => setEditorOpen(false)} destroyOnHidden>
      <Form<FormValues> form={form} layout="vertical" requiredMark={false} onFinish={(values) => void save(values)}>
        <Form.Item name="title" label={t('whatsapp.templatesPage.titleField')} rules={[{ required: true, whitespace: true, message: t('whatsapp.templatesPage.titleRequired') }]}><Input /></Form.Item>
        <Form.Item name="body" label={t('whatsapp.templatesPage.bodyField')} extra={t('whatsapp.templatesPage.bodyHint')} rules={[{ required: true, whitespace: true, message: t('whatsapp.templatesPage.bodyRequired') }]}><Input.TextArea rows={4} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
