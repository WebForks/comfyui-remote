import { randomUUID } from "crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getSessionToken, readIsAuthenticated } from "@/lib/auth";
import {
  readStoredWorkflows,
  summarizeWorkflow,
  type WorkflowNode,
} from "@/lib/workflows";

class NoImageFound extends Error {
  history?: unknown;
  fullHistory?: unknown;
  constructor(message: string, history?: unknown, fullHistory?: unknown) {
    super(message);
    this.history = history;
    this.fullHistory = fullHistory;
  }
}

const MAX_POLL_MS = 600_000;
const POLL_INTERVAL_MS = 1_500;

type WorkflowGraph = Record<string, unknown> & {
  nodes?: WorkflowNode[];
  links?: unknown;
};

function stripIgnoredNodes(workflow: WorkflowGraph) {
  const nodes: WorkflowNode[] = Array.isArray(workflow?.nodes)
    ? workflow.nodes
    : [];
  const links: unknown[] = Array.isArray(workflow?.links) ? workflow.links : [];

const ignoredTypes = new Set(["note", "markdownnote"]);
  const keptNodes = nodes.filter((node) => {
    const typeLower = String(node?.type ?? "").toLowerCase();
    return !ignoredTypes.has(typeLower);
  });
  const removedIds = new Set(
    nodes
      .filter((node) => !keptNodes.includes(node))
      .map((node) => String(node?.id ?? "")),
  );

  const keptLinks = links.filter((link) => {
    if (!Array.isArray(link) || link.length < 5) return false;
    const [, fromNodeRaw, , toNodeRaw] = link as [unknown, unknown, unknown, unknown];
    const fromId = String(fromNodeRaw);
    const toId = String(toNodeRaw);
    return !removedIds.has(fromId) && !removedIds.has(toId);
  });

  workflow.nodes = keptNodes;
  workflow.links = keptLinks;
}

function ensureClassTypes(workflow: WorkflowGraph) {
  const nodes: WorkflowNode[] = Array.isArray(workflow?.nodes)
    ? workflow.nodes
    : [];

  for (const node of nodes) {
    if (!node) continue;
    if (!(node as { class_type?: string }).class_type) {
      (node as { class_type?: string }).class_type =
        typeof node.type === "string" ? node.type : "Unknown";
    }
  }
}

const widgetInputHints: Record<string, string[]> = {
  KSampler: ["seed", "steps", "cfg", "sampler_name", "scheduler", "denoise"],
  ImageScaleToTotalPixels: ["upscale_method", "total_pixels"],
  CLIPTextEncode: ["text"],
  FluxGuidance: ["guidance_strength"],
  VAELoader: ["vae"],
  DualCLIPLoader: ["clip", "t5xxl", "type", "mode"],
  LoraLoaderModelOnly: ["lora_name", "strength"],
  LoadImage: ["image", "type"],
  UNETLoader: ["unet_name", "type"],
  SaveImage: ["filename"],
  CLIPLoader: ["clip_name", "type"],
  TextEncodeQwenImageEdit: ["prompt"],
  ModelSamplingAuraFlow: ["shift"],
  CFGNorm: ["strength"],
};

function getWidgetNames(type?: string) {
  if (!type) return [];
  return (
    widgetInputHints[type] || widgetInputHints[type.replace(/\s+/g, "")] || []
  );
}

