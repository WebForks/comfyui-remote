// History page client component
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, Home, Moon, Settings, Sun, Trash2 } from "lucide-react";

type HistoryItem = {
  id: string;
  createdAt: string;
  originalFilename: string;
  storedFilename: string;
  promptId?: string;
  workflowId?: string;
};

export function HistoryApp({ authenticated }: { authenticated: boolean }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isDeleting, startDelete] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("comfyui-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("comfyui-theme", theme);
  }, [theme]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      const body = (await res.json()) as { items?: HistoryItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load history.");
      setItems(body.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) loadHistory();
  }, [authenticated]);

  const handleDelete = (id: string) => {
    startDelete(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const body = (await res.json()) as { items?: HistoryItem[]; error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to delete.");
        setItems(body.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-3xl font-semibold hover:underline">
              ComfyUI Remote
            </Link>
            <Badge variant="outline">History</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse your saved outputs. Entries are stored in <code>data/outputs</code> and
            persist across restarts.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/settings" aria-label="Open settings" title="Open settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/" aria-label="Back to dashboard" title="Back to dashboard">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {!authenticated && (
        <Alert variant="destructive">
          <AlertTitle>Not signed in</AlertTitle>
          <AlertDescription>Sign in on the main page to view history.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Saved outputs</CardTitle>
          <CardDescription>Images are stored locally and can be deleted here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
          {!isLoading &&
            items.map((item) => {
              const imgUrl = `/api/history/file?name=${encodeURIComponent(
                item.storedFilename,
              )}`;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded border border-border/60 bg-card/40 p-3"
                >
                  <div className="overflow-hidden rounded border border-border/50 bg-muted/40 h-48 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={item.originalFilename}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{item.originalFilename}</p>
                    <p>
                      Saved{" "}
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                    {item.workflowId && <p>Workflow: {item.workflowId}</p>}
                    {item.promptId && <p>Prompt: {item.promptId}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="secondary" size="sm" className="flex-1">
                      <a href={imgUrl} download={item.originalFilename}>
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
