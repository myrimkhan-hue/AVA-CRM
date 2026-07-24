import { Button, Input } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedRequisites, parseRequisitesText } from '../documents/parse-requisites';

const REPORT_KEYS: readonly (keyof ParsedRequisites)[] = [
  'type', 'name', 'bin', 'position', 'signerFull',
  'basis', 'address', 'account', 'bank', 'bik', 'phone', 'email',
];

interface Props {
  /** Какие поля есть в целевой форме — определяет, что попадёт в «распознано/не найдено». */
  fields: readonly (keyof ParsedRequisites)[];
  onApply: (parsed: ParsedRequisites) => void;
}

export function PasteRequisitesBox({ fields, onApply }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [info, setInfo] = useState<string>();

  const relevantKeys = REPORT_KEYS.filter((key) => fields.includes(key));

  const apply = () => {
    if (!text.trim()) {
      setInfo(t('documents.paste.emptyWarning'));
      return;
    }
    const parsed = parseRequisitesText(text);
    const found = relevantKeys.filter((key) => parsed[key]);
    if (!found.length) {
      setInfo(t('documents.paste.notRecognized'));
      return;
    }
    onApply(parsed);
    const missing = relevantKeys.filter((key) => key !== 'type' && !parsed[key]);
    let message = t('documents.paste.recognized', {
      fields: found.map((key) => t(`documents.paste.fields.${key}`)).join(', '),
    });
    if (missing.length) {
      message += t('documents.paste.missing', {
        fields: missing.map((key) => t(`documents.paste.fields.${key}`)).join(', '),
      });
    }
    setInfo(message);
  };

  return (
    <div className="paste-requisites-box">
      <a
        href="#"
        className="paste-requisites-toggle"
        onClick={(event) => { event.preventDefault(); setOpen((value) => !value); }}
      >
        {t('documents.paste.toggle')}
      </a>
      {open && (
        <div className="paste-requisites-body">
          <Input.TextArea
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('documents.paste.placeholder')}
          />
          <div className="paste-requisites-actions">
            <Button size="small" onClick={apply}>{t('documents.paste.apply')}</Button>
            <Button size="small" type="text" onClick={() => setOpen(false)}>{t('documents.paste.hide')}</Button>
          </div>
          {info && <div className="paste-requisites-info">{info}</div>}
        </div>
      )}
    </div>
  );
}
