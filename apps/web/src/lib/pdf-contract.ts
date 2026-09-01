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
    throw new Error('R2 não configurado');
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

export interface ContractData {
  contractId: string;
  organizationName: string;
  organizationId: string;
  partnerName: string;
  partnerUsername: string;
  partnerEmail?: string;
  startDate: string;
  endDate: string | null;
  durationMonths: number;
  monthlyFee: number;
  hourlyFee: number;
  bonusStructure: any | null;
  customClauses: string | null;
  status: string;
  signedAt: string | null;
  createdAt: string;
}

/**
 * Generate a professional PDF contract and upload to R2.
 * Returns the public URL.
 */
export async function generateContractPdf(data: ContractData): Promise<string> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const promise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Header
  doc.fontSize(20).fillColor('#1f2937').text('CONTRATO DE PARCERIA', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#6b7280').text(`Contrato #${data.contractId.slice(0, 8)}`, { align: 'center' });
  doc.moveDown(2);

  // Parties
  doc.fontSize(14).fillColor('#111827').text('PARTES');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1f2937');
  doc.text(`CONTRATANTE: ${data.organizationName}`, { continued: false });
  doc.fontSize(10).fillColor('#6b7280').text(`ID: ${data.organizationId}`);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#1f2937');
  doc.text(`CONTRATADO: ${data.partnerName} (@${data.partnerUsername})`);
  if (data.partnerEmail) {
    doc.fontSize(10).fillColor('#6b7280').text(`Email: ${data.partnerEmail}`);
  }
  doc.moveDown(2);

  // Vigência
  doc.fontSize(14).fillColor('#111827').text('VIGÊNCIA');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1f2937');
  const endLabel = data.endDate
    ? `Término: ${formatDate(data.endDate)}`
    : 'Término: Sem prazo definido';
  doc.text(`Início: ${formatDate(data.startDate)}`);
  doc.text(endLabel);
  doc.text(`Duração: ${data.durationMonths} ${data.durationMonths === 1 ? 'mês' : 'meses'}`);
  doc.moveDown(2);

  // Valores
  doc.fontSize(14).fillColor('#111827').text('VALORES');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1f2937');
  doc.text(`Mensalidade: R$ ${data.monthlyFee.toFixed(2)}`);
  doc.text(`Valor por hora: R$ ${data.hourlyFee.toFixed(2)}`);
  doc.moveDown(2);

  // Bonificação
  if (data.bonusStructure) {
    doc.fontSize(14).fillColor('#111827').text('BONIFICAÇÕES');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#1f2937');
    if (data.bonusStructure.type === 'tier' && Array.isArray(data.bonusStructure.tiers)) {
      for (const t of data.bonusStructure.tiers) {
        doc.text(`• ≥ ${t.min_hours} horas/mês: bônus de R$ ${Number(t.bonus_amount).toFixed(2)}`);
      }
    } else if (data.bonusStructure.type === 'fixed') {
      doc.text(`• Bônus mensal de R$ ${Number(data.bonusStructure.monthly_bonus_amount).toFixed(2)} ao atingir ${data.bonusStructure.monthly_target_hours} horas`);
    }
    doc.moveDown(2);
  }

  // Cláusulas customizadas
  if (data.customClauses) {
    doc.fontSize(14).fillColor('#111827').text('CLÁUSULAS ADICIONAIS');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#374151').text(data.customClauses, {
      align: 'justify',
      width: 495,
    });
    doc.moveDown(2);
  }

  // Status
  doc.fontSize(12).fillColor('#059669').text(`STATUS: ${data.status.toUpperCase()}`);
  if (data.signedAt) {
    doc.fontSize(10).fillColor('#6b7280').text(`Assinado em: ${formatDateTime(data.signedAt)}`);
  }

  // Footer
  doc.fontSize(8).fillColor('#9ca3af').text(
    `Documento gerado eletronicamente em ${formatDateTime(data.createdAt)} • ByeMidias`,
    50, 800, { align: 'center', width: 495 }
  );

  doc.end();
  const pdfBuffer = await promise;

  // Upload to R2
  const { client, bucket, publicUrl } = getR2();
  const fileName = `contracts/${data.organizationId}/${data.contractId}.pdf`;
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
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
}
