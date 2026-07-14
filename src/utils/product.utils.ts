import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import Counter from '../modules/counter/counter.model';
import { IBulkProductRow } from '../modules/product/product.interface';
// import Counter from '../counter/counter.model';
// import { IBulkProductRow } from './product.interface';

export const ALLOWED_CONDITIONS = [
  'new',
  'open_box',
  'like_new',
  'used',
  'damaged',
  'for_parts',
  'brand_new',
  'like_new_open_box',
  'scratch_and_dent',
  'salvage',
];

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Parses products.csv into typed rows. Row numbers returned are 1-indexed
 * against the CSV data rows (header excluded) for user-facing error messages.
 */
export const parseProductsCsv = (csvPath: string): Array<IBulkProductRow & { row: number }> => {
  const buffer = fs.readFileSync(csvPath);
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((r: any, i: number) => ({
    row: i + 1,
    title: r.title,
    description: r.description,
    category: r.category,
    condition: r.condition,
    reservePrice: Number(r.reservePrice),
    retailPrice: r.retailPrice ? Number(r.retailPrice) : undefined,
    color: r.color ? r.color.split(',').map((c: string) => c.trim()) : [],
    imageFolder: r.imageFolder?.trim(),
    day: r.day,
    quantity: r.quantity ? Number(r.quantity) : 0,
    manufacturer: r.manufacturer?.trim() || undefined,
  }));
};

/**
 * Field-level validation independent of DB state (category existence,
 * image folder existence are checked separately since they need I/O).
 */
export const validateProductRowShape = (row: IBulkProductRow & { row: number }): string | null => {
  if (!row.title) return 'Title is required';
  if (!row.description) return 'Description is required';
  if (!row.category) return 'Category is required';
  if (!row.condition || !ALLOWED_CONDITIONS.includes(row.condition)) {
    return `Invalid condition. Must be one of: ${ALLOWED_CONDITIONS.join(', ')}`;
  }
  if (row.reservePrice != null && (!Number.isFinite(row.reservePrice) || row.reservePrice < 0)) {
    return 'reservePrice must be a non-negative number';
  }
  if (!row.imageFolder) return 'imageFolder is required';
  return null;
};

/** Atomically reserves a contiguous block of N inventory IDs in one DB round-trip. */
export const generateInventoryIdsBatch = async (count: number): Promise<string[]> => {
  if (count === 0) return [];

  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);

  const counter = await Counter.findOneAndUpdate(
    { _id: `inventoryId-${month}-${year}` },
    { $inc: { seq: count } },
    { new: true, upsert: true },
  );

  const start = counter.seq - count + 1;

  return Array.from({ length: count }, (_, i) => {
    const serial = String(start + i).padStart(6, '0');
    return `PRD-${serial}-${month}-${year}`;
  });
};

/** Recursively searches for a file by exact name, returns first match. */
export const findFileRecursive = (dir: string, filename: string): string | null => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, filename);
      if (found) return found;
    } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
};

/** Recursively searches for a directory by exact name, returns first match. */
export const findDirRecursive = (dir: string, dirName: string): string | null => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.name.toLowerCase() === dirName.toLowerCase()) return fullPath;
    const found = findDirRecursive(fullPath, dirName);
    if (found) return found;
  }
  return null;
};

/** Returns absolute paths of image files (by extension) inside a folder. Non-recursive. */
export const listImageFiles = (folderPath: string): string[] => {
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(folderPath, e.name));
};

/** Best-effort recursive delete; never throws — cleanup should not crash the request. */
export const safeCleanup = (targetPath: string): void => {
  fs.rm(targetPath, { recursive: true, force: true }, () => {});
};

export const generateAuctionId = async (): Promise<string> => {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);

  const counter = await Counter.findOneAndUpdate(
    { _id: `auctionId-${month}-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `AUC-${String(counter.seq).padStart(6, '0')}-${month}-${year}`;
};
