// Портировано из contract-generator (php/index.html, parseRequisitesText) —
// разбор произвольного текста с реквизитами контрагента/юрлица на поля.

export interface ParsedRequisites {
  type?: string;
  name?: string;
  bin?: string;
  position?: string;
  signerFull?: string;
  signerShort?: string;
  basis?: string;
  address?: string;
  account?: string;
  bank?: string;
  bik?: string;
  phone?: string;
  email?: string;
}

export const PARSED_FIELD_KEYS = [
  'type', 'name', 'bin', 'position', 'signerFull', 'signerShort',
  'basis', 'address', 'account', 'bank', 'bik', 'phone', 'email',
] as const;

const KZ_BANKS: Record<string, string> = {
  HSBKKZKX: 'АО «Народный Банк Казахстана»',
  CASPKZKA: 'АО «Kaspi Bank»',
  KCJBKZKX: 'АО «Банк ЦентрКредит»',
  IRTYKZKA: 'АО «ForteBank»',
  TSESKZKA: 'АО «Jusan Bank»',
  EURIKZKA: 'АО «Евразийский банк»',
  SABRKZKA: 'АО «Bereke Bank»',
  KINCKZKA: 'АО «Bank RBK»',
  ATYNKZKA: 'АО «Altyn Bank»',
  NURSKZKK: 'АО «Нурбанк»',
  INLMKZKA: 'АО «Home Credit Bank»',
  KSNVKZKA: 'АО «Банк Фридом Финанс Казахстан»',
  CITIKZKA: 'АО «Ситибанк Казахстан»',
  ICBKKZKX: 'АО «ТПБ Китая в г. Алматы»',
  BKCHKZKA: 'ДБ АО «Банк Китая в Казахстане»',
  SHBKKZKA: 'АО «Шинхан Банк Казахстан»',
  KZIBKZKA: 'ДБ АО «КЗИ Банк»',
  HLALKZKZ: 'АО «Исламский банк «Al Hilal»',
  VTBAKZKZ: 'ДО АО Банк ВТБ (Казахстан)',
  KPSTKZKA: 'АО «Казпочта»',
  HCSKKZKA: 'АО «Отбасы банк»',
  ZAJSKZ22: 'АО «Заман-Банк»',
};

function trimAddress(line: string): string {
  const stop = /(БИН|ИИН|\bKZ[0-9A-Za-z]{18}|БИК|\+7|тел|@|в лице|счет|счёт|ИИК|банк|кбе|e-?mail|директор)/i;
  const segs = line.split(',').map((s) => s.trim());
  let start = segs.findIndex((s) => /(^\d{6}$|г\.|город\s|обл\.|область)/i.test(s));
  if (start < 0) start = segs.findIndex((s) => /(ул\.|улица|мкр|проспект|пр-т|пр\.)/i.test(s));
  if (start < 0) return '';
  const outSegs: string[] = [];
  for (let i = start; i < segs.length && outSegs.length < 8; i++) {
    if (stop.test(segs[i])) {
      const head = segs[i].match(/^((?:кв|каб|оф|офис|дом|корпус|здание|уч)\.?\s*[\w/-]+)[.;\s]/i);
      if (head) outSegs.push(head[1]);
      break;
    }
    outSegs.push(segs[i]);
  }
  return outSegs.join(', ').replace(/[;,\s]+$/, '');
}

