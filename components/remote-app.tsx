'use client';
/* eslint-disable @next/next/no-img-element */

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  useRef,
} from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { login, logout, type AuthState } from "@/app/actions/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Download, Home, Moon, Settings, Sun, Dice5 } from "lucide-react";

type RemoteAppProps = {
  authenticated: boolean;
  defaultBaseUrl?: string;
  passwordConfigured: boolean;
  variant?: "dashboard" | "settings";
};

type WorkflowSummary = {
  totalNodes: number;
  workflowType: "image-to-image" | "text-to-image" | "unknown";
  typeCounts: Record<string, number>;
  loadImageNodes: WorkflowNode[];
  saveImageNodes: WorkflowNode[];
  promptNodes: WorkflowNode[];
  positivePromptNodes: WorkflowNode[];
  negativePromptNodes: WorkflowNode[];
};

type WorkflowNode = {
  id?: number | string;
  type?: string;
  title?: string;
  widgets_values?: unknown[];
  inputs?: unknown[];
};

type WorkflowOption = {
  id: string;
  name: string;
  path?: string;
  summary?: WorkflowSummary;
  raw?: unknown;
};

type RunResult = {
  imageUrl: string;
  proxyUrl?: string;
  directUrl?: string;
  filename: string;
  seedUsed?: string;
  stepsUsed?: string;
  subfolder?: string;
  type?: string;
  promptId: string;
  clientId: string;
  workflowName?: string;
  history?: unknown;
  fullHistory?: unknown;
};

type ConnectionState = "idle" | "connected" | "error";

const initialAuthState: AuthState = { ok: false, message: "" };
const STORAGE_KEYS = {
  apiBase: "comfyui-api-base",
  workflow: "comfyui-workflow",
  promptPositive: "comfyui-positive",
  promptNegative: "comfyui-negative",
  promptSteps: "comfyui-steps",
};

export function RemoteApp({
  authenticated,
  defaultBaseUrl,
  passwordConfigured,
  variant = "dashboard",
}: RemoteAppProps) {
  const router = useRouter();
  const [state, formAction] = useActionState<AuthState, FormData>(
    login,
    initialAuthState,
  );
  const [isLoggingOut, startLogout] = useTransition();

  const isAuthed = authenticated || state.ok;

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const handleLogout = useCallback(() => {
    startLogout(async () => {
      await logout();
      router.refresh();
    });
  }, [router]);

  if (!isAuthed) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
        <LoginCard
          action={formAction}
          state={state}
          passwordConfigured={passwordConfigured}
        />
      </div>
    );
  }

  return (
    <Dashboard
      defaultBaseUrl={defaultBaseUrl}
      passwordConfigured={passwordConfigured}
      isLoggingOut={isLoggingOut}
      onLogout={handleLogout}
      variant={variant}
    />
  );
}

function SummaryBlock({
  title,
  items = [],
}: {
  title: string;
  items?: WorkflowNode[] | undefined;
}) {
  const count = items?.length ?? 0;
  return (
    <div className="rounded border border-border/60 bg-card/40 px-3 py-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">
        {count} {count === 1 ? "node" : "nodes"}
      </p>
      {count > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-foreground/80">
          {items!.slice(0, 3).map((node, idx) => (
            <li key={`${node.id ?? idx}-${node.type ?? "node"}`}>
              {node.type || "Unknown"} {node.id !== undefined ? `(#${node.id})` : ""}
            </li>
          ))}
          {count > 3 && <li className="text-muted-foreground">… {count - 3} more</li>}
        </ul>
      )}
    </div>
  );
}

