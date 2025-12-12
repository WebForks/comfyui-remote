import { HistoryApp } from "@/components/history-app";
import { readIsAuthenticated } from "@/lib/auth";

export default async function HistoryPage() {
  const authenticated = await readIsAuthenticated();
  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background/60 to-muted/30 text-foreground">
      <HistoryApp authenticated={authenticated} />
    </main>
  );
}
