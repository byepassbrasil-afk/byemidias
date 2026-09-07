import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

function getR2() {
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
  const R2_BUCKET = process.env.R2_BUCKET || 'byemidias';
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID) {
    throw new Error('R2 não configurado. Configure as variáveis R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET e R2_PUBLIC_URL no Vercel.');
  }
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    }),
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL,
  };
}

export interface BoletoData {
  invoiceId: string;
  advertiserName: string;
  advertiserEstablishment: string | null;
  advertiserDocument: string | null;
  advertiserEmail: string | null;
  advertiserAddress: string | null;
  organizationName: string;
  organizationDocument: string | null;
  amount: number;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  createdAt: string;
}

/**
 * Generate a professional boleto PDF and upload to R2.
 * Returns the public URL.
 */
export async function generateBoletoPdf(data: BoletoData): Promise<string> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const promise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const BRAND = '#ee6a1e';
  const DARK = '#1f2937';
  const GRAY = '#6b7280';

  // ===== HEADER =====
  // Left: BM logo text
  doc.fillColor(BRAND)
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('ByeMidias', 40, 35, { continued: false });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica').text('SISTEMA DE SINALIZAÇÃO DIGITAL', 40, 58);

  // Right: Recibo do Boleto
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('BOLETO DE COBRANÇA', 400, 35, { align: 'right' });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`Nº ${data.invoiceId.slice(0, 8).toUpperCase()}`, 400, 52, { align: 'right' });

  // Divider
  doc.strokeColor(BRAND).lineWidth(2).moveTo(40, 75).lineTo(555, 75).stroke();

  // ===== CEDENTE / BENEFICIÁRIO =====
  doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold').text('CEDENTE (BENEFICIÁRIO)', 40, 90);
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(data.organizationName, 40, 105);
  if (data.organizationDocument) {
    doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`CNPJ/CPF: ${data.organizationDocument}`, 40, 118);
  }

  // ===== SACADO =====
  doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold').text('SACADO', 300, 90);
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(data.advertiserName, 300, 105);
  if (data.advertiserEstablishment) {
    doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(data.advertiserEstablishment, 300, 118);
  }
  if (data.advertiserDocument) {
    doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`CNPJ/CPF: ${data.advertiserDocument}`, 300, 130);
  }
  if (data.advertiserEmail) {
    doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(data.advertiserEmail, 300, 142);
  }

  // Divider
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(40, 160).lineTo(555, 160).stroke();

  // ===== DADOS DO BOLETO =====
  const leftX = 40;
  const rightX = 350;
  const rowH = 16;
  let y = 175;

  const row = (label: string, value: string, x: number, yPos: number) => {
    doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(label, x, yPos);
    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(value, x, yPos + 10);
  };

  row('Data de Emissão', formatDate(data.createdAt), leftX, y);
  row('Data de Vencimento', data.dueDate ? formatDate(data.dueDate) : 'À vista', rightX, y);
  y += rowH + 18;

  row('Período', data.periodStart && data.periodEnd ? `${formatDate(data.periodStart)} a ${formatDate(data.periodEnd)}` : '—', leftX, y);
  row('Valor Total', `R$ ${Number(data.amount).toFixed(2)}`, rightX, y);
  y += rowH + 18;

  row('Status', data.status.toUpperCase(), leftX, y);
  y += rowH + 20;

  // ===== SERVIÇOS =====
  doc.strokeColor(BRAND).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 12;
  doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text('DESCRIÇÃO DOS SERVIÇOS', 40, y);
  y += 20;

  doc.fillColor(DARK).fontSize(10).font('Helvetica');
  doc.text('Prestação de serviços de mídia digital em dispositivos de sinalização eletrônica.', 40, y, { width: 515 });
  y += 20;
  doc.text(`Anunciante: ${data.advertiserName}${data.advertiserEstablishment ? ` - ${data.advertiserEstablishment}` : ''}`, 40, y, { width: 515 });
  y += 16;

  if (data.periodStart && data.periodEnd) {
    doc.text(`Período contratado: ${formatDate(data.periodStart)} a ${formatDate(data.periodEnd)}`, 40, y, { width: 515 });
    y += 16;
  }

  // ===== VALOR =====
  y += 10;
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(350, y).lineTo(555, y).stroke();
  y += 10;
  doc.fillColor(GRAY).fontSize(9).font('Helvetica').text('VALOR DO BOLETO', 350, y);
  y += 14;
  doc.fillColor(BRAND).fontSize(22).font('Helvetica-Bold').text(`R$ ${Number(data.amount).toFixed(2)}`, 350, y);

  // ===== FOOTER =====
  doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(
    `Documento gerado eletronicamente em ${formatDateTime(data.createdAt)} • ByeMidias`,
    40, 800, { align: 'center', width: 515 }
  );

  doc.end();
  const pdfBuffer = await promise;

  // Upload to R2
  const { client, bucket, publicUrl } = getR2();
  const fileName = `boletos/${data.invoiceId}.pdf`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: fileName,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    CacheControl: 'public, max-age=31536000',
  }));

  return `${publicUrl}/${fileName}`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
}
