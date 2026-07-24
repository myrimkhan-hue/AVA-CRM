import { App, Form, Input, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiRequest } from '../api/client';
import { mapParsedToFields } from '../documents/parse-requisites';
import {
  ContractRequisitesFormValues,
  REQUISITES_PASTE_FIELDS,
  REQUISITES_PASTE_MAPPING,
} from './GenerateContractModal';
import { PasteRequisitesBox } from './PasteRequisitesBox';

export interface TransportRequestFormValues extends ContractRequisitesFormValues {
  paymentMethod?: string;
  paymentConditions?: string;
  documents?: string;
  notes?: string;
}

interface ContractorRequisites extends ContractRequisitesFormValues {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  carrierContractorId?: string;
  onClose: () => void;
  onGenerate: (values: TransportRequestFormValues) => Promise<void>;
}

export function GenerateTransportRequestModal({ open, carrierContractorId, onClose, onGenerate }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<TransportRequestFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !carrierContractorId) return;
    setLoading(true);
    form.resetFields();
    apiRequest<ContractorRequisites>(`/contractors/${carrierContractorId}`)
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
          documents: 'ТТН',
        });
      })
      .catch((error: unknown) => {
        void message.error(
          error instanceof ApiError ? error.message || t('errors.request') : t('errors.connection'),
        );
      })
      .finally(() => setLoading(false));
  }, [carrierContractorId, form, message, open, t]);

  const submit = async (values: TransportRequestFormValues) => {
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
      title={t('documents.request.modalTitle')}
      okText={t('documents.request.generate')}
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
          <p className="generate-contract-hint">{t('documents.request.hint')}</p>
          <Form<TransportRequestFormValues>
            form={form}
            layout="vertical"
            onFinish={(values) => void submit(values)}
          >
            <div className="form-grid two">
              <Form.Item name="paymentMethod" label={t('documents.request.fields.paymentMethod')}>
                <Input placeholder="Безналичный расчёт" />
              </Form.Item>
              <Form.Item name="paymentConditions" label={t('documents.request.fields.paymentConditions')}>
                <Input />
              </Form.Item>
              <Form.Item name="documents" label={t('documents.request.fields.documents')}>
                <Input />
              </Form.Item>
              <Form.Item name="notes" label={t('documents.request.fields.notes')}>
                <Input />
              </Form.Item>
            </div>
            <p className="generate-contract-hint">{t('documents.request.carrierHint')}</p>
            <PasteRequisitesBox
              fields={REQUISITES_PASTE_FIELDS}
              onApply={(parsed) => form.setFieldsValue(mapParsedToFields(parsed, REQUISITES_PASTE_MAPPING))}
            />
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
