import { NextResponse, type NextRequest } from "next/server";

import { readIsAuthenticated } from "@/lib/auth";
import { deleteHistoryItem, readHistory } from "@/lib/history";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: jsonHeaders },
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  const items = await readHistory();
  if (id) {
    const found = items.find((i) => i.id === id);
    if (!found) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: jsonHeaders },
      );
    }
    return NextResponse.json({ item: found }, { headers: jsonHeaders });
  }

  return NextResponse.json({ items }, { headers: jsonHeaders });
}

export async function DELETE(req: NextRequest) {
  if (!(await readIsAuthenticated())) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: jsonHeaders },
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const deleted = await deleteHistoryItem(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const items = await readHistory();
  return NextResponse.json({ items }, { headers: jsonHeaders });
}
