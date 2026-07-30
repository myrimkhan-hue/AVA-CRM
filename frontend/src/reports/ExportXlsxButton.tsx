import { DownloadOutlined } from '@ant-design/icons';
import { App, Button } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiDownload, saveBlob } from '../api/client';

interface Props {
  /** Путь эндпоинта выгрузки, например «/reports/receivables/export». */
  path: string;
  /** Подпись кнопки; по умолчанию — «Выгрузить в Excel». */
  label?: string;
}

/** Кнопка «Выгрузить в Excel» — общая для всех отчётов. */
export function ExportXlsxButton({ path, label }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const { blob, filename } = await apiDownload(path);
      saveBlob(blob, filename);
    } catch (error) {
      void message.error(
        error instanceof ApiError
          ? error.message || t('reports.export.failed')
          : t('errors.connection'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button icon={<DownloadOutlined />} loading={loading} onClick={() => void download()}>
      {label ?? t('reports.export.button')}
    </Button>
  );
}
