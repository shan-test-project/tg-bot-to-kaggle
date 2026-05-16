import { Router, type IRouter } from "express";
import {
  ListNotebooksResponse,
  RunNotebookParams,
  RunNotebookResponse,
  GetNotebookStatusParams,
  GetNotebookStatusResponse,
} from "@workspace/api-zod";
import { getSettings } from "../settings-store";

const router: IRouter = Router();

const KAGGLE_API = "https://www.kaggle.com/api/v1";

// ── In-memory cache ──────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const NOTEBOOKS_TTL = 5 * 60 * 1000;
const STATUS_TTL    = 2 * 60 * 1000;

let _notebooksCache: CacheEntry<unknown[]> | null = null;
const statusCache = new Map<string, CacheEntry<Record<string, unknown>>>();

function getCached<T>(entry: CacheEntry<T> | null, ttl: number): T | null {
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttl) return null;
  return entry.data;
}

// ── Circuit breaker ──────────────────────────────────────────────────────────
const CB_FAILURE_THRESHOLD = 3;
const CB_COOLDOWN = 10 * 60 * 1000;

let cbFailures = 0;
let cbOpenedAt: number | null = null;

function circuitOpen(): boolean {
  if (cbOpenedAt === null) return false;
  if (Date.now() - cbOpenedAt >= CB_COOLDOWN) {
    cbOpenedAt = null;
    cbFailures = 0;
    return false;
  }
  return true;
}

function recordSuccess() { cbFailures = 0; cbOpenedAt = null; }
function recordFailure() {
  cbFailures += 1;
  if (cbFailures >= CB_FAILURE_THRESHOLD && cbOpenedAt === null) cbOpenedAt = Date.now();
}

