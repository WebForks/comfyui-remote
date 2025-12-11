import { NextResponse, type NextRequest } from "next/server";

import { readIsAuthenticated } from "@/lib/auth";
import {
  normalizeWorkflows,
  persistWorkflows,
  readStoredWorkflows,
} from "@/lib/workflows";

export async function GET() {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" },
    );
  }

  try {
    const workflows = await readStoredWorkflows();
    return NextResponse.json({ workflows, source: "stored" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read stored workflows.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a JSON file under the 'file' field." },
        { status: 400 },
      );
    }

    const content = await file.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `Could not parse JSON: ${err.message}`
              : "Could not parse JSON file.",
        },
        { status: 400 },
      );
    }

    const workflows = normalizeWorkflows(parsed).filter(
      (wf, index, self) =>
        wf.id &&
        wf.name &&
        self.findIndex((item) => item.id === wf.id) === index,
    );

    if (!workflows.length) {
      return NextResponse.json(
        {
          error:
            "No workflows found in the uploaded file. Expect an array of workflows or an object with a 'workflows' array.",
        },
        { status: 400 },
      );
    }

    const existing = await readStoredWorkflows();
    const mergedMap = new Map<string, (typeof workflows)[number]>();

    // Keep existing first to avoid accidental overwrite when IDs collide
    existing.forEach((wf) => mergedMap.set(wf.id, wf));
    workflows.forEach((wf) => {
      let candidateId = wf.id;
      let counter = 1;
      while (mergedMap.has(candidateId)) {
        candidateId = `${wf.id}-${counter++}`;
      }
      mergedMap.set(candidateId, { ...wf, id: candidateId });
    });

    const merged = Array.from(mergedMap.values());

    await persistWorkflows(merged);

    return NextResponse.json({ workflows: merged, saved: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save the uploaded workflows.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" },
    );
  }

  try {
    const body = (await req.json()) as { id?: string; name?: string };
    const id = body.id?.trim();
    const name = body.name?.trim();

    if (!id || !name) {
      return NextResponse.json(
        { error: "Both id and name are required." },
        { status: 400 },
      );
    }

    const workflows = await readStoredWorkflows();
    const updated = workflows.map((wf) =>
      wf.id === id ? { ...wf, name } : wf,
    );

    await persistWorkflows(updated);
    return NextResponse.json({ workflows: updated, updated: id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename workflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" },
    );
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { error: "Missing id to delete." },
        { status: 400 },
      );
    }

    const workflows = await readStoredWorkflows();
    const filtered = workflows.filter((wf) => wf.id !== id);

    await persistWorkflows(filtered);
    return NextResponse.json({ workflows: filtered, deleted: id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete workflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
