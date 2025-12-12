import { NextResponse, type NextRequest } from "next/server";

import { getSessionToken, readIsAuthenticated } from "@/lib/auth";
import { saveImageToHistory } from "@/lib/history";
import { readStoredWorkflows } from "@/lib/workflows";

const MAX_POLL_MS = 600_000;

type ImageEntry = { filename: string; subfolder?: string; type?: string };

function normalizeBaseUrl(raw?: string | null) {
  if (!raw) return "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return "";
  }
}

function buildImageUrl(
  baseUrl: string,
  filename: string,
  subfolder?: string,
  type?: string
) {
  const url = new URL("/view", baseUrl);
  url.searchParams.set("filename", filename);
  url.searchParams.set("type", type || "output");
  url.searchParams.set("subfolder", subfolder || "");
  return url.toString();
}

function extractImageFromBody(body: unknown, promptId?: string): ImageEntry | null {
  if (!body || typeof body !== "object") return null;

  const candidateEntries: unknown[] = [];
  const asRecord = body as Record<string, unknown>;

  const addIfObject = (val: unknown) => {
    if (val && typeof val === "object") {
      candidateEntries.push(val);
    }
  };

  if (promptId) {
    if (asRecord.outputs) {
      const pid = (asRecord as { prompt_id?: unknown }).prompt_id;
      if (!pid || pid === promptId) addIfObject(asRecord);
    }
    if (asRecord[promptId]) addIfObject(asRecord[promptId]);
    if (asRecord.history && typeof asRecord.history === "object") {
      const hist = asRecord.history as Record<string, unknown>;
      if (hist[promptId]) addIfObject(hist[promptId]);
    }
  } else {
    if (asRecord.outputs) addIfObject(asRecord);
    if (asRecord.history && typeof asRecord.history === "object") {
      const hist = asRecord.history as Record<string, unknown>;
      candidateEntries.push(...Object.values(hist));
    }
    if (Array.isArray(body)) {
      candidateEntries.push(...body);
    }
  }

  for (const entry of candidateEntries) {
    if (!entry || typeof entry !== "object") continue;
    const outputs =
      (entry as { outputs?: unknown }).outputs ||
      (entry as { output?: unknown }).output ||
      (entry as { data?: unknown }).data;

    if (outputs && typeof outputs === "object") {
      for (const nodeOutputs of Object.values(outputs) as Array<{
        images?: { filename: string; subfolder?: string; type?: string }[];
      }>) {
        const image = nodeOutputs?.images?.[0];
        if (image?.filename) {
          return {
            filename: image.filename,
            subfolder: image.subfolder,
            type: image.type,
          };
        }
      }
    }
  }

  return null;
}

async function findResultOnce(baseUrl: string, promptId: string) {
  let historyById: Record<string, unknown> | null = null;
  let fullHistory: Record<string, unknown> | null = null;

  try {
    const res = await fetch(`${baseUrl}/history/${promptId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      historyById = (await res.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      const img = extractImageFromBody(historyById, promptId);
      if (img?.filename) {
        return { image: img, history: historyById, fullHistory: null };
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const historyRes = await fetch(`${baseUrl}/history`, { cache: "no-store" });
    if (historyRes.ok) {
      fullHistory = (await historyRes.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      const img = extractImageFromBody(fullHistory, promptId);
      if (img?.filename) {
        return { image: img, history: historyById, fullHistory };
      }
    }
  } catch {
    /* ignore */
  }

  return { image: null, history: historyById, fullHistory };
}

export async function POST(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        promptId?: string;
        baseUrl?: string;
        workflowId?: string;
        start?: number;
        positivePrompt?: string;
        negativePrompt?: string;
        seed?: string | number;
        steps?: string | number;
        inputFilename?: string;
        workflowName?: string;
      }
    | null;

  const promptId = body?.promptId || "";
  const baseUrl = normalizeBaseUrl(body?.baseUrl || "");
  const workflowId = body?.workflowId || "";
  const startTime = body?.start ? Number(body.start) : Date.now();

  if (!promptId || !baseUrl) {
    return NextResponse.json(
      { error: "Missing promptId or baseUrl" },
      { status: 400 },
    );
  }

  if (Date.now() - startTime > MAX_POLL_MS) {
    return NextResponse.json(
      { status: "timeout", error: "Timed out waiting for result" },
      { status: 504 },
    );
  }

  const { image, history, fullHistory } = await findResultOnce(
    baseUrl,
    promptId,
  );
  if (!image) {
    return NextResponse.json({ status: "pending" });
  }

  let workflowName = body?.workflowName;
  if (!workflowName && workflowId) {
    const stored = await readStoredWorkflows();
    const match = stored.find((w) => w.id === workflowId);
    workflowName = match?.name;
  }

  // Best-effort: download and persist output for history
  try {
    const imageRes = await fetch(
      buildImageUrl(baseUrl, image.filename, image.subfolder, image.type),
      { cache: "no-store" },
    );
    if (imageRes.ok) {
      const arrayBuf = await imageRes.arrayBuffer();
      await saveImageToHistory(Buffer.from(arrayBuf), image.filename, {
        promptId,
        workflowId,
        workflowName,
        positivePrompt: body?.positivePrompt,
        negativePrompt: body?.negativePrompt,
        seed: body?.seed,
        steps: body?.steps,
        inputFilename: body?.inputFilename,
      });
    }
  } catch {
    /* ignore history save errors */
  }

  const proxyParams = new URLSearchParams();
  proxyParams.set("filename", image.filename);
  if (image.subfolder) proxyParams.set("subfolder", image.subfolder);
  if (image.type) proxyParams.set("type", image.type);
  proxyParams.set("baseUrl", baseUrl);
  proxyParams.set("token", getSessionToken());
  const proxyUrl = `/api/image?${proxyParams.toString()}`;

  const finalUrl = buildImageUrl(
    baseUrl,
    image.filename,
    image.subfolder,
    image.type,
  );

  return NextResponse.json({
    status: "done",
    imageUrl: finalUrl,
    proxyUrl,
    directUrl: finalUrl,
    usedSeed: body?.seed,
    usedSteps: body?.steps,
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type,
    promptId,
    workflowId,
    workflowName,
    history,
    fullHistory,
  });
}
