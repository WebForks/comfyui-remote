import { NextResponse, type NextRequest } from "next/server";

import { readIsAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authed = await readIsAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = request.nextUrl.searchParams.get("base") || "";
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return NextResponse.json({ error: "Missing base URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const targets = [`${trimmed}/system`, `${trimmed}/queue`, trimmed];

    let lastError = "";
    for (const target of targets) {
      try {
        const res = await fetch(target, { method: "GET", signal: controller.signal });
        if (res.ok) {
          clearTimeout(timeout);
          return NextResponse.json({ ok: true });
        }
        lastError = `HTTP ${res.status} ${res.statusText}`;
      } catch (err) {
        lastError =
          err instanceof Error ? err.message : "Unknown fetch error";
      }
    }

    clearTimeout(timeout);
    return NextResponse.json(
      { error: lastError || "Unable to reach ComfyUI" },
      { status: 502 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
