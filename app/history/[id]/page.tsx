import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { readIsAuthenticated } from "@/lib/auth";
import { readHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authed = await readIsAuthenticated();
  if (!authed) {
    redirect("/");
  }

  const resolvedParams = await params;
  const historyId = Array.isArray(resolvedParams.id)
    ? resolvedParams.id[0]
    : resolvedParams.id;
  const items = await readHistory();
  const item = items.find((i) => i.id === historyId);
  if (!item) {
    notFound();
  }

  const metaRows: Array<{ label: string; value?: string }> = [
    { label: "Workflow", value: item.workflowName || item.workflowId },
    { label: "Workflow ID", value: item.workflowId },
    { label: "Prompt ID", value: item.promptId },
    { label: "Seed", value: item.seed !== undefined ? String(item.seed) : undefined },
    { label: "Steps", value: item.steps !== undefined ? String(item.steps) : undefined },
    { label: "Output filename", value: item.originalFilename },
    { label: "Stored filename", value: item.storedFilename },
    { label: "Input file", value: item.inputFilename },
  ].filter((row) => row.value);

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background/60 to-muted/30 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">History detail</h1>
            <p className="text-sm text-muted-foreground">{item.originalFilename}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/api/history/file?name=${encodeURIComponent(item.storedFilename)}`}
              className="inline-flex items-center justify-center rounded-md border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              Open
            </Link>
            <Link
              href={`/api/history/file?name=${encodeURIComponent(
                item.storedFilename,
              )}&download=1`}
              className="inline-flex items-center justify-center rounded-md border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              Download
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Back
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border bg-card/70 p-4">
            <h2 className="text-lg font-semibold">Details</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
              {metaRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded border border-border/50 bg-muted/30 px-3 py-2"
                >
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="break-words text-foreground/90">{row.value}</p>
                </div>
              ))}
            </div>
            {(item.positivePrompt || item.negativePrompt) && (
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                {item.positivePrompt && (
                  <div className="rounded border border-border/50 bg-muted/20 p-3">
                    <p className="font-semibold text-foreground">Positive prompt</p>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {item.positivePrompt}
                    </p>
                  </div>
                )}
                {item.negativePrompt && (
                  <div className="rounded border border-border/50 bg-muted/20 p-3">
                    <p className="font-semibold text-foreground">Negative prompt</p>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {item.negativePrompt}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/history/file?name=${encodeURIComponent(item.storedFilename)}`}
              alt={item.originalFilename}
              className="w-full object-contain"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
