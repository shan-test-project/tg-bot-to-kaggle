import { Router, type IRouter } from "express";
import {
  ListNotebooksResponse,
  RunNotebookParams,
  RunNotebookResponse,
  GetNotebookStatusParams,
  GetNotebookStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const KAGGLE_USERNAME = process.env.KAGGLE_USERNAME;
const KAGGLE_KEY = process.env.KAGGLE_KEY;

if (!KAGGLE_USERNAME || !KAGGLE_KEY) {
  throw new Error("KAGGLE_USERNAME and KAGGLE_KEY environment variables are required");
}

const KAGGLE_API = "https://www.kaggle.com/api/v1";

// ── In-memory cache ──────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const NOTEBOOKS_TTL = 5 * 60 * 1000;   // 5 minutes
const STATUS_TTL    = 2 * 60 * 1000;   // 2 minutes

let _notebooksCache: CacheEntry<unknown[]> | null = null;
const statusCache = new Map<string, CacheEntry<Record<string, unknown>>>();

function getCached<T>(entry: CacheEntry<T> | null, ttl: number): T | null {
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttl) return null;
  return entry.data;
}

// ── Circuit breaker ──────────────────────────────────────────────────────────
const CB_FAILURE_THRESHOLD = 3;
const CB_COOLDOWN = 10 * 60 * 1000; // 10 minutes

let cbFailures = 0;
let cbOpenedAt: number | null = null;

function circuitOpen(): boolean {
  if (cbOpenedAt === null) return false;
  if (Date.now() - cbOpenedAt >= CB_COOLDOWN) {
    // cooldown elapsed → half-open: allow one attempt
    cbOpenedAt = null;
    cbFailures = 0;
    return false;
  }
  return true;
}

function recordSuccess() {
  cbFailures = 0;
  cbOpenedAt = null;
}

function recordFailure() {
  cbFailures += 1;
  if (cbFailures >= CB_FAILURE_THRESHOLD && cbOpenedAt === null) {
    cbOpenedAt = Date.now();
  }
}