function WorkflowRow({
  workflow,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  renamingId,
  onStartRename,
  onCancelRename,
  renameValue,
  setRenameValue,
}: {
  workflow: WorkflowOption;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  renamingId: string | null;
  onStartRename: (id: string, current: string) => void;
  onCancelRename: () => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
}) {
  const isRenaming = renamingId === workflow.id;

  return (
    <tr
      className={`border-b border-border/50 hover:bg-muted/40 ${
        isSelected ? "bg-primary/5" : ""
      }`}
      onClick={onSelect}
    >
      <td className="px-3 py-2 align-middle">
        {isRenaming ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="font-medium text-foreground">{workflow.name}</span>
        )}
      </td>
      <td className="px-3 py-2 align-middle text-muted-foreground break-all">
        {workflow.id}
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex gap-2">
          {isRenaming ? (
            <>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(renameValue);
                }}
              >
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelRename();
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename(workflow.id, workflow.name);
                }}
              >
                Rename
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function LoginCard({
  action,
  state,
  passwordConfigured,
}: {
  action: (payload: FormData) => void;
  state: AuthState;
  passwordConfigured: boolean;
}) {
  return (
    <Card className="w-full max-w-md border-border/60 bg-card/60 shadow-sm backdrop-blur">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">
          Unlock ComfyUI Remote
        </CardTitle>
        <CardDescription>
          Enter the password you configured for this dashboard to continue.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          {!passwordConfigured && (
            <Alert>
              <AlertTitle>Default password active</AlertTitle>
              <AlertDescription>
                Set <code>APP_PASSWORD</code> in your environment for real
                security. The default password is easy to guess.
              </AlertDescription>
            </Alert>
          )}
          {state.message && (
            <Alert variant={state.ok ? "default" : "destructive"}>
              <AlertTitle>
                {state.ok ? "Signed in" : "Authentication failed"}
              </AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Dashboard password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="min-w-32">
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

function Dashboard({
  defaultBaseUrl,
  passwordConfigured,
  isLoggingOut,
  onLogout,
  variant = "dashboard",
}: {
  defaultBaseUrl?: string;
  passwordConfigured: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
  variant?: "dashboard" | "settings";
}) {
  const isSettings = variant === "settings";
  const [apiBase, setApiBase] = useState(() => defaultBaseUrl || "");
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState("");
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [ready, setReady] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [runImageFile, setRunImageFile] = useState<File | null>(null);
  const [runImagePreview, setRunImagePreview] = useState<string | null>(null);
  const [runImageSize, setRunImageSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [stepsInput, setStepsInput] = useState("20");
  const [outputImageSize, setOutputImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const randomSeed = useMemo(() => {
    const min = 0;
    const max = 9_999_999_999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, []);
  const [seedInput, setSeedInput] = useState(() => String(randomSeed));
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runImageError, setRunImageError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runHistory, setRunHistory] = useState<unknown | null>(null);
  const lastWorkflowRef = useRef<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showDebug, setShowDebug] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedForRunRef = useRef<string>("");
  const seedInputRef = useRef<string>(seedInput);
  const positiveRef = useRef<string>("");
  const negativeRef = useRef<string>("");
  const inputNameRef = useRef<string>("");
  const runTagRef = useRef<string>("");
  const stepsInputRef = useRef<string>(stepsInput);
  const promptsLoadedRef = useRef(false);

  useEffect(() => {
    const savedBase = localStorage.getItem(STORAGE_KEYS.apiBase);
    const savedWorkflow = localStorage.getItem(STORAGE_KEYS.workflow);
    const savedTheme = localStorage.getItem("comfyui-theme");
    const savedDebug = localStorage.getItem("comfyui-show-debug");
    const savedPos = localStorage.getItem(STORAGE_KEYS.promptPositive);
    const savedNeg = localStorage.getItem(STORAGE_KEYS.promptNegative);
    const savedSteps = localStorage.getItem(STORAGE_KEYS.promptSteps);
    const savedTestStatus = localStorage.getItem("comfyui-test-status");
    const savedTestMessage = localStorage.getItem("comfyui-test-message");

    if (savedBase) {
      setApiBase(savedBase);
    } else if (defaultBaseUrl) {
      setApiBase(defaultBaseUrl);
    }

    if (savedWorkflow) {
      setSelectedWorkflow(savedWorkflow);
    }

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    setShowDebug(savedDebug === "true");
    if (savedPos) setPositivePrompt(savedPos);
    if (savedNeg) setNegativePrompt(savedNeg);
    if (savedSteps) setStepsInput(savedSteps);
    if (savedPos || savedNeg) promptsLoadedRef.current = true;
    if (savedTestStatus === "ok" || savedTestStatus === "error") {
      setTestStatus(savedTestStatus);
    }
    if (savedTestMessage) setTestMessage(savedTestMessage);

    setReady(true);
  }, [defaultBaseUrl]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("comfyui-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("comfyui-show-debug", showDebug ? "true" : "false");
  }, [showDebug]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.promptPositive, positivePrompt);
  }, [positivePrompt]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.promptNegative, negativePrompt);
  }, [negativePrompt]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.promptSteps, stepsInput);
  }, [stepsInput]);

  useEffect(() => {
    seedInputRef.current = seedInput;
  }, [seedInput]);

  useEffect(() => {
    stepsInputRef.current = stepsInput;
  }, [stepsInput]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("comfyui-test-status", testStatus);
    if (testMessage) {
      localStorage.setItem("comfyui-test-message", testMessage);
    } else {
      localStorage.removeItem("comfyui-test-message");
    }
  }, [testStatus, testMessage]);

  const connectionBadge = useMemo(() => {
    if (status === "connected") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200">
          Connected
        </Badge>
      );
    }

    if (status === "error") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200">
          Connection issue
        </Badge>
      );
    }

    return (
      <Badge className="bg-slate-500/10 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200">
        Idle
      </Badge>
    );
  }, [status]);

  const fetchWorkflows = useCallback(
    async () => {
      setIsFetching(true);
      setError(null);
      setStatus("idle");

      try {
        const response = await fetch("/api/workflows", {
          method: "GET",
          cache: "no-store",
        });

        const body = (await response.json()) as {
          workflows?: WorkflowOption[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || "Unable to read stored workflows.");
        }

        const list = body.workflows || [];
        const fallbackId = list[0]?.id || "";

        setWorkflows(list);
        setStatus(list.length ? "connected" : "idle");
        setLastUpdated(new Date());

        setSelectedWorkflow((current) => {
          if (current && list.some((item) => item.id === current)) {
            return current;
          }

          if (fallbackId) {
            localStorage.setItem(STORAGE_KEYS.workflow, fallbackId);
            return fallbackId;
          }

          localStorage.removeItem(STORAGE_KEYS.workflow);
          return "";
        });
      } catch (err) {
        setStatus("error");
        setWorkflows([]);
        setError(
          err instanceof Error
            ? err.message
            : "Could not read stored workflows from the server.",
        );
      } finally {
        setIsFetching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (ready) {
      fetchWorkflows();
    }
  }, [ready, fetchWorkflows]);

  const handleWorkflowChange = useCallback((value: string) => {
    setSelectedWorkflow(value);
    localStorage.setItem(STORAGE_KEYS.workflow, value);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setIsRunning(false);
  }, []);

  const randomizeSeed = useCallback(() => {
    const min = 0;
    const max = 9_999_999_999;
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;
    setSeedInput(String(rand));
  }, []);

  const selectedWorkflowDetails = useMemo(
    () => workflows.find((item) => item.id === selectedWorkflow),
    [selectedWorkflow, workflows],
  );

  const pollStatus = useCallback(
    async (promptId: string, workflowId: string, start: number) => {
      try {
        const res = await fetch(`/api/run/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptId,
            baseUrl: apiBase.trim(),
            workflowId,
            start,
            positivePrompt: positiveRef.current,
            negativePrompt: negativeRef.current,
            seed: seedForRunRef.current,
            steps: stepsInputRef.current,
            inputFilename: inputNameRef.current,
            workflowName: selectedWorkflowDetails?.name,
            runTag: runTagRef.current,
          }),
        });
        const rawText = await res.text();
        let body: {
          status?: string;
          error?: string;
          imageUrl?: string;
          proxyUrl?: string;
          directUrl?: string;
          filename?: string;
          subfolder?: string;
          type?: string;
          workflowName?: string;
          history?: unknown;
          fullHistory?: unknown;
          usedSeed?: string;
          usedSteps?: string;
        };
        try {
          body = JSON.parse(rawText) as typeof body;
        } catch {
          body = { error: rawText || "Received non-JSON response from server." };
        }

        if (!res.ok) {
          throw new Error(body.error || `Status check failed (${res.status})`);
        }

        if (body.status === "pending") {
          pollTimer.current = setTimeout(
            () => pollStatus(promptId, workflowId, start),
            2000,
          );
          return;
        }

        if (body.status === "timeout") {
          throw new Error(body.error || "Timed out waiting for result.");
        }

        if (body.status === "done" && body.imageUrl) {
      setRunResult({
        imageUrl: body.imageUrl,
        proxyUrl: body.proxyUrl,
        directUrl: body.directUrl,
        filename: body.filename || "",
        subfolder: body.subfolder || "",
        type: body.type || "",
        promptId,
        clientId: "",
        seedUsed: body.usedSeed || seedForRunRef.current || undefined,
        stepsUsed: body.usedSteps || stepsInputRef.current || undefined,
        workflowName: body.workflowName || selectedWorkflowDetails?.name,
        history: body.history,
        fullHistory: body.fullHistory,
      });
          setOutputImageSize(null);
          setRunHistory(body.history || body.fullHistory || body);
          setRunError(null);
          randomizeSeed();
          stopPolling();
          return;
        }

        throw new Error(body.error || "Unknown status response.");
      } catch (err) {
        setRunError(err instanceof Error ? err.message : "Workflow run failed.");
        stopPolling();
      }
    },
    [apiBase, stopPolling, selectedWorkflowDetails, randomizeSeed],
  );

  const derivedPrompts = useMemo(() => {
    const rawNodes = Array.isArray(
      (selectedWorkflowDetails?.raw as { nodes?: unknown })?.nodes,
    )
      ? ((selectedWorkflowDetails?.raw as { nodes: WorkflowNode[] }).nodes as WorkflowNode[])
      : [];

    let positive = "";
    let negative = "";

    for (const node of rawNodes) {
      const widgets = Array.isArray(node.widgets_values)
        ? node.widgets_values
        : [];
      const text = typeof widgets[0] === "string" ? widgets[0] : "";
      const title = typeof node.title === "string" ? node.title.toLowerCase() : "";
      const type = typeof node.type === "string" ? node.type.toLowerCase() : "";

      if (
        /prompt/.test(type) ||
        /textencode/.test(type) ||
        /cliptextencode/.test(type)
      ) {
        if (/negative/.test(title)) {
          if (!negative && text) negative = text;
        } else if (!positive && text) {
          positive = text;
        }
      }
    }

    return { positive, negative };
  }, [selectedWorkflowDetails]);

  useEffect(() => {
    if (!selectedWorkflow) return;
    const hasChanged = lastWorkflowRef.current !== selectedWorkflow;
    const shouldFillPositive =
      !positivePrompt && derivedPrompts.positive.length > 0;
    const shouldFillNegative =
      !negativePrompt && derivedPrompts.negative.length > 0;

    if (hasChanged) {
      // On first load, if we already loaded prompts from storage, keep them.
      if (!lastWorkflowRef.current && promptsLoadedRef.current) {
        lastWorkflowRef.current = selectedWorkflow;
        return;
      }
      lastWorkflowRef.current = selectedWorkflow;
      setPositivePrompt(derivedPrompts.positive);
      setNegativePrompt(derivedPrompts.negative);
      setSeedInput(String(randomSeed));
      setRunResult(null);
      setRunError(null);
      setRunImageError(null);
      setRunHistory(null);
      return;
    }

    // If the workflow was already selected but summaries arrived later, backfill missing prompts.
    if (shouldFillPositive) {
      setPositivePrompt(derivedPrompts.positive);
    }
    if (shouldFillNegative) {
      setNegativePrompt(derivedPrompts.negative);
    }
  }, [
    derivedPrompts.negative,
    derivedPrompts.positive,
    negativePrompt,
    positivePrompt,
    selectedWorkflow,
    randomSeed,
  ]);

  useEffect(() => {
    if (runImageFile) {
      const objectUrl = URL.createObjectURL(runImageFile);
      setRunImagePreview(objectUrl);
      setRunImageSize(null);
      const img = new Image();
      img.onload = () => {
        setRunImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = objectUrl;
      return () => URL.revokeObjectURL(objectUrl);
    }
    setRunImagePreview(null);
    setRunImageSize(null);
    return undefined;
  }, [runImageFile]);

  const rawPreview = useMemo(() => {
    if (!selectedWorkflowDetails?.raw) return "Select a workflow to preview its JSON.";
    return JSON.stringify(selectedWorkflowDetails.raw, null, 2);
  }, [selectedWorkflowDetails]);

  const handleImport = useCallback(async () => {
    if (!importFile) return;

    setIsImporting(true);
    setError(null);
    setImportMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/workflows", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as {
        workflows?: WorkflowOption[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Upload failed.");
      }

      const list = body.workflows || [];
      const fallbackId = list[0]?.id || "";

      setWorkflows(list);
      setStatus(list.length ? "connected" : "idle");
      setLastUpdated(new Date());
      setImportMessage(
        `Saved ${list.length} workflow${list.length === 1 ? "" : "s"} on the server.`,
      );

      setSelectedWorkflow((current) => {
        if (current && list.some((item) => item.id === current)) {
          return current;
        }

        if (fallbackId) {
          localStorage.setItem(STORAGE_KEYS.workflow, fallbackId);
          return fallbackId;
        }

        localStorage.removeItem(STORAGE_KEYS.workflow);
        return "";
      });
    } catch (err) {
      setStatus("error");
      setWorkflows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the uploaded workflows.",
      );
    } finally {
      setIsImporting(false);
    }
  }, [importFile]);

  const handleRun = useCallback(async () => {
    stopPolling();
    if (!selectedWorkflow) {
      setRunError("Select a workflow to run.");
      return;
    }

    if (!apiBase.trim()) {
      setRunError("Set your ComfyUI API URL first.");
      return;
    }

    setIsRunning(true);
    setRunError(null);
    setRunImageError(null);
    setRunResult(null);
    setOutputImageSize(null);
    setRunHistory(null);
    const seedToUse = (seedInputRef.current || "").trim() || "-1";
    const stepsToUse = (stepsInputRef.current || "").trim();
    seedForRunRef.current = seedToUse;
    positiveRef.current = positivePrompt;
    negativeRef.current = negativePrompt;
    inputNameRef.current = runImageFile?.name || "";

    try {
      const form = new FormData();
      form.append("workflowId", selectedWorkflow);
      form.append("baseUrl", apiBase.trim());
      form.append("positivePrompt", positivePrompt);
      form.append("negativePrompt", negativePrompt);
      if (runImageFile) {
        form.append("image", runImageFile);
      }
      form.append("seed", seedToUse);
      form.append("steps", stepsToUse);

      const response = await fetch("/api/run", {
        method: "POST",
        body: form,
      });

      const rawText = await response.text();
      let body: {
        error?: string;
        imageUrl?: string;
        proxyUrl?: string;
        directUrl?: string;
        promptId?: string;
        clientId?: string;
        summary?: WorkflowSummary;
        history?: unknown;
        fullHistory?: unknown;
        runTag?: string;
      };
      try {
        body = JSON.parse(rawText) as typeof body;
      } catch {
        body = { error: rawText || "Received non-JSON response from server." };
      }

      if (!response.ok) {
        setRunHistory(body.history || body.fullHistory || body);
        throw new Error(body.error || "Workflow run failed.");
      }

      if (!body.promptId) {
        throw new Error(body.error || "ComfyUI did not return a prompt id.");
      }

      const startTime = Date.now();
      runTagRef.current = body.runTag || "";
      setIsRunning(true);
      if (body.summary) {
        setWorkflows((prev) =>
          prev.map((wf) =>
            wf.id === selectedWorkflow ? { ...wf, summary: body.summary } : wf,
          ),
        );
      }
      pollTimer.current = setTimeout(
        () => pollStatus(body.promptId!, selectedWorkflow, startTime),
        1000,
      );
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Workflow run failed.");
      setIsRunning(false);
    } finally {
      // isRunning is cleared when polling completes or errors
    }
  }, [
    apiBase,
    negativePrompt,
    positivePrompt,
    runImageFile,
    selectedWorkflow,
    pollStatus,
    stopPolling,
  ]);

  const workflowHint = workflows.find(
    (item) => item.id === selectedWorkflow,
  )?.path;

  const handleTestConnection = useCallback(async () => {
    if (!apiBase.trim()) {
      setTestStatus("error");
      setTestMessage("Enter a ComfyUI API URL first.");
      return;
    }

    setIsTesting(true);
    setTestMessage(null);

    try {
      const params = new URLSearchParams({ base: apiBase.trim() });
      const response = await fetch(`/api/test?${params.toString()}`, {
        method: "GET",
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Test failed");
      }
      setTestStatus("ok");
      setTestMessage("Connected");
    } catch (err) {
      setTestStatus("error");
      setTestMessage(
        `Unable to connect: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    } finally {
      setIsTesting(false);
    }
  }, [apiBase]);

  const handleRenameWorkflow = useCallback(
    async (id: string, name: string) => {
      if (!name.trim()) return;
      setIsFetching(true);
      try {
        const response = await fetch("/api/workflows", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: name.trim() }),
        });
        const body = (await response.json()) as { workflows?: WorkflowOption[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Rename failed.");
        const list = body.workflows || [];
        setWorkflows(list);
        if (!list.find((wf) => wf.id === selectedWorkflow)) {
          setSelectedWorkflow(list[0]?.id || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Rename failed.");
      } finally {
        setIsFetching(false);
        setRenamingId(null);
        setRenameValue("");
      }
    },
    [selectedWorkflow],
  );

  const handleDeleteWorkflow = useCallback(
    async (id: string) => {
      setIsFetching(true);
      try {
        const response = await fetch(`/api/workflows?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const body = (await response.json()) as { workflows?: WorkflowOption[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Delete failed.");
        const list = body.workflows || [];
        setWorkflows(list);
        if (selectedWorkflow === id) {
          const nextId = list[0]?.id || "";
          setSelectedWorkflow(nextId);
          localStorage.setItem(STORAGE_KEYS.workflow, nextId);
          setViewMode("list");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setIsFetching(false);
      }
    },
    [selectedWorkflow],
  );

  return (
    <div className="mx-auto flex w-full flex-col gap-6 px-4 py-10">
      <header className="mx-auto flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/" className="text-3xl font-semibold hover:underline">
              ComfyUI Remote
            </Link>
            {connectionBadge}
            <div className="flex flex-1 justify-center">
              <Link
                href="/history"
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                History
              </Link>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Point this UI at your desktop ComfyUI API, pick a workflow, and
            we&apos;ll layer on editing controls next.
          </p>
          {!passwordConfigured && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">
              Reminder: APP_PASSWORD is still using the default value
            </Badge>
          )}
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
          {variant === "dashboard" ? (
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/settings" aria-label="Open settings" title="Open settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href="/" aria-label="Back to dashboard" title="Back to dashboard">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="self-start"
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </header>

      {isSettings ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>ComfyUI connection</CardTitle>
                <CardDescription>
                  Provide the base URL where ComfyUI is reachable from this server.
                  Example: http://YOUR-DESKTOP-IP:8188. This will be used when
                  running prompts later.
                </CardDescription>
              </div>
              {lastUpdated && (
                <div className="text-xs text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="apiBase">ComfyUI API URL</Label>
                  <Input
                    id="apiBase"
                    value={apiBase}
                    onChange={(event) => setApiBase(event.target.value)}
                    placeholder="http://desktop-ip:8188"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setApiBase(defaultBaseUrl || "")}
                    disabled={isFetching}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={() => fetchWorkflows()}
                    disabled={isFetching}
                  >
                    {isFetching ? "Loading..." : "Reload saved"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? "Testing..." : "Test"}
                  </Button>
                </div>
              </div>

              {testStatus !== "idle" && (
                <Alert variant={testStatus === "ok" ? "default" : "destructive"}>
                  <AlertTitle>
                    {testStatus === "ok" ? "Connected" : "Unable to connect"}
                  </AlertTitle>
                  <AlertDescription>{testMessage}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Could not connect</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Workflows</CardTitle>
                <CardDescription>
                  Import your workflow JSON and store it on this server. We&apos;ll
                  use this selection as the base for editing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="workflowFile">Import workflow JSON</Label>
                    <Input
                      id="workflowFile"
                      type="file"
                      accept="application/json"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setImportFile(file);
                        setImportMessage(null);
                      }}
                    />
                <p className="text-xs text-muted-foreground">
                  Uploads are appended on the server. Accepted: a single workflow
                  object, an array, or an object with a <code>workflows</code> array.
                </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleImport}
                    disabled={!importFile || isImporting}
                  >
                    {isImporting ? "Saving..." : "Upload & save"}
                  </Button>
                </div>

                {importMessage && (
                  <Alert>
                    <AlertTitle>Import complete</AlertTitle>
                    <AlertDescription>{importMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="space-y-2">
                    <Label htmlFor="workflow">Available workflows</Label>
                    <Select
                      value={selectedWorkflow}
                      onValueChange={handleWorkflowChange}
                      disabled={isFetching || workflows.length === 0}
                    >
                      <SelectTrigger id="workflow" className="w-full">
                        <SelectValue
                          placeholder={
                            isFetching ? "Loading..." : "No workflows loaded yet"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {workflows.map((flow) => (
                            <SelectItem key={flow.id} value={flow.id}>
                              {flow.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Pick any saved workflow to load its summary below. Click
                      &ldquo;Load saved workflows&rdquo; to sync with the server.
                    </p>
                    {workflowHint && (
                      <p className="text-xs text-muted-foreground">
                        Source: {workflowHint}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fetchWorkflows()}
                    disabled={isFetching}
                  >
                    {isFetching ? "Loading..." : "Load saved workflows"}
                  </Button>
                </div>
                {!workflows.length && status === "connected" && (
                  <p className="text-sm text-muted-foreground">
                    No workflows are saved yet. Import a JSON file to populate this
                    list.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle>Session</CardTitle>
                <CardDescription>Quick diagnostics for this UI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>API base</span>
                  <span className="max-w-[200px] truncate text-right text-foreground">
                    {apiBase || "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Workflow</span>
                  <span className="max-w-[200px] truncate text-right text-foreground">
                    {selectedWorkflow || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Password</span>
                  <Badge variant="outline">
                    {passwordConfigured ? "Configured" : "Default in use"}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                Add SSH port forwarding or a VPN if your desktop is not publicly
                routable.
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Debug options</CardTitle>
                <CardDescription>Toggle developer/debug output in the UI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-pressed={showDebug}
                    aria-label="Toggle debug mode"
                    onClick={() => setShowDebug((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showDebug ? "bg-red-500" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        showDebug ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className={showDebug ? "text-red-600 font-semibold" : ""}>
                    {showDebug ? "Debug mode enabled" : "Show debug history/logs in the run view"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Saved workflows</CardTitle>
              <CardDescription>
                Rename for clarity, view details, or delete. Click a row to open details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded border border-border/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/60 text-foreground/80">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Name</th>
                      <th className="px-3 py-2 text-left font-semibold">ID</th>
                      <th className="px-3 py-2 text-left font-semibold w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.length ? (
                      workflows.map((wf) => (
                        <WorkflowRow
                          key={wf.id}
                          workflow={wf}
                          isSelected={selectedWorkflow === wf.id}
                          onSelect={() => {
                            setSelectedWorkflow(wf.id);
                            setViewMode("detail");
                          }}
                          onRename={async (name) => {
                            await handleRenameWorkflow(wf.id, name);
                          }}
                          onDelete={async () => {
                            await handleDeleteWorkflow(wf.id);
                          }}
                          renamingId={renamingId}
                          onStartRename={(id, current) => {
                            setRenamingId(id);
                            setRenameValue(current);
                          }}
                          onCancelRename={() => {
                            setRenamingId(null);
                            setRenameValue("");
                          }}
                          renameValue={renameValue}
                          setRenameValue={setRenameValue}
                        />
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                          No workflows saved yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {viewMode === "detail" && selectedWorkflowDetails && (
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Workflow details</CardTitle>
                  <CardDescription>{selectedWorkflowDetails.name}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewMode("list")}
                >
                  Back to workflows
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    Type: {selectedWorkflowDetails.summary?.workflowType || "unknown"}
                  </Badge>
                  <Badge variant="outline">
                    Total nodes: {selectedWorkflowDetails.summary?.totalNodes ?? 0}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <SummaryBlock
                    title="Prompt/Text nodes"
                    items={selectedWorkflowDetails.summary?.promptNodes}
                  />
                  <SummaryBlock
                    title="Positive prompts"
                    items={selectedWorkflowDetails.summary?.positivePromptNodes}
                  />
                  <SummaryBlock
                    title="Negative prompts"
                    items={selectedWorkflowDetails.summary?.negativePromptNodes}
                  />
                  <SummaryBlock
                    title="Load image nodes"
                    items={selectedWorkflowDetails.summary?.loadImageNodes}
                  />
                  <SummaryBlock
                    title="Save image nodes"
                    items={selectedWorkflowDetails.summary?.saveImageNodes}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    Node type counts
                  </p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                    {Object.entries(selectedWorkflowDetails.summary?.typeCounts || {})
                      .sort(([, a], [, b]) => Number(b) - Number(a))
                      .slice(0, 12)
                      .map(([type, count]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between rounded border border-border/60 bg-card/50 px-2 py-1 text-xs text-foreground"
                        >
                          <span className="truncate">{type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Workflow JSON</p>
                  <Textarea
                    readOnly
                    className="min-h-[260px] resize-none text-xs"
                    value={rawPreview}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {!isSettings && (
        <>
          <div className="grid gap-6">
            <Card className="w-full mx-auto">
              <CardHeader>
                <CardTitle>Run workflow</CardTitle>
                <CardDescription>
                  Set prompts, upload an input image, then run against your ComfyUI API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr] sm:items-end">
                    <div className="space-y-1">
                      <Label htmlFor="runWorkflow">Workflow to run</Label>
                      <Select
                        value={selectedWorkflow}
                        onValueChange={(value) => {
                          if (value === "__choose") return;
                          setSelectedWorkflow(value);
                          localStorage.setItem(STORAGE_KEYS.workflow, value);
                        }}
                        disabled={isFetching || workflows.length === 0}
                      >
                        <SelectTrigger
                          id="runWorkflow"
                          className="w-full"
                          aria-label="Workflow to run"
                          title="Workflow to run"
                        >
                          <SelectValue
                            placeholder={
                              isFetching ? "Loading..." : "Select a saved workflow"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {workflows.map((flow) => (
                              <SelectItem key={flow.id} value={flow.id}>
                                {flow.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
                        <div className="space-y-1">
                          <Label htmlFor="seed" className="text-xs">
                            Seed
                          </Label>
                          <Input
                            id="seed"
                            value={seedInput}
                            onChange={(e) => setSeedInput(e.target.value)}
                            placeholder="-1 for random"
                            inputMode="numeric"
                            pattern="-?[0-9]*"
                          />
                        </div>
                        <div className="flex items-end justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={randomizeSeed}
                            aria-label="Randomize seed"
                            title="Randomize seed"
                          >
                            <Dice5 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="steps" className="text-xs">
                            Steps
                          </Label>
                          <Input
                            id="steps"
                            value={stepsInput}
                            onChange={(e) => setStepsInput(e.target.value)}
                            placeholder="Steps"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedWorkflowDetails?.summary && (
                    <div className="text-xs text-muted-foreground">
                      Type: {selectedWorkflowDetails.summary.workflowType} · Nodes:{" "}
                      {selectedWorkflowDetails.summary.totalNodes}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="positivePrompt">Positive prompt</Label>
                    <Textarea
                      id="positivePrompt"
                      value={positivePrompt}
                      onChange={(event) => setPositivePrompt(event.target.value)}
                      placeholder="Describe what you want."
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="negativePrompt">Negative prompt</Label>
                    <Textarea
                      id="negativePrompt"
                      value={negativePrompt}
                      onChange={(event) => setNegativePrompt(event.target.value)}
                      placeholder="Things to avoid."
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="runImage">Load image</Label>
                    <Input
                      id="runImage"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setRunImageFile(file);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Replaces the file on LoadImage nodes for this run.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleRun}
                    disabled={
                      isRunning || !selectedWorkflow || !apiBase.trim() || !workflows.length
                    }
                    className="sm:self-center"
                  >
                    {isRunning ? "Running..." : "Run workflow"}
                  </Button>
                </div>

                {runError && (
                  <Alert variant="destructive">
                    <AlertTitle>Run failed</AlertTitle>
                    <AlertDescription>{runError}</AlertDescription>
                  </Alert>
                )}
                {runImageError && (
                  <Alert variant="destructive">
                    <AlertTitle>Image load failed</AlertTitle>
                    <AlertDescription>{runImageError}</AlertDescription>
                  </Alert>
                )}
                {showDebug && !!runHistory && (
                  <Alert>
                    <AlertTitle>History debug</AlertTitle>
                    <AlertDescription>
                      <div className="max-h-52 overflow-auto rounded bg-muted/60 p-2 font-mono text-[10px] leading-tight">
                        {JSON.stringify(runHistory, null, 2)}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Input image (LoadImage)</span>
                      <span className="text-xs text-muted-foreground">
                        {runImageSize
                          ? `Size: ${runImageSize.width}×${runImageSize.height}`
                          : runImagePreview
                            ? "Size: loading..."
                            : ""}
                      </span>
                    </div>
                    <div className="overflow-hidden rounded border border-border/60 bg-card/40 h-[360px] flex items-center justify-center">
                      {runImagePreview ? (
                        <img
                          src={runImagePreview}
                          alt="Selected input preview"
                          className="h-full w-full object-contain bg-muted"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground px-3 text-center">
                          No input image selected. Choose a file above to replace LoadImage nodes.
                        </span>
                      )}
                    </div>
                  </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium text-foreground">
                        <span>Output image (SaveImage)</span>
                        <span className="text-xs text-muted-foreground">
                          {outputImageSize
                            ? `Size: ${outputImageSize.width}×${outputImageSize.height}`
                            : runResult?.imageUrl
                              ? "Size: loading..."
                              : ""}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded border border-border/60 bg-card/40 h-[360px] flex items-center justify-center">
                        {runResult?.imageUrl ? (
                          <img
                            src={runResult.proxyUrl || runResult.imageUrl || runResult.directUrl}
                            alt="Workflow output"
                            className="h-full w-full object-contain bg-muted"
                            onLoad={(e) =>
                              setOutputImageSize({
                                width: e.currentTarget.naturalWidth,
                                height: e.currentTarget.naturalHeight,
                              })
                            }
                            onError={() =>
                              setRunImageError(
                                "Could not display the output image. Click a link above to open it in a new tab."
                              )
                            }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground px-3 text-center">
                          No output yet. Run the workflow to see the SaveImage result here.
                        </span>
                      )}
                    </div>
                    {runResult?.imageUrl && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <a
                            href={
                              runResult.proxyUrl || runResult.imageUrl || runResult.directUrl || "#"
                            }
                            download={runResult.filename || "output.png"}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        </Button>
                        {runResult.directUrl && (
                          <Button asChild variant="secondary" size="sm">
                            <a href={runResult.directUrl} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                        )}
                        {showDebug && (
                          <span className="text-xs text-muted-foreground break-all">
                            Src: {runResult.proxyUrl || runResult.imageUrl || runResult.directUrl}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