function buildPromptGraph(workflow: WorkflowGraph) {
  const nodes: WorkflowNode[] = Array.isArray(workflow?.nodes)
    ? workflow.nodes
    : [];
  const links: unknown[] = Array.isArray(workflow?.links) ? workflow.links : [];
  const nodeMap = new Map<string, WorkflowNode>();
  const prompt: Record<
    string,
    { class_type: string; inputs: Record<string, unknown> }
  > = {};

  nodes.forEach((node, idx) => {
    const rawId = node?.id !== undefined ? node.id : `node-${idx}`;
    const idStr = String(rawId);
    nodeMap.set(idStr, node);
    prompt[idStr] = {
      class_type: (node?.type as string) || "Unknown",
      inputs: {},
    };
  });

  // Map links to inputs
  for (const link of links) {
    if (!Array.isArray(link) || link.length < 5) continue;
    const [, fromNodeRaw, fromSlot, toNodeRaw, toSlot] = link as [
      unknown,
      unknown,
      number,
      unknown,
      number,
      unknown?
    ];
    const fromId = String(fromNodeRaw);
    const toId = String(toNodeRaw);
    const fromIndex = Number(fromSlot ?? 0);

    const toNode = nodeMap.get(toId) as
      | (WorkflowNode & {
          inputs?: { name?: string }[];
          outputs?: { name?: string }[];
        })
      | undefined;

    const inputName =
      (Array.isArray(toNode?.inputs) && toNode.inputs[toSlot]?.name) ||
      String(toSlot);

    if (prompt[toId]) {
      prompt[toId].inputs[inputName] = [fromId, fromIndex];
    }
  }

  // Map widget values to inputs
  nodes.forEach((node, idx) => {
    const id = node?.id !== undefined ? String(node.id) : `node-${idx}`;
    const promptNode = prompt[id];
    if (!promptNode) return;

    const widgetValues = Array.isArray(node.widgets_values)
      ? [...node.widgets_values]
      : [];
    const inputDefs = Array.isArray(node.inputs) ? node.inputs : [];

    // Non-linked inputs via input definitions (consume widget values in order)
    inputDefs.forEach((inputDef, inputIdx) => {
      const name = (inputDef as { name?: string })?.name || String(inputIdx);
      const hasLink = (inputDef as { link?: unknown })?.link !== undefined;
      if (!hasLink && promptNode.inputs[name] === undefined) {
        if (widgetValues.length) {
          promptNode.inputs[name] = widgetValues.shift();
        }
      }
    });

    // Node-specific mappings for common ComfyUI nodes
    const typeLower = String(node.type ?? "").toLowerCase();
    const typeExact = String(node.type ?? "");

    if (typeLower === "saveimage") {
      const prefix =
        widgetValues[0] !== undefined ? widgetValues[0] : "ComfyUI";

      if (promptNode.inputs["filename_prefix"] === undefined) {
        promptNode.inputs["filename_prefix"] = prefix;
      }
    }

    if (typeLower === "vaeloader") {
      if (
        widgetValues[0] !== undefined &&
        promptNode.inputs["vae_name"] === undefined
      ) {
        promptNode.inputs["vae_name"] = widgetValues[0];
      }
    }

    if (typeLower === "dualcliploader") {
      const [clip1, clip2, typeVal, mode] = widgetValues;
      if (
        clip1 !== undefined &&
        promptNode.inputs["clip_name1"] === undefined
      ) {
        promptNode.inputs["clip_name1"] = clip1;
      }
      if (
        clip2 !== undefined &&
        promptNode.inputs["clip_name2"] === undefined
      ) {
        promptNode.inputs["clip_name2"] = clip2;
      }
      if (typeVal !== undefined && promptNode.inputs["type"] === undefined) {
        promptNode.inputs["type"] = typeVal;
      }
      if (mode !== undefined && promptNode.inputs["mode"] === undefined) {
        promptNode.inputs["mode"] = mode;
      }
    }

    if (typeExact === "ImageScaleToTotalPixels") {
      const [upscaleMethod, megapixels] = widgetValues;
      if (
        upscaleMethod !== undefined &&
        promptNode.inputs["upscale_method"] === undefined
      ) {
        promptNode.inputs["upscale_method"] = upscaleMethod;
      }
      if (
        megapixels !== undefined &&
        promptNode.inputs["megapixels"] === undefined
      ) {
        promptNode.inputs["megapixels"] = megapixels;
      }
    }

    if (typeExact === "FluxGuidance") {
      const [guidance] = widgetValues;
      if (
        guidance !== undefined &&
        promptNode.inputs["guidance"] === undefined
      ) {
        promptNode.inputs["guidance"] = guidance;
      }
    }

    if (typeLower === "unetloader") {
      const [unetName, weightDtype] = widgetValues;
      if (
        unetName !== undefined &&
        promptNode.inputs["unet_name"] === undefined
      ) {
        promptNode.inputs["unet_name"] = unetName;
      }
      if (
        weightDtype !== undefined &&
        promptNode.inputs["weight_dtype"] === undefined
      ) {
        promptNode.inputs["weight_dtype"] = weightDtype;
      }
    }

    if (typeLower === "loraloadermodelonly") {
      const [loraName, strengthModel] = widgetValues;
      if (
        loraName !== undefined &&
        promptNode.inputs["lora_name"] === undefined
      ) {
        promptNode.inputs["lora_name"] = loraName;
      }
      if (
        strengthModel !== undefined &&
        promptNode.inputs["strength_model"] === undefined
      ) {
        promptNode.inputs["strength_model"] = strengthModel;
      }
    }

    if (typeLower === "ksampler") {
      // Observed widget order: [seed, seed_behavior?, steps, cfg, sampler_name, scheduler, denoise]
      const [seed, , steps, cfg, samplerName, scheduler, denoise] =
        widgetValues;

      if (seed !== undefined && promptNode.inputs["seed"] === undefined) {
        promptNode.inputs["seed"] = seed;
      }
      if (steps !== undefined && promptNode.inputs["steps"] === undefined) {
        promptNode.inputs["steps"] = steps;
      }
      if (cfg !== undefined && promptNode.inputs["cfg"] === undefined) {
        promptNode.inputs["cfg"] = cfg;
      }
      if (
        samplerName !== undefined &&
        promptNode.inputs["sampler_name"] === undefined
      ) {
        promptNode.inputs["sampler_name"] = samplerName;
      }
      if (
        scheduler !== undefined &&
        promptNode.inputs["scheduler"] === undefined
      ) {
        promptNode.inputs["scheduler"] = scheduler;
      }
      if (denoise !== undefined && promptNode.inputs["denoise"] === undefined) {
        promptNode.inputs["denoise"] = denoise;
      }
    }

    // Known widget hint mapping
    const hints = getWidgetNames(node.type as string);
    hints.forEach((hint, i) => {
      if (
        widgetValues[i] !== undefined &&
        promptNode.inputs[hint] === undefined
      ) {
        promptNode.inputs[hint] = widgetValues[i];
      }
    });

    // Text prompt fallback
    if (
      (/textencode/.test(typeLower) || /prompt/.test(typeLower)) &&
      promptNode.inputs["text"] === undefined &&
      widgetValues[0] !== undefined
    ) {
      promptNode.inputs["text"] = widgetValues[0];
    }

    // Custom node prompt mapping
    if (
      typeExact === "TextEncodeQwenImageEdit" &&
      widgetValues[0] !== undefined &&
      promptNode.inputs["prompt"] === undefined
    ) {
      promptNode.inputs["prompt"] = widgetValues[0];
    }

    if (
      typeExact === "CLIPLoader" &&
      widgetValues[0] !== undefined &&
      promptNode.inputs["clip_name"] === undefined
    ) {
      promptNode.inputs["clip_name"] = widgetValues[0];
      if (widgetValues[1] !== undefined && promptNode.inputs["type"] === undefined) {
        promptNode.inputs["type"] = widgetValues[1];
      }
    }

    if (
      typeExact === "ModelSamplingAuraFlow" &&
      widgetValues[0] !== undefined &&
      promptNode.inputs["shift"] === undefined
    ) {
      promptNode.inputs["shift"] = widgetValues[0];
    }

    if (
      typeExact === "CFGNorm" &&
      widgetValues[0] !== undefined &&
      promptNode.inputs["strength"] === undefined
    ) {
      promptNode.inputs["strength"] = widgetValues[0];
    }

    // Any remaining widget values -> valueX
    widgetValues.forEach((val, i) => {
      const key = `value${i}`;
      if (promptNode.inputs[key] === undefined) {
        promptNode.inputs[key] = val;
      }
    });
  });

  return prompt;
}

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

