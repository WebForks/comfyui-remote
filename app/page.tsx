import { RemoteApp } from "@/components/remote-app";
import { readIsAuthenticated } from "@/lib/auth";

export default async function Home() {
  const authenticated = await readIsAuthenticated();
  const defaultBaseUrl = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL || "";
  const passwordConfigured = Boolean(process.env.APP_PASSWORD);

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background/60 to-muted/30 text-foreground">
      <RemoteApp
        authenticated={authenticated}
        defaultBaseUrl={defaultBaseUrl}
        passwordConfigured={passwordConfigured}
      />
    </main>
  );
}
