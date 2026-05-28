// Geração do documento financeiro (DRE) — imprimir e baixar PDF.
import { jsPDF } from 'jspdf';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

// Monta as linhas do DRE a partir do payload do backend.
function linhasDRE(data) {
  const linhas = [];
  linhas.push({ label: '(+) RECEITA BRUTA', valor: fmt(data?.receitas?.total), bold: true });
  (data?.receitas?.detalhes || []).forEach(d =>
    linhas.push({ label: '   ' + (d.label || d.categoria || 'Item'), valor: fmt(d.total), indent: true }));
  linhas.push({ label: '(-) COMISSÕES', valor: '- ' + fmt(data?.comissoes?.total) });
  linhas.push({ label: '(=) LUCRO BRUTO', valor: fmt(data?.lucroBruto), bold: true, sep: true });
  linhas.push({ label: '(-) DESPESAS', valor: '- ' + fmt(data?.despesas?.total) });
  (data?.despesas?.detalhes || []).forEach(d =>
    linhas.push({ label: '   ' + (d.categoria || 'Despesa'), valor: '- ' + fmt(d.total), indent: true }));
  linhas.push({ label: '(=) LUCRO LÍQUIDO', valor: fmt(data?.lucroLiquido), bold: true, sep: true, big: true });
  return linhas;
}

const periodoLabel = (mes, ano) => `${MESES[(mes || 1) - 1]} de ${ano}`;

// ─── Imprimir: abre janela com HTML A4 e dispara print (permite Salvar como PDF) ───
export function imprimirDRE(data, mes, ano, salaoNome = 'Salão de Beleza') {
  const linhas = linhasDRE(data);
  const rows = linhas.map(l => `
    <tr class="${l.bold ? 'bold' : ''} ${l.sep ? 'sep' : ''} ${l.big ? 'big' : ''}">
      <td class="${l.indent ? 'indent' : ''}">${l.label}</td>
      <td class="val">${l.valor}</td>
    </tr>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Financeiro ${periodoLabel(mes, ano)}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a2e; }
      h1 { font-size: 20px; margin: 0; }
      .sub { color: #666; font-size: 13px; margin: 2px 0 18px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 7px 4px; font-size: 13px; }
      td.val { text-align: right; font-variant-numeric: tabular-nums; }
      tr.bold td { font-weight: 700; }
      tr.sep td { border-top: 1px solid #ccc; }
      tr.big td { font-size: 16px; padding-top: 10px; }
      td.indent { padding-left: 22px; color: #555; }
      .rodape { margin-top: 28px; font-size: 11px; color: #999; }
    </style></head><body>
      <h1>${salaoNome} — Demonstrativo Financeiro</h1>
      <div class="sub">Período: ${periodoLabel(mes, ano)} · Emitido em ${new Date().toLocaleString('pt-BR')}</div>
      <table>${rows}</table>
      <div class="rodape">Documento gerado pelo SoftHair.</div>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) { alert('Permita pop-ups para imprimir.'); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Baixar PDF: jsPDF com layout de texto/linhas ───
export function baixarPdfDRE(data, mes, ano, salaoNome = 'Salão de Beleza') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18;
  const right = 192;
  let y = 22;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(`${salaoNome} — Demonstrativo Financeiro`, left, y);
  y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
  doc.text(`Período: ${periodoLabel(mes, ano)}  ·  Emitido em ${new Date().toLocaleString('pt-BR')}`, left, y);
  doc.setTextColor(20);
  y += 10;

  linhasDRE(data).forEach((l) => {
    if (l.sep) { doc.setDrawColor(200); doc.line(left, y - 3, right, y - 3); }
    doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
    doc.setFontSize(l.big ? 13 : 11);
    doc.text(String(l.label), left + (l.indent ? 6 : 0), y);
    doc.text(String(l.valor), right, y, { align: 'right' });
    y += l.big ? 9 : 7;
    if (y > 280) { doc.addPage(); y = 22; }
  });

  doc.setFontSize(8); doc.setTextColor(150);
  doc.text('Documento gerado pelo SoftHair.', left, 288);

  const nome = `financeiro-${String(mes).padStart(2, '0')}-${ano}.pdf`;
  doc.save(nome);
}
