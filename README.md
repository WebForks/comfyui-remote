# ComfyUI Remote UI

Password-gated Next.js + shadcn/ui front end to point at your desktop ComfyUI instance, manage workflows (rename/delete), and run prompts with inline image I/O.

## What’s here
- Auth wall with a single password (env-driven) stored in an httpOnly cookie.
- Settings page with ComfyUI API URL, workflow import (appends to `data/workflows.json`), workflow table (rename/delete), and per-workflow detail (summary + JSON).
- Run view with workflow selector, positive/negative prompts, required input image (replaces LoadImage), and inline output (SaveImage) with Open/Download buttons.
- Debug toggle (in Settings) to show/hide run history/logs and image source URLs.
- Dockerfile + `docker-compose.yml` for a one-command deploy.
- History page that persists output images to `data/outputs` and lets you download/delete them.

## Quick start (local)
1) Install deps (npm will use the repo-local `.npmrc` cache path):
```bash
npm install
```

2) Configure env vars (copy `.env.example` to `.env.local` and edit):
```bash
cp .env.example .env.local
# set APP_PASSWORD, AUTH_SECRET, NEXT_PUBLIC_COMFYUI_BASE_URL
```

3) Run the app:
```bash
npm run dev
```
Open http://localhost:3000, sign in with the password you set, and set your ComfyUI API base (e.g., `http://YOUR-DESKTOP-IP:8188`) in **Settings**.
- Import workflow JSONs (they append; existing IDs are kept, new IDs are auto-suffixed on collision).
- Use **Saved workflows** to rename/delete and view details (summary + raw JSON).
- Go back to the main page to run: select a workflow, set prompts, choose an input image (required for LoadImage), click **Run workflow**, then Open/Download the SaveImage result.
- Enable the debug checkbox in Settings if you want history JSON/source URL shown on the run page.

4) Testing loop:
- If you plan to run prompts, make sure your ComfyUI instance is reachable from your machine at the URL you enter.
- Change env vars in `.env.local` as needed (restart dev server after changes).
- Use the Settings table to confirm your uploaded JSONs were saved (server stores them at `data/workflows.json`).
- Saved/renamed workflows persist in `data/workflows.json` (mount this path in Docker to keep them across container restarts).

## Docker Compose
Use the published image:
```bash
docker-compose up -d
```
Environment variables:
- `APP_PASSWORD` – required password to unlock the UI.
- `AUTH_SECRET` – secret used to sign the auth cookie.
- `NEXT_PUBLIC_COMFYUI_BASE_URL` – optional default ComfyUI API URL (can be overridden in the UI).
- Volume: `./data:/app/data` (included) to persist saved/renamed workflows on the host. You can swap for a named volume if preferred.
  - Outputs are stored under `data/outputs` and history metadata under `data/history.json`.

The UI listens on `localhost:3000`.

### Build and push to Docker Hub (`ankhussy/comfyui-simplified`)
1) Log in: `docker login`
2) Build locally: `docker build -t ankhussy/comfyui-simplified:latest .`
   - For multi-arch: `docker buildx build --platform linux/amd64,linux/arm64 -t ankhussy/comfyui-simplified:latest .`
3) Push: `docker push ankhussy/comfyui-simplified:latest`
4) Deploy with Compose (uses the image by default):
   ```bash
   docker-compose up -d
   ```
   If you want Compose to build locally instead of pulling, uncomment the `build: .` line and comment out `image:` in `docker-compose.yml`.

## ComfyUI expectations
- None for importing: workflows are uploaded and stored locally by this UI.
- For running prompts, make sure your server can reach your desktop ComfyUI instance (VPN, SSH tunnel, or port forwarding). Input images replace LoadImage nodes; SaveImage outputs are proxied for inline display.

## Auth notes
- Single-password guard lives in `app/actions/auth.ts` and `lib/auth.ts`.
- Cookies are httpOnly/lax and last 7 days. Update `APP_PASSWORD` and `AUTH_SECRET` for real deployments.
- If you’d like multi-user accounts later, we can swap the guard for [better-auth](https://better-auth.com); this lightweight gate keeps the current setup simple.

## Where to tweak next
- UI logic lives in `components/remote-app.tsx`.
- Workflow storage endpoint: `app/api/workflows/route.ts` (authenticated; saves to `data/workflows.json`).
- Run endpoint proxy: `app/api/run/route.ts` (authenticated; forwards prompts/images to your ComfyUI API and polls for outputs).
- Global styles: `app/globals.css`.

Tell me how you want the workflow editor to look/behave and I’ll wire it up to the selected workflow and ComfyUI actions.
