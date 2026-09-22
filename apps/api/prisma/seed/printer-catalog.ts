/**
 * One-off import of docs/printer-catalog/catalogo.csv into PrinterCatalogModel
 * (global, not tenant-scoped — see printer-catalog.service.ts). Run manually
 * (`npm run prisma:seed-printer-catalog -w apps/api`) whenever the CSV grows
 * with a new researched batch — upserts by manufacturer+model, so re-running
 * after adding rows to the CSV is safe and just updates/adds, never
 * duplicates.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const COUNTER_KEYS = ['contador_total', 'contador_pb', 'contador_colorido', 'contador_duplex', 'contador_copias', 'contador_scanner'];
const SUPPLY_KEYS = ['toner_preto', 'toner_ciano', 'toner_magenta', 'toner_amarelo'];

/** Minimal RFC4180-ish CSV parser — handles quoted fields with embedded commas/semicolons and escaped ("") quotes. No external dependency for a ~40-row file we fully control the format of. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // ignore, \n handles the line break
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

/** "SIM"/"NÃO"/"A CONFIRMAR" (or blank) → true/false/null — the tri-state Printer.capabilities already uses everywhere else. */
function toTriState(value: string): boolean | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'SIM') return true;
  if (normalized === 'NÃO' || normalized === 'NAO') return false;
  return null; // "A CONFIRMAR", blank, "N/A", or anything else — never guessed
}

async function main() {
  const csvPath = join(__dirname, '..', '..', '..', '..', 'docs', 'printer-catalog', 'catalogo.csv');
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'));
  const header = rows[0];
  const dataRows = rows.slice(1);

  const col = (row: string[], name: string) => row[header.indexOf(name)]?.trim() ?? '';

  let count = 0;
  for (const row of dataRows) {
    const manufacturer = col(row, 'marca');
    const model = col(row, 'modelo');
    if (!manufacturer || !model) continue;

    const tipoCor = col(row, 'tipo_cor');
    const capabilities: Record<string, boolean | null> = {
      color: toTriState(tipoCor === 'Colorida' ? 'SIM' : tipoCor === 'Monocromática' ? 'NÃO' : ''),
      duplex: toTriState(col(row, 'duplex_impressao')),
      a3: toTriState(col(row, 'a3')),
      // No standalone "copia" column in the CSV — every "multifuncional=SIM"
      // entry researched so far genuinely is print+copy+scan (confirmed in
      // each row's own observações), so this is a direct read of what was
      // already researched, not a new guess.
      copy: toTriState(col(row, 'multifuncional')),
      scan: toTriState(col(row, 'scanner')),
      fax: toTriState(col(row, 'fax')),
    };

    const countersAvailable: Record<string, boolean | null> = {};
    for (const key of COUNTER_KEYS) {
      const raw = col(row, key);
      if (raw) countersAvailable[key] = toTriState(raw);
    }

    const suppliesAvailable: Record<string, boolean | null> = {};
    for (const key of SUPPLY_KEYS) {
      const raw = col(row, key);
      if (raw) suppliesAvailable[key] = toTriState(raw);
    }

    const deviceTypeRaw = col(row, 'multifuncional') === 'SIM' ? 'MFP' : 'PRINTER';
    const confidence = col(row, 'confianca') || 'BAIXA';
    const status = (col(row, 'status_modelo') || 'A_CONFIRMAR').toUpperCase().replace(/[^A-Z_]/g, '_');

    const existing = await prisma.printerCatalogModel.findFirst({
      where: { manufacturer: { equals: manufacturer, mode: 'insensitive' }, model: { equals: model, mode: 'insensitive' } },
    });

    const data = {
      manufacturer,
      model,
      family: col(row, 'familia') || undefined,
      deviceType: deviceTypeRaw as any,
      capabilities,
      countersAvailable,
      suppliesAvailable,
      confidence,
      status,
      sourcePrimary: col(row, 'fonte_principal') || undefined,
      sourcesSecondary: col(row, 'fontes_secundarias') || undefined,
      notes: col(row, 'observacoes') || undefined,
      researchedAt: new Date(col(row, 'data_consulta') || Date.now()),
    };

    if (existing) {
      await prisma.printerCatalogModel.update({ where: { id: existing.id }, data });
    } else {
      await prisma.printerCatalogModel.create({ data });
    }
    count++;
  }

  console.log(`Catálogo de impressoras: ${count} modelo(s) importado(s)/atualizado(s) de ${csvPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
