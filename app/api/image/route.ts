import { NextResponse, type NextRequest } from "next/server";

import { readIsAuthenticated, verifySessionToken } from "@/lib/auth";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename") || "";
  const subfolder = searchParams.get("subfolder") || "";
  const type = searchParams.get("type") || "output";
  const baseUrl = normalizeBaseUrl(searchParams.get("baseUrl"));
  const token = searchParams.get("token");

  const authed = (await readIsAuthenticated()) || verifySessionToken(token);
  if (!authed) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" }
    );
  }

  if (!filename || !baseUrl) {
    return NextResponse.json(
      { error: "Missing filename or baseUrl." },
      { status: 400 }
    );
  }

  const target = new URL("/view", baseUrl);
  target.searchParams.set("filename", filename);
  target.searchParams.set("subfolder", subfolder);
  target.searchParams.set("type", type);

  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      {
        error:
          text ||
          `ComfyUI returned ${res.status} when fetching the output image.`,
      },
      { status: res.status }
    );
  }

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  headers.set("content-type", contentType || "image/png");
  headers.set("content-disposition", 'inline; filename="comfyui-output"');
  headers.set("cache-control", "private, max-age=300");

  return new Response(res.body, { status: res.status, headers });
}