// ── Kaggle fetch ─────────────────────────────────────────────────────────────
async function kaggleFetch(path: string, options: RequestInit = {}) {
  const { kaggleKey } = getSettings();
  const res = await fetch(`${KAGGLE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${kaggleKey}`,
      "Content-Type": "application/json",
      "User-Agent": "python-kaggle/1.6.17",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kaggle API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Vend credentials to the browser (Kaggle blocks cloud IPs but allows browsers via CORS *)
router.get("/kaggle/credentials", (_req, res) => {
  const { kaggleUsername, kaggleKey } = getSettings();
  res.json({ username: kaggleUsername, key: kaggleKey });
});

router.get("/kaggle/notebooks", async (req, res) => {
  const { kaggleUsername } = getSettings();
  if (!kaggleUsername) {
    return res.status(400).json({ error: "Kaggle username not configured. Open Settings to add it." });
  }

  const cached = getCached(_notebooksCache, NOTEBOOKS_TTL);
  if (cached && circuitOpen()) {
    const parsed = ListNotebooksResponse.parse({
      notebooks: cached,
      cachedAt: new Date(_notebooksCache!.fetchedAt).toISOString(),
    });
    return res.json(parsed);
  }

  if (!circuitOpen()) {
    try {
      const data = await kaggleFetch(
        `/kernels/list?user=${encodeURIComponent(kaggleUsername)}&page=1&pageSize=50`
      );
      const notebooks = (Array.isArray(data) ? data : []).map((k: Record<string, unknown>) => {
        const ref = (k.ref as string) ?? `${kaggleUsername}/unknown`;
        const parts = ref.split("/");
        const slug = parts[parts.length - 1] ?? ref;
        const owner = (k.author as string) ?? kaggleUsername;
        return {
          ref, title: (k.title as string) ?? "Untitled", slug, owner,
          lastRunTime: (k.lastRunTime as string | null) ?? null,
          totalVotes: (k.totalVotes as number) ?? 0,
          language: (k.language as string) ?? "python",
          isPrivate: (k.isPrivate as boolean) ?? false,
          url: `https://www.kaggle.com/${ref}`,
        };
      });
      _notebooksCache = { data: notebooks, fetchedAt: Date.now() };
      recordSuccess();
      const parsed = ListNotebooksResponse.parse({ notebooks, cachedAt: null });
      return res.json(parsed);
    } catch (err) {
      req.log.error({ err }, "Failed to list notebooks from Kaggle");
      recordFailure();
      const stale = _notebooksCache;
      if (stale) {
        const parsed = ListNotebooksResponse.parse({
          notebooks: stale.data,
          cachedAt: new Date(stale.fetchedAt).toISOString(),
        });
        return res.json(parsed);
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list notebooks" });
    }
  }

  return res.status(503).json({ error: "Kaggle API temporarily unavailable. Please try again in a few minutes." });
});

router.post("/kaggle/notebooks/:owner/:slug/run", async (req, res) => {
  const { owner, slug } = req.params as { owner: string; slug: string };
  const ref = `${owner}/${slug}`;
  RunNotebookParams.parse({ ref });

  if (circuitOpen()) return res.status(503).json({ error: "Kaggle API is temporarily unavailable." });

  try {
    const pulled = await kaggleFetch(
      `/kernels/pull?userName=${encodeURIComponent(owner)}&kernelSlug=${encodeURIComponent(slug)}`
    ) as Record<string, unknown>;
    const meta = pulled.metadata as Record<string, unknown>;
    const blob = pulled.blob as Record<string, unknown>;

    await kaggleFetch(`/kernels/push`, {
      method: "POST",
      body: JSON.stringify({
        id: meta.id, language: meta.language ?? "python",
        kernelType: meta.kernelType ?? "notebook",
        isPrivate: meta.isPrivate ?? true,
        enableGpu: meta.enableGpu ?? false, enableTpu: meta.enableTpu ?? false,
        enableInternet: meta.enableInternet ?? true,
        datasetDataSources: meta.datasetDataSources ?? [],
        competitionDataSources: meta.competitionDataSources ?? [],
        kernelDataSources: meta.kernelDataSources ?? [],
        modelDataSources: meta.modelDataSources ?? [],
        dockerImage: meta.dockerImage ?? "",
        source: blob.source ?? "", newTitle: null,
      }),
    });

    recordSuccess();
    statusCache.delete(ref);
    const result = RunNotebookResponse.parse({ ref, status: "queued", message: "Notebook run triggered successfully" });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to trigger notebook run");
    recordFailure();
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to trigger run" });
  }
});

router.get("/kaggle/notebooks/:owner/:slug/status", async (req, res) => {
  const { owner, slug } = req.params as { owner: string; slug: string };
  const ref = `${owner}/${slug}`;
  GetNotebookStatusParams.parse({ ref });

  const cachedStatus = getCached(statusCache.get(ref) ?? null, STATUS_TTL);
  if (cachedStatus && circuitOpen()) {
    const statusMap: Record<string, string> = {
      running: "running", complete: "complete", error: "error",
      queued: "queued", cancelAcknowledged: "cancelAcknowledged",
    };
    const rawStatus = (cachedStatus.status as string) ?? "complete";
    const result = GetNotebookStatusResponse.parse({
      ref, status: statusMap[rawStatus] ?? "complete",
      lastRunTime: (cachedStatus.lastRunTime as string | null) ?? null,
      totalVotes: (cachedStatus.totalVotes as number) ?? 0,
    });
    return res.json(result);
  }

  if (circuitOpen()) return res.status(503).json({ error: "Kaggle API temporarily unavailable." });

  try {
    const data = await kaggleFetch(
      `/kernels/status?userName=${encodeURIComponent(owner)}&kernelSlug=${encodeURIComponent(slug)}`
    ) as Record<string, unknown>;

    statusCache.set(ref, { data, fetchedAt: Date.now() });
    recordSuccess();

    const statusMap: Record<string, string> = {
      running: "running", complete: "complete", error: "error",
      queued: "queued", cancelAcknowledged: "cancelAcknowledged",
    };
    const rawStatus = (data.status as string) ?? "complete";
    const result = GetNotebookStatusResponse.parse({
      ref, status: statusMap[rawStatus] ?? "complete",
      lastRunTime: (data.lastRunTime as string | null) ?? null,
      totalVotes: (data.totalVotes as number) ?? 0,
    });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get notebook status");
    recordFailure();
    const stale = statusCache.get(ref);
    if (stale) {
      const statusMap: Record<string, string> = {
        running: "running", complete: "complete", error: "error",
        queued: "queued", cancelAcknowledged: "cancelAcknowledged",
      };
      const rawStatus = (stale.data.status as string) ?? "complete";
      const result = GetNotebookStatusResponse.parse({
        ref, status: statusMap[rawStatus] ?? "complete",
        lastRunTime: (stale.data.lastRunTime as string | null) ?? null,
        totalVotes: (stale.data.totalVotes as number) ?? 0,
      });
      return res.json(result);
    }
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get status" });
  }
});

export default router;
