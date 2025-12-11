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

    await persistWorkflows(workflows);

    return NextResponse.json({ workflows, saved: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save the uploaded workflows.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
