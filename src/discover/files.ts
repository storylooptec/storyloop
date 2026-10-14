import readXlsxFile from 'read-excel-file/node';
import { parse } from 'csv-parse/sync';
import { MAX_ROWS, validateDocument, type Cell, type ImportDocument } from './import';

export async function readImport(bytes: Buffer, filename: string, sheetName?: string): Promise<{ document: ImportDocument; sheets: string[] }> {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Choose a non-empty XLSX or CSV file up to 2 MB.');
  let grid: Cell[][];
  let sheets: string[];
  let sheet: string;
  if (/\.xlsx$/i.test(filename)) {
    const workbook = await readXlsxFile(bytes, { trim: false });
    sheets = workbook.map(s => s.sheet);
    const selected = sheetName ? workbook.find(s => s.sheet === sheetName) : workbook[0];
    if (!selected) throw new Error('Select an existing worksheet.');
    sheet = selected.sheet;
    grid = selected.data.map(row => row.map(cell => cell === null || typeof cell === 'string' || typeof cell === 'number' ? cell : cell instanceof Date ? cell.toISOString() : String(cell)));
  } else if (/\.csv$/i.test(filename)) {
    sheet = 'CSV'; sheets = [sheet];
    grid = parse(bytes, { bom: true, skip_empty_lines: false, relax_column_count: true, max_record_size: 100000 }) as string[][];
  } else throw new Error('Only .xlsx and .csv files are supported.');
  if (grid.length > MAX_ROWS + 1) throw new Error(`This sheet exceeds ${MAX_ROWS} data rows. Split it into smaller files; no rows were imported.`);
  const width = Math.max(0, ...grid.map(r => r.length));
  if (width > 50) throw new Error('Use at most 50 source columns.');
  const headers = Array.from({ length: width }, (_, i) => String(grid[0]?.[i] ?? ''));
  const document = { filename, sheet, headers, rows: grid.slice(1).map(row => Array.from({ length: width }, (_, i) => row[i] ?? null)) };
  validateDocument(document);
  return { document, sheets };
}
