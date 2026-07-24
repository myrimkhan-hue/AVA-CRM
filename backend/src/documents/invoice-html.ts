import { amountToWordsWithTiyin, formatAmount } from './lib/amount-to-words';
import { formatDateRu } from './lib/format-date-ru';

export interface InvoicePdfLine {
  serviceName: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
}

export interface InvoicePdfParty {
  name: string;
  bin: string;
  address: string;
}

export interface InvoicePdfIssuer extends InvoicePdfParty {
  account: string;
  bank: string;
  bik: string;
  signerShort: string;
}

export interface InvoicePdfBuyer extends InvoicePdfParty {
  phone: string;
}

export interface InvoicePdfData {
  number: string;
  issueDate: Date;
  currencyCode: string;
  issuer: InvoicePdfIssuer;
  buyer: InvoicePdfBuyer;
  contractNumber: string | null;
  contractDate: Date | null;
  lines: InvoicePdfLine[];
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildInvoiceHtml(data: InvoicePdfData): string {
  const vat = Number(data.vatAmount);
  const total = Number(data.totalAmount);
  const rows = data.lines.map((line, index) => `
    <tr>
      <td class="c">${index + 1}</td>
      <td>${escapeHtml(line.serviceName)}</td>
      <td class="c">${line.quantity}</td>
      <td class="c">усл.</td>
      <td class="r">${formatAmount(Number(line.unitPrice))}</td>
      <td class="r">${formatAmount(Number(line.totalAmount))}</td>
    </tr>`).join('');

  const totalWords = data.currencyCode === 'KZT'
    ? `${formatAmount(total)} (${amountToWordsWithTiyin(total)})`
    : `${formatAmount(total)} ${data.currencyCode}`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  .bank-box { border: 1px solid #333; padding: 8px 10px; margin-bottom: 14px; font-size: 10.5px; }
  .bank-box table { width: 100%; border-collapse: collapse; }
  .bank-box td { padding: 1px 4px; vertical-align: top; }
  .bank-box .label { color: #444; white-space: nowrap; }
  .party { margin-bottom: 6px; }
  .party b { display: inline-block; min-width: 90px; }
  table.items { width: 100%; border-collapse: collapse; margin: 14px 0; }
  table.items th, table.items td { border: 1px solid #333; padding: 4px 6px; }
  table.items th { background: #f0f0f0; font-weight: 600; font-size: 10.5px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .totals { margin-top: 6px; }
  .totals div { margin: 2px 0; }
  .totals .grand { font-weight: 700; font-size: 12px; }
  .signature { margin-top: 36px; }
</style>
</head>
<body>
  <h1>Счёт на оплату № ${escapeHtml(data.number)} от ${formatDateRu(data.issueDate)}</h1>

  <div class="bank-box">
    <table>
      <tr><td class="label">Бенефициар:</td><td>${escapeHtml(data.issuer.name)}, БИН ${escapeHtml(data.issuer.bin)}</td></tr>
      <tr><td class="label">ИИК:</td><td>${escapeHtml(data.issuer.account)}</td><td class="label">Кбе:</td><td>17</td></tr>
      <tr><td class="label">Банк бенефициара:</td><td>${escapeHtml(data.issuer.bank)}</td><td class="label">БИК:</td><td>${escapeHtml(data.issuer.bik)}</td></tr>
    </table>
  </div>

  <div class="party"><b>Поставщик:</b> БИН ${escapeHtml(data.issuer.bin)}, ${escapeHtml(data.issuer.name)}, ${escapeHtml(data.issuer.address)}</div>
  <div class="party"><b>Покупатель:</b> БИН ${escapeHtml(data.buyer.bin)}, ${escapeHtml(data.buyer.name)}, ${escapeHtml(data.buyer.address)}${data.buyer.phone !== '—' ? `, тел.: ${escapeHtml(data.buyer.phone)}` : ''}</div>
  ${data.contractNumber ? `<div class="party"><b>Договор:</b> № ${escapeHtml(data.contractNumber)} от ${data.contractDate ? formatDateRu(data.contractDate) : ''}</div>` : ''}

  <table class="items">
    <thead>
      <tr><th class="c">№</th><th>Наименование</th><th class="c">Кол-во</th><th class="c">Ед.</th><th class="r">Цена</th><th class="r">Сумма</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div>Итого: <b>${formatAmount(total)} ${escapeHtml(data.currencyCode)}</b></div>
    ${vat > 0 ? `<div>В том числе НДС: ${formatAmount(vat)} ${escapeHtml(data.currencyCode)}</div>` : '<div>Без НДС</div>'}
    <div>Всего наименований ${data.lines.length}, на сумму ${formatAmount(total)} ${escapeHtml(data.currencyCode)}</div>
    <div class="grand">Всего к оплате: ${totalWords}</div>
  </div>

  <div class="signature">Исполнитель &nbsp;&nbsp;_____________________&nbsp;&nbsp; /${escapeHtml(data.issuer.signerShort)}/</div>
</body>
</html>`;
}
