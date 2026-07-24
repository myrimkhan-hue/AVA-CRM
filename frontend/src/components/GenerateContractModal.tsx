import { App, Form, Input, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';

export interface ContractRequisitesFormValues {
  legalForm?: string;
  bin?: string;
  legalAddress?: string;
  bankName?: string;
  bankAccount?: string;
  bankBik?: string;
  signerPosition?: string;
  signerFullName?: string;
  signerShortName?: string;
  signBasis?: string;
  phone?: string;
  email?: string;
}

interface ContractorRequisites extends ContractRequisitesFormValues {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  contractorId?: string;
  onClose: () => void;
  onGenerate: (overrides: ContractRequisitesFormValues) => Promise<void>;
}

export function GenerateContractModal({ open, contractorId, onClose, onGenerate }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<ContractRequisitesFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !contractorId) return;
    setLoading(true);
    apiRequest<ContractorRequisites>(`/contractors/${contractorId}`)
      .then((contractor) => {
        form.setFieldsValue({
          legalForm: contractor.legalForm ?? undefined,
          bin: contractor.bin ?? undefined,
          legalAddress: contractor.legalAddress ?? undefined,
          bankName: contractor.bankName ?? undefined,
          bankAccount: contractor.bankAccount ?? undefined,
          bankBik: contractor.bankBik ?? undefined,
          signerPosition: contractor.signerPosition ?? undefined,
          signerFullName: contractor.signerFullName ?? undefined,
          signerShortName: contractor.signerShortName ?? undefined,
          signBasis: contractor.signBasis ?? undefined,
          phone: contractor.phone ?? undefined,
          email: contractor.email ?? undefined,
        });
      })
      .catch((error: unknown) => {
        void message.error(
          error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
        );
      })
      .finally(() => setLoading(false));
  }, [contractorId, form, message, open, t]);

  const submit = async (values: ContractRequisitesFormValues) => {
    setSaving(true);
    try {
      await onGenerate(values);
      onClose();
    } catch (error: unknown) {
      void message.error(
        error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('documents.contract.modalTitle')}
      okText={t('documents.contract.generate')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={640}
    >
      {loading ? (
        <Spin />
      ) : (
        <>
          <p className="generate-contract-hint">{t('documents.contract.hint')}</p>
          <Form<ContractRequisitesFormValues>
            form={form}
            layout="vertical"
            onFinish={(values) => void submit(values)}
          >
            <div className="form-grid two">
              <Form.Item name="legalForm" label={t('documents.contract.fields.legalForm')}>
                <Input placeholder="ТОО / ИП" />
              </Form.Item>
              <Form.Item name="bin" label={t('documents.contract.fields.bin')}>
                <Input />
              </Form.Item>
              <Form.Item name="legalAddress" label={t('documents.contract.fields.legalAddress')} className="span-all">
                <Input />
              </Form.Item>
              <Form.Item name="signerPosition" label={t('documents.contract.fields.signerPosition')}>
                <Input />
              </Form.Item>
              <Form.Item name="signBasis" label={t('documents.contract.fields.signBasis')}>
                <Input placeholder="Устава / Талона / Доверенности" />
              </Form.Item>
              <Form.Item name="signerFullName" label={t('documents.contract.fields.signerFullName')}>
                <Input />
              </Form.Item>
              <Form.Item name="signerShortName" label={t('documents.contract.fields.signerShortName')}>
                <Input placeholder="Фамилия И." />
              </Form.Item>
              <Form.Item name="bankName" label={t('documents.contract.fields.bankName')}>
                <Input />
              </Form.Item>
              <Form.Item name="bankAccount" label={t('documents.contract.fields.bankAccount')}>
                <Input />
              </Form.Item>
              <Form.Item name="bankBik" label={t('documents.contract.fields.bankBik')}>
                <Input />
              </Form.Item>
              <Form.Item name="phone" label={t('documents.contract.fields.phone')}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label={t('documents.contract.fields.email')}>
                <Input />
              </Form.Item>
            </div>
          </Form>
        </>
      )}
    </Modal>
  );
}
