import { Button, Input } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PARSED_CARGO_KEYS, ParsedCargo, parseCargoText } from '../quotes/parse-cargo';

interface Props {
  /** Какие поля есть на этом экране — определяет, что попадёт в «распознано / не найдено». */
  fields: readonly (keyof ParsedCargo)[];
  /**
   * Какие поля пользователь уже заполнил: их значения не затираются, о чём
   * говорится в отчёте. Функция, а не готовый список, потому что читать форму
   * можно только в момент нажатия — на первой отрисовке она ещё не смонтирована.
   */
  getFilled?: () => readonly (keyof ParsedCargo)[];
  onApply: (parsed: ParsedCargo) => void;
}

export function PasteCargoBox({ fields, getFilled, onApply }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [info, setInfo] = useState<string>();

  const relevantKeys = PARSED_CARGO_KEYS.filter((key) => fields.includes(key));
  const label = (key: keyof ParsedCargo) => t(`quotes.paste.fields.${key}`);

  const apply = () => {
    if (!text.trim()) {
      setInfo(t('quotes.paste.emptyWarning'));
      return;
    }
    const parsed = parseCargoText(text);
    const found = relevantKeys.filter((key) => parsed[key] !== undefined);
    if (!found.length) {
      setInfo(t('quotes.paste.notRecognized'));
      return;
    }
    // Уже заполненное пользователем не перетираем: он мог поправить руками.
    const filled = getFilled?.() ?? [];
    const kept = found.filter((key) => filled.includes(key));
    const applied = found.filter((key) => !filled.includes(key));
    const result: ParsedCargo = {};
    for (const key of applied) Object.assign(result, { [key]: parsed[key] });
    onApply(result);

    const parts = [
      applied.length
        ? t('quotes.paste.recognized', { fields: applied.map(label).join(', ') })
        : t('quotes.paste.nothingApplied'),
    ];
    const missing = relevantKeys.filter((key) => parsed[key] === undefined);
    if (missing.length) parts.push(t('quotes.paste.missing', { fields: missing.map(label).join(', ') }));
    if (kept.length) parts.push(t('quotes.paste.kept', { fields: kept.map(label).join(', ') }));
    setInfo(parts.join(' '));
  };

  return (
    <div className="paste-requisites-box">
      <a
        href="#"
        className="paste-requisites-toggle"
        onClick={(event) => { event.preventDefault(); setOpen((value) => !value); }}
      >
        {t('quotes.paste.toggle')}
      </a>
      {open && (
        <div className="paste-requisites-body">
          <Input.TextArea
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('quotes.paste.placeholder')}
          />
          <div className="paste-requisites-actions">
            <Button size="small" onClick={apply}>{t('quotes.paste.apply')}</Button>
            <Button size="small" type="text" onClick={() => setOpen(false)}>{t('quotes.paste.hide')}</Button>
          </div>
          {info && <div className="paste-requisites-info">{info}</div>}
        </div>
      )}
    </div>
  );
}