// ── Kaggle fetch ─────────────────────────────────────────────────────────────
async function kaggleFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${KAGGLE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KAGGLE_KEY}`,
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

// Vend credentials to the browser so it can call Kaggle directly
// (Kaggle blocks cloud IPs but allows browser requests via CORS *)
router.get("/kaggle/credentials", (_req, res) => {
  res.json({ username: KAGGLE_USERNAME, key: KAGGLE_KEY });
});

router.get("/kaggle/notebooks", async (req, res) => {
  // 1. Check if we can serve from cache directly
  const cached = getCached(_notebooksCache, NOTEBOOKS_TTL);
  if (cached && circuitOpen()) {
    // Circuit open + cache available → serve stale data gracefully
    const parsed = ListNotebooksResponse.parse({
      notebooks: cached,
      cachedAt: new Date(_notebooksCache!.fetchedAt).toISOString(),
    });
    return res.json(parsed);
  }

  // 2. Try to fetch fresh data from Kaggle
  if (!circuitOpen()) {
    try {
      const data = await kaggleFetch(
        `/kernels/list?user=${encodeURIComponent(KAGGLE_USERNAME)}&page=1&pageSize=50`
      );

      const notebooks = (Array.isArray(data) ? data : []).map((k: Record<string, unknown>) => {
        const ref = (k.ref as string) ?? `${KAGGLE_USERNAME}/unknown`;
        const parts = ref.split("/");
        const slug = parts[parts.length - 1] ?? ref;
        const owner = (k.author as string) ?? KAGGLE_USERNAME;
        return {
          ref,
          title: (k.title as string) ?? "Untitled",
          slug,
          owner,
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

      // Fall through to stale cache if available
      const stale = _notebooksCache;
      if (stale) {
        req.log.warn("Serving stale notebook list from cache");
        const parsed = ListNotebooksResponse.parse({
          notebooks: stale.data,
          cachedAt: new Date(stale.fetchedAt).toISOString(),
        });
        return res.json(parsed);
      }

      return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list notebooks" });
    }
  }

  // Circuit open, no cache → return error
  return res.status(503).json({ error: "Kaggle API temporarily unavailable. Please try again in a few minutes." });
});

router.post("/kaggle/notebooks/:owner/:slug/run", async (req, res) => {
  const { owner, slug } = req.params as { owner: string; slug: string };
  const ref = `${owner}/${slug}`;
  RunNotebookParams.parse({ ref });

  if (circuitOpen()) {
    return res.status(503).json({ error: "Kaggle API is temporarily unavailable. Please try again later." });
  }

  try {
    const pulled = await kaggleFetch(
      `/kernels/pull?userName=${encodeURIComponent(owner)}&kernelSlug=${encodeURIComponent(slug)}`
    ) as Record<string, unknown>;
    const meta = pulled.metadata as Record<string, unknown>;
    const blob = pulled.blob as Record<string, unknown>;

    await kaggleFetch(`/kernels/push`, {
      method: "POST",
      body: JSON.stringify({
        id: meta.id,
        language: meta.language ?? "python",
        kernelType: meta.kernelType ?? "notebook",
        isPrivate: meta.isPrivate ?? true,
        enableGpu: meta.enableGpu ?? false,
        enableTpu: meta.enableTpu ?? false,
        enableInternet: meta.enableInternet ?? true,
        datasetDataSources: meta.datasetDataSources ?? [],
        competitionDataSources: meta.competitionDataSources ?? [],
        kernelDataSources: meta.kernelDataSources ?? [],
        modelDataSources: meta.modelDataSources ?? [],
        dockerImage: meta.dockerImage ?? "",
        source: blob.source ?? "",
        newTitle: null,
      }),
    });

    recordSuccess();
    // Invalidate status cache for this notebook
    statusCache.delete(ref);

    const result = RunNotebookResponse.parse({
      ref,
      status: "queued",
      message: "Notebook run triggered successfully",
    });
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

  // Serve from cache if circuit open
  const cachedStatus = getCached(statusCache.get(ref) ?? null, STATUS_TTL);
  if (cachedStatus && circuitOpen()) {
    const statusMap: Record<string, string> = {
      running: "running", complete: "complete", error: "error",
      queued: "queued", cancelAcknowledged: "cancelAcknowledged",
    };
    const rawStatus = (cachedStatus.status as string) ?? "complete";
    const result = GetNotebookStatusResponse.parse({
      ref,
      status: statusMap[rawStatus] ?? "complete",
      lastRunTime: (cachedStatus.lastRunTime as string | null) ?? null,
      totalVotes: (cachedStatus.totalVotes as number) ?? 0,
    });
    return res.json(result);
  }

  if (circuitOpen()) {
    return res.status(503).json({ error: "Kaggle API temporarily unavailable." });
  }

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
    const mappedStatus = statusMap[rawStatus] ?? "complete";

    const result = GetNotebookStatusResponse.parse({
      ref,
      status: mappedStatus,
      lastRunTime: (data.lastRunTime as string | null) ?? null,
      totalVotes: (data.totalVotes as number) ?? 0,
    });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get notebook status");
    recordFailure();

    // Return stale status if available
    const stale = statusCache.get(ref);
    if (stale) {
      const statusMap: Record<string, string> = {
        running: "running", complete: "complete", error: "error",
        queued: "queued", cancelAcknowledged: "cancelAcknowledged",
      };
      const rawStatus = (stale.data.status as string) ?? "complete";
      const result = GetNotebookStatusResponse.parse({
        ref,
        status: statusMap[rawStatus] ?? "complete",
        lastRunTime: (stale.data.lastRunTime as string | null) ?? null,
        totalVotes: (stale.data.totalVotes as number) ?? 0,
      });
      return res.json(result);
    }

    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get status" });
  }
});

export default router;