function setPromptTexts(
  workflow: WorkflowGraph,
  positivePrompt: string,
  negativePrompt: string
) {
  const nodes: WorkflowNode[] = Array.isArray(workflow?.nodes)
    ? workflow.nodes
    : [];

  for (const node of nodes) {
    const type = String(node?.type ?? "").toLowerCase();
    const title =
      typeof node?.title === "string" ? node.title.toLowerCase() : "";
    const widgets = Array.isArray(node?.widgets_values)
      ? node.widgets_values
      : undefined;

    if (
      /prompt/.test(type) ||
      /textencode/.test(type) ||
      /cliptextencode/.test(type)
    ) {
      const isNegative = /negative/.test(title);
      const target = isNegative ? negativePrompt : positivePrompt;
      if (widgets && widgets.length > 0) {
        widgets[0] = target;
      } else if (Array.isArray(node.widgets_values)) {
        node.widgets_values[0] = target;
      } else {
        node.widgets_values = [target];
      }
    }
  }
}

function setLoadImageFilename(workflow: WorkflowGraph, filename: string) {
  const nodes: WorkflowNode[] = Array.isArray(workflow?.nodes)
    ? workflow.nodes
    : [];

  for (const node of nodes) {
    const type = String(node?.type ?? "").toLowerCase();
    if (type.includes("loadimage") || type === "loadimage") {
      if (
        Array.isArray(node.widgets_values) &&
        node.widgets_values.length > 0
      ) {
        node.widgets_values[0] = filename;
      } else {
        node.widgets_values = [filename];
      }
    }
  }
}