function cleanBank(value: string): string {
  let v = value.trim();
  while (/^["'“]/.test(v) && /["'”]$/.test(v)) v = v.slice(1, -1).trim();
  return v.replace(/,?\s*г\.\s*[А-ЯЁа-яё-]+\.?\s*$/, '').replace(/[;,\s]+$/, '');
}

/** Вставляете блок реквизитов как есть (из письма/WhatsApp) — раскладываем по полям. */
export function parseRequisitesText(rawText: string): ParsedRequisites {
  const out: ParsedRequisites = {};
  const normalized = String(rawText || '')
    .replace(/товарищество\s+с\s+ограниченной\s+ответственностью/gi, 'ТОО')
    .replace(/общество\s+с\s+ограниченной\s+ответственностью/gi, 'ООО')
    .replace(/акционерное\s+общество/gi, 'АО')
    .replace(/индивидуальный\s+предприниматель/gi, 'ИП');
  let t = ` ${normalized.replace(/ /g, ' ')} `;

  const em = t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (em) out.email = em[0];

  const ib = t.match(/\bKZ[0-9A-Za-z]{18}\b/i);
  if (ib) { out.account = ib[0].toUpperCase(); t = t.replace(ib[0], ' '); }

  const bikLab = t.match(/БИК[\s:№-]*([A-Za-z0-9]{8,11})/i);
  if (bikLab) out.bik = bikLab[1].toUpperCase();
  else {
    const sw = t.match(/\b[A-Za-z]{4}KZ[A-Za-z0-9]{2}(?:[A-Za-z0-9]{3})?\b/);
    if (sw) out.bik = sw[0].toUpperCase();
  }
  if (out.bik) t = t.replace(new RegExp(out.bik, 'i'), ' ');

  const binLab = t.match(/(?:БИН|ИИН)[/\s:№-]*(\d{12})/i);
  if (binLab) out.bin = binLab[1];
  else {
    const b = t.match(/(?:^|\D)(\d{12})(?:\D|$)/);
    if (b) out.bin = b[1];
  }

  const ph = t.match(/(?:\+\s*7|8)[\s(-]*7\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/);
  if (ph) out.phone = ph[0].replace(/\s+/g, ' ').replace(/^\+\s+7/, '+7').trim();

  const nmQuoted = [...t.matchAll(/(ТОО|АО|ИП|ООО|ПТ|ПК|КХ|Филиал)\s*[«"'“]([^«»"'“”\n]+)[»"'”]/g)]
    .map((m) => ({ i: m.index ?? 0, form: m[1], name: `${m[1]} «${m[2].trim()}»` }));
  const nmPlain = [...t.matchAll(/(ТОО|АО|ИП|ООО)\s+(?![«"'“])([A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 .&-]{1,60}?)(?=\s*(?:,|\n|\(|БИН|ИИН|в лице|$))/g)]
    .map((m) => ({ i: m.index ?? 0, form: m[1], name: `${m[1]} ${m[2].trim()}` }));
  const bankCtx = (c: { i: number; name: string }) =>
    /банк/i.test(t.slice(Math.max(0, c.i - 40), c.i)) || /банк|bank/i.test(c.name);
  const nmAll = nmQuoted.concat(nmPlain).filter((c) => !bankCtx(c)).sort((a, b) => a.i - b.i);
  if (nmAll.length) {
    out.name = nmAll[0].name;
    out.type = nmAll[0].form === 'ИП' ? 'ИП' : 'ТОО';
  }

  const addr = t.match(/(?:юридический\s+адрес|юр\.?\s*адрес|фактический\s+адрес|адрес)\s*[:\-–]\s*([^\n]+)/i);
  const addrMarker = /(^\d{6}|г\.|город\s|ул\.|улица|мкр|проспект|пр-т|пр\.|р-н|район|обл\.|область|Республика|офис|дом\s)/i;
  const addrStop = /(банк|БИК|ИИК|счет|счёт|@|тел|whatsapp|БИН|ИИН|директор|в лице|основании)/i;
  if (addr) out.address = trimAddress(addr[1]) || addr[1].trim().replace(/[;,\s]+$/, '');
  else {
    const lines = String(rawText || '').split(/\n/).map((s) => s.trim());
    const isAddrLine = (l: string) => Boolean(l) && addrMarker.test(l) && !addrStop.test(l) && !/адрес/i.test(l);
    let block: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!isAddrLine(lines[i])) continue;
      const grp: string[] = [];
      while (i < lines.length && isAddrLine(lines[i])) { grp.push(lines[i]); i++; }
      if (grp.length > block.length) block = grp;
    }
    if (block.length) {
      out.address = block.join(', ').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').replace(/[;,\s]+$/, '');
    } else {
      const cand = lines.filter((l) => addrMarker.test(l) && !/адрес/i.test(l));
      for (const c of cand.sort((a, b) => b.length - a.length)) {
        const a = trimAddress(c);
        if (a) { out.address = a; break; }
      }
    }
  }

  const bank = t.match(/банк[а-яё]*\s*[:\-–]\s*(\S[^\n]*)/i);
  if (bank && !/^["'«“]?\s*реквизит/i.test(bank[1])) out.bank = cleanBank(bank[1]);
  if (!out.bank && out.bik && KZ_BANKS[out.bik.slice(0, 8)]) out.bank = KZ_BANKS[out.bik.slice(0, 8)];
  if (!out.bank) {
    const bl = String(rawText || '').split(/\n/).map((s) => s.trim())
      .filter((l) => /банк/i.test(l) && !/БИК|счет|счёт|ИИК|реквизит/i.test(l) && !/[:\-–]\s*$/.test(l)
        && !(out.name && l.includes(out.name)));
    const scored = bl.sort((a, b) => (/(АО|ДБ|«)/.test(b) ? 1 : 0) - (/(АО|ДБ|«)/.test(a) ? 1 : 0) || a.length - b.length);
    if (scored.length) out.bank = cleanBank(scored[0]);
  }

  const NP = '[А-ЯЁ][а-яё]+(?:-[А-ЯЁа-яё][а-яё]*)?';
  let signer = t.match(new RegExp(`в\\s+лице\\s+(?:[а-яё]+\\s+){0,3}?(${NP}(?:\\s+${NP}){1,2}|${NP}\\s+[А-ЯЁ]\\.\\s*[А-ЯЁ]\\.)`));
  if (!signer) signer = t.match(new RegExp(
    `(?:[Дд]иректор|[Рр]уководитель|[Уу]правляющ(?:ий|ая)|[Пп]резидент|[Пп]редседатель(?:\\s+[Пп]равления)?)[а-яё]*\\s*[:\\-–]?\\s+(${NP}(?:\\s+${NP}){1,2})`,
  ));
  if (!signer) signer = t.match(new RegExp(`\\b(${NP}\\s+${NP}\\s+[А-ЯЁ][а-яё]+(?:вич|вна|ич|чна|ызы|лы))\\b`));
  if (signer) {
    out.signerFull = signer[1].trim();
    const p = out.signerFull.split(/\s+/);
    if (p.length >= 2 && !/\./.test(out.signerFull)) {
      out.signerShort = `${p[0]} ${p.slice(1).map((x) => `${x[0]}.`).join('')}`;
    }
  }

  const pos = t.match(/(генеральный\s+директор|исполнительный\s+директор|управляющий\s+директор|заместитель\s+директора|председатель\s+правления|директор|управляющий|руководитель|президент)/i);
  if (pos) out.position = pos[1][0].toUpperCase() + pos[1].slice(1).toLowerCase().replace(/\s+/g, ' ');

  const basis = t.match(/на\s+основании\s+([^\n,;.]+)/i);
  let basisRaw = basis ? basis[1].replace(/[)»"']+\s*$/, '').trim() : '';
  if (!basisRaw && /устав/i.test(t)) basisRaw = 'Устава';
  if (!basisRaw && /доверенност/i.test(t)) basisRaw = 'Доверенности';
  if (basisRaw) {
    if (/^устав/i.test(basisRaw)) out.basis = 'Устава';
    else if (/доверенност/i.test(basisRaw)) out.basis = 'Доверенности';
    else if (/приказ/i.test(basisRaw)) out.basis = 'Приказа';
    else if (/свидетельств/i.test(basisRaw)) out.basis = 'Свидетельства о государственной регистрации ИП';
    else if (/талон/i.test(basisRaw)) out.basis = 'Талона предпринимателя';
    else out.basis = basisRaw;
  }

  return out;
}

/** Переносит распознанные поля в объект значений формы по заданному соответствию ключей. */
export function mapParsedToFields<F extends string>(
  parsed: ParsedRequisites,
  mapping: Partial<Record<keyof ParsedRequisites, F>>,
): Partial<Record<F, string>> {
  const result: Partial<Record<F, string>> = {};
  for (const [key, field] of Object.entries(mapping) as [keyof ParsedRequisites, F][]) {
    const value = parsed[key];
    if (value) result[field] = value;
  }
  return result;
}
