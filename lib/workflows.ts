import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type WorkflowNode = {
  id?: number | string;
  type?: string;
  title?: string;
  widgets_values?: unknown[];
  inputs?: unknown[];
};

export type WorkflowSummary = {
  totalNodes: number;
  workflowType: "image-to-image" | "text-to-image" | "unknown";
  typeCounts: Record<string, number>;
  loadImageNodes: WorkflowNode[];
  saveImageNodes: WorkflowNode[];
  promptNodes: WorkflowNode[];
  positivePromptNodes: WorkflowNode[];
  negativePromptNodes: WorkflowNode[];
};

export type StoredWorkflow = {
  id: string;
  name: string;
  path?: string;
  summary: WorkflowSummary;
  raw: unknown;
};

const WORKFLOW_STORE_PATH = path.join(process.cwd(), "data", "workflows.json");

export function normalizeBaseList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    ("workflows" in payload || "items" in payload)
  ) {
    const obj = payload as { workflows?: unknown; items?: unknown };
    const list = obj.workflows || obj.items;
    if (Array.isArray(list)) return list;
  }
  if (payload && typeof payload === "object") return [payload];
  return [];
}

export function summarizeWorkflow(raw: unknown): WorkflowSummary {
  const nodes: WorkflowNode[] = Array.isArray((raw as { nodes?: unknown })?.nodes)
    ? ((raw as { nodes: WorkflowNode[] }).nodes as WorkflowNode[])
    : [];

  const typeCounts: Record<string, number> = {};
  const loadImageNodes: WorkflowNode[] = [];
  const saveImageNodes: WorkflowNode[] = [];
  const promptNodes: WorkflowNode[] = [];
  const positivePromptNodes: WorkflowNode[] = [];
  const negativePromptNodes: WorkflowNode[] = [];

  for (const node of nodes) {
    const type = String(node?.type ?? "Unknown");
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const normalizedType = type.toLowerCase();
    const title = typeof node?.title === "string" ? node.title : "";
    const normalizedTitle = title.toLowerCase();

    if (normalizedType.includes("loadimage") || normalizedType === "loadimage") {
      loadImageNodes.push(node);
    }
    if (normalizedType.includes("saveimage") || normalizedType === "saveimage") {
      saveImageNodes.push(node);
    }
    if (
      /prompt/i.test(type) ||
      /textencode/i.test(type) ||
      /cliptextencode/i.test(type)
    ) {
      promptNodes.push(node);
      if (/negative/.test(normalizedTitle)) {
        negativePromptNodes.push(node);
      } else {
        positivePromptNodes.push(node);
      }
    }
  }

  let workflowType: WorkflowSummary["workflowType"] = "unknown";
  if (loadImageNodes.length > 0) {
    workflowType = "image-to-image";
  } else if (promptNodes.length > 0) {
    workflowType = "text-to-image";
  }

  return {
    totalNodes: nodes.length,
    workflowType,
    typeCounts,
    loadImageNodes,
    saveImageNodes,
    promptNodes,
    positivePromptNodes,
    negativePromptNodes,
  };
}

export function normalizeWorkflows(payload: unknown): StoredWorkflow[] {
  const list = normalizeBaseList(payload);

  return list.map((entry, index) => {
    const item = entry as {
      id?: unknown;
      name?: unknown;
      title?: unknown;
      path?: unknown;
      raw?: unknown;
      summary?: WorkflowSummary;
    };
    const baseWorkflow = item.raw ?? item;
    const id =
      item?.id ??
      item?.name ??
      item?.title ??
      `workflow-${index + 1}-${Date.now()}`;
    const name = item?.name || item?.title || item?.id || `Workflow ${index + 1}`;

    const summary = item?.summary ?? summarizeWorkflow(baseWorkflow);
    const raw = item?.raw ?? baseWorkflow;

    return {
      id: String(id),
      name: String(name),
      path: typeof item?.path === "string" ? item.path : undefined,
      summary,
      raw,
    };
  });
}

export async function readStoredWorkflows(): Promise<StoredWorkflow[]> {
  try {
    const raw = await readFile(WORKFLOW_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const source =
      (parsed as { workflows?: unknown })?.workflows !== undefined
        ? (parsed as { workflows?: unknown }).workflows
        : parsed;

    return normalizeWorkflows(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function persistWorkflows(workflows: StoredWorkflow[]) {
  await mkdir(path.dirname(WORKFLOW_STORE_PATH), { recursive: true });
  await writeFile(
    WORKFLOW_STORE_PATH,
    JSON.stringify({ workflows }, null, 2),
    "utf8",
  );
}

export { WORKFLOW_STORE_PATH };