async function uploadImage(
  baseUrl: string,
  file: File
): Promise<string | null> {
  const target = `${baseUrl}/upload/image`;
  const form = new FormData();
  form.append("image", file);

  const response = await fetch(target, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(
      reason || `ComfyUI responded with ${response.status} on upload.`
    );
  }

  const raw = await response.text();
  let data: { name?: string; filename?: string } | null = null;
  try {
    data = JSON.parse(raw) as { name?: string; filename?: string };
  } catch {
    /* ignore */
  }

  if (!data) {
    throw new Error(
      `Unexpected response from ComfyUI upload: ${raw.slice(0, 200)}`
    );
  }

  return data.name || data.filename || file.name || null;
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

type ImageEntry = { filename: string; subfolder?: string; type?: string };

function extractImageFromBody(body: unknown, promptId?: string): ImageEntry | null {
  if (!body || typeof body !== "object") return null;

  const candidateEntries: unknown[] = [];

  const asRecord = body as Record<string, unknown>;
  if (asRecord.outputs) candidateEntries.push(asRecord);
  if (promptId && asRecord[promptId]) candidateEntries.push(asRecord[promptId]);
  if (asRecord.history) {
    const hist = asRecord.history as Record<string, unknown>;
    if (promptId && hist[promptId]) candidateEntries.push(hist[promptId]);
    candidateEntries.push(...Object.values(hist));
  }

  if (Array.isArray(body)) {
    candidateEntries.push(...body);
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

type PollResult = {
  imageUrl: string;
  filename: string;
  subfolder?: string;
  type?: string;
  promptId: string;
  clientId: string;
  history?: unknown;
  fullHistory?: unknown;
};

async function pollForResult(
  baseUrl: string,
  promptId: string
): Promise<PollResult> {
  const start = Date.now();
  let lastHistoryById: unknown = null;
  let lastFullHistory: unknown = null;

  while (Date.now() - start < MAX_POLL_MS) {
    const res = await fetch(`${baseUrl}/history/${promptId}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const body = (await res.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (body) {
        lastHistoryById = body;
        const image = extractImageFromBody(body, promptId);
        if (image?.filename) {
          return {
            imageUrl: buildImageUrl(
              baseUrl,
              image.filename,
              image.subfolder,
              image.type
            ),
            filename: image.filename,
            subfolder: image.subfolder,
            type: image.type,
            promptId,
            clientId: "",
            history: body,
          };
        }
      }
    }

    const historyRes = await fetch(`${baseUrl}/history`, { cache: "no-store" });
    if (historyRes.ok) {
      const historyBody = (await historyRes.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      if (historyBody) {
        lastFullHistory = historyBody;
        const image = extractImageFromBody(historyBody, promptId);
        if (image?.filename) {
          return {
            imageUrl: buildImageUrl(
              baseUrl,
              image.filename,
              image.subfolder,
              image.type
            ),
            filename: image.filename,
            subfolder: image.subfolder,
            type: image.type,
            promptId,
            clientId: "",
            history: lastHistoryById,
            fullHistory: historyBody,
          };
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new NoImageFound(
    "Timed out or no image found in history.",
    lastHistoryById,
    lastFullHistory
  );
}

export async function POST(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" }
    );
  }

  try {
    const form = await req.formData();
    const workflowId = (form.get("workflowId") as string | null)?.trim();
    const baseUrlRaw = (form.get("baseUrl") as string | null)?.trim() || "";
    const positivePrompt = (form.get("positivePrompt") as string | null) ?? "";
    const negativePrompt = (form.get("negativePrompt") as string | null) ?? "";
    const imageFile = form.get("image") as File | null;

    const baseUrl = normalizeBaseUrl(baseUrlRaw);

    if (!workflowId) {
      return NextResponse.json(
        { error: "Select a workflow before running." },
        { status: 400 }
      );
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Set a valid ComfyUI base URL first." },
        { status: 400 }
      );
    }

    const stored = await readStoredWorkflows();
    const workflow = stored.find((item) => item.id === workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found on the server." },
        { status: 404 }
      );
    }

    const workingCopy = structuredClone(
      workflow.raw ?? workflow
    ) as WorkflowGraph;

    if (imageFile) {
      const uploadedName = await uploadImage(baseUrl, imageFile);
      if (uploadedName) {
        setLoadImageFilename(workingCopy, uploadedName);
      }
    }

    stripIgnoredNodes(workingCopy);
    setPromptTexts(workingCopy, positivePrompt, negativePrompt);
    ensureClassTypes(workingCopy);
    const promptGraph = buildPromptGraph(workingCopy);

    const clientId = randomUUID();
    const response = await fetch(`${baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        prompt: promptGraph,
      }),
    });

    if (!response.ok) {
      const reason = await response.text();
      return NextResponse.json(
        {
          error:
            reason || `ComfyUI responded with ${response.status} on /prompt.`,
        },
        { status: response.status }
      );
    }

    const rawPrompt = await response.text();
    let parsedPrompt: { prompt_id?: string } | null = null;
    try {
      parsedPrompt = JSON.parse(rawPrompt) as { prompt_id?: string };
    } catch {
      /* ignore */
    }

    const promptId = parsedPrompt?.prompt_id;

    if (!promptId) {
      return NextResponse.json(
        {
          error:
            "ComfyUI did not return a prompt_id. Response: " +
            rawPrompt.slice(0, 200),
        },
        { status: 500 }
      );
    }

    const result = await pollForResult(baseUrl, promptId);
    // Use a relative proxy URL so it works behind reverse proxies
    const proxyParams = new URLSearchParams();
    proxyParams.set("filename", result.filename);
    if (result.subfolder) proxyParams.set("subfolder", result.subfolder);
    if (result.type) proxyParams.set("type", result.type);
    proxyParams.set("baseUrl", baseUrl);
    proxyParams.set("token", getSessionToken());
    const proxyUrl = `/api/image?${proxyParams.toString()}`;

    return NextResponse.json({
      ...result,
      proxyUrl: proxyUrl.toString(),
      directUrl: result.imageUrl,
      clientId,
      workflowId,
      summary: summarizeWorkflow(workingCopy),
    });
  } catch (error) {
    if (error instanceof NoImageFound) {
      return NextResponse.json(
        {
          error: error.message,
          history: error.history,
          fullHistory: error.fullHistory,
        },
        { status: 502 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to run workflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
