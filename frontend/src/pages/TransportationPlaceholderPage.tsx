import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

interface TransportationPlaceholderPageProps {
  mode: 'new' | 'detail';
}

export function TransportationPlaceholderPage({ mode }: TransportationPlaceholderPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <Card className="transportation-placeholder">
      <Typography.Title level={2}>
        {t(`transportations.placeholders.${mode}.title`, { id })}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t(`transportations.placeholders.${mode}.description`)}
      </Typography.Paragraph>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/transportations')}>
        {t('transportations.actions.backToList')}
      </Button>
    </Card>
  );
}
