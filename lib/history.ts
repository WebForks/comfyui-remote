import { mkdir, readFile, writeFile, rm, stat } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const HISTORY_PATH = path.join(process.cwd(), "data", "history.json");
const OUTPUT_DIR = path.join(process.cwd(), "data", "outputs");

export type HistoryItem = {
  id: string;
  createdAt: string;
  originalFilename: string;
  storedFilename: string;
  promptId?: string;
  workflowId?: string;
};

async function ensureDirs() {
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

export async function readHistory(): Promise<HistoryItem[]> {
  await ensureDirs();
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    return JSON.parse(raw) as HistoryItem[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persistHistory(items: HistoryItem[]) {
  await ensureDirs();
  await writeFile(HISTORY_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function saveImageToHistory(
  buffer: Buffer,
  originalFilename: string,
  opts?: { promptId?: string; workflowId?: string }
): Promise<HistoryItem> {
  await ensureDirs();
  const id = randomUUID();
  const storedFilename = `${Date.now()}-${originalFilename || id}.png`;
  const outPath = path.join(OUTPUT_DIR, storedFilename);
  await writeFile(outPath, buffer);

  const item: HistoryItem = {
    id,
    createdAt: new Date().toISOString(),
    originalFilename: originalFilename || "output.png",
    storedFilename,
    promptId: opts?.promptId,
    workflowId: opts?.workflowId,
  };

  const history = await readHistory();
  history.unshift(item);
  await persistHistory(history);
  return item;
}

export async function deleteHistoryItem(id: string): Promise<HistoryItem | null> {
  const history = await readHistory();
  const idx = history.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  const [item] = history.splice(idx, 1);
  await persistHistory(history);

  if (item?.storedFilename) {
    const filePath = path.join(OUTPUT_DIR, item.storedFilename);
    try {
      const stats = await stat(filePath);
      if (stats.isFile()) await rm(filePath);
    } catch {
      /* ignore */
    }
  }

  return item;
}

export function getStoredFilePath(filename: string) {
  return path.join(OUTPUT_DIR, filename);
}
