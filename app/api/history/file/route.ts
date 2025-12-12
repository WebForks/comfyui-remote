import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";

import { readIsAuthenticated } from "@/lib/auth";
import { getStoredFilePath } from "@/lib/history";

export async function GET(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, statusText: "Unauthorized" },
    );
  }

  const url = new URL(req.url);
  const filename = url.searchParams.get("name");
  if (!filename) {
    return NextResponse.json(
      { error: "Missing filename" },
      { status: 400 },
    );
  }

  const filePath = getStoredFilePath(path.basename(filename));
  const download = url.searchParams.get("download");
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      ...(download ? { "Content-Disposition": `attachment; filename="${path.basename(filename)}"` } : {}),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
