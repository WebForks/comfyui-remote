# ComfyUI Remote UI

Password-gated Next.js + shadcn/ui front end to point at your desktop ComfyUI instance, select a workflow, and prepare for the upcoming editor view.

## What’s here
- Auth wall with a single password (env-driven) stored in an httpOnly cookie.
- Connection card to set and persist your ComfyUI API base URL.
- Workflow import: upload a workflow JSON file and it is saved on the server (stored at `data/workflows.json`) with a node summary.
- Run helper: set positive/negative prompts, optional input image, and run the selected workflow via your ComfyUI API; output image is shown inline.
- Dockerfile + `docker-compose.yml` for a one-command deploy.
- Placeholder “workflow editor” block ready for your design notes.

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
Open http://localhost:3000, sign in with the password you set, enter your ComfyUI API base (e.g., `http://YOUR-DESKTOP-IP:8188`), and import a workflow JSON file to populate the dropdown. Select it, edit prompts or upload an input image (optional), then run.

4) Testing loop:
- If you plan to run prompts, make sure your ComfyUI instance is reachable from your machine at the URL you enter.
- Change env vars in `.env.local` as needed (restart dev server after changes).
- Use the workflow dropdown to confirm your uploaded JSON was saved (server stores it at `data/workflows.json`).

## Docker Compose
Build and run in production mode:
```bash
docker-compose up --build
```
Environment variables:
- `APP_PASSWORD` – required password to unlock the UI.
- `AUTH_SECRET` – secret used to sign the auth cookie.
- `NEXT_PUBLIC_COMFYUI_BASE_URL` – optional default ComfyUI API URL (can be overridden in the UI).

The UI listens on `localhost:3000`.

## ComfyUI expectations
- None for importing: workflows are uploaded and stored locally by this UI.
- For running prompts later, make sure your server can reach your desktop ComfyUI instance (VPN, SSH tunnel, or port forwarding).

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
