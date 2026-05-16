import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const KAGGLE_API = "https://www.kaggle.com/api/v1";

interface KaggleCreds { username: string; key: string; }

interface Notebook {
  ref: string; title: string; slug: string; owner: string;
  lastRunTime?: string | null; totalVotes: number; language: string;
  isPrivate: boolean; url: string;
}

interface NotebookStatus {
  ref: string; status: string; lastRunTime?: string | null; totalVotes: number;
}

async function fetchCreds(): Promise<KaggleCreds> {
  const res = await fetch("/api/kaggle/credentials");
  if (!res.ok) throw new Error("Failed to fetch credentials");
  return res.json();
}

function kaggleFetch(path: string, creds: KaggleCreds, options: RequestInit = {}) {
  return fetch(`${KAGGLE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${creds.key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export function useKaggleCreds() {
  return useQuery<KaggleCreds>({
    queryKey: ["kaggle-creds"],
    queryFn: fetchCreds,
    staleTime: Infinity,
    retry: 2,
  });
}

export function useKaggleNotebooks() {
  const { data: creds } = useKaggleCreds();
  return useQuery<{ notebooks: Notebook[]; cachedAt?: string | null }>({
    queryKey: ["kaggle-notebooks"],
    enabled: !!creds,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await kaggleFetch(
        `/kernels/list?user=${encodeURIComponent(creds!.username)}&page=1&pageSize=50`,
        creds!
      );
      if (!res.ok) throw new Error(`Kaggle API error ${res.status}`);
      const data = await res.json();
      const notebooks = (Array.isArray(data) ? data : []).map((k: Record<string, unknown>) => {
        const ref = (k.ref as string) ?? `${creds!.username}/unknown`;
        const parts = ref.split("/");
        return {
          ref,
          title: (k.title as string) ?? "Untitled",
          slug: parts[parts.length - 1] ?? ref,
          owner: (k.author as string) ?? creds!.username,
          lastRunTime: (k.lastRunTime as string | null) ?? null,
          totalVotes: (k.totalVotes as number) ?? 0,
          language: (k.language as string) ?? "python",
          isPrivate: (k.isPrivate as boolean) ?? false,
          url: `https://www.kaggle.com/${ref}`,
        };
      });
      return { notebooks, cachedAt: null };
    },
  });
}

export function useKaggleStatus(ref: string) {
  const { data: creds } = useKaggleCreds();
  const [owner, slug] = ref.split("/");
  return useQuery<NotebookStatus>({
    queryKey: ["kaggle-status", ref],
    enabled: !!creds && !!ref,
    staleTime: 60 * 1000,
    retry: 0,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return (s === "running" || s === "queued" || s === "cancelAcknowledged") ? 30_000 : false;
    },
    queryFn: async () => {
      const res = await kaggleFetch(
        `/kernels/status?userName=${encodeURIComponent(owner)}&kernelSlug=${encodeURIComponent(slug)}`,
        creds!
      );
      if (!res.ok) throw new Error(`Kaggle status error ${res.status}`);
      const data: Record<string, unknown> = await res.json();
      const statusMap: Record<string, string> = {
        running: "running", complete: "complete", error: "error",
        queued: "queued", cancelAcknowledged: "cancelAcknowledged",
      };
      const raw = (data.status as string) ?? "complete";
      return {
        ref,
        status: statusMap[raw] ?? "complete",
        lastRunTime: (data.lastRunTime as string | null) ?? null,
        totalVotes: (data.totalVotes as number) ?? 0,
      };
    },
  });
}

export function useKaggleRun() {
  const { data: creds } = useKaggleCreds();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { ref: string }>({
    mutationFn: async ({ ref }) => {
      if (!creds) throw new Error("No credentials");
      const [owner, slug] = ref.split("/");
      const pullRes = await kaggleFetch(
        `/kernels/pull?userName=${encodeURIComponent(owner)}&kernelSlug=${encodeURIComponent(slug)}`,
        creds
      );
      if (!pullRes.ok) throw new Error(`Failed to pull kernel: ${pullRes.status}`);
      const pulled: Record<string, unknown> = await pullRes.json();
      const meta = pulled.metadata as Record<string, unknown>;
      const blob = pulled.blob as Record<string, unknown>;
      const pushRes = await kaggleFetch("/kernels/push", creds, {
        method: "POST",
        body: JSON.stringify({
          id: meta.id, language: meta.language ?? "python",
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
      if (!pushRes.ok) throw new Error(`Failed to push kernel: ${pushRes.status}`);
    },
    onSuccess: (_data, { ref }) => {
      queryClient.invalidateQueries({ queryKey: ["kaggle-status", ref] });
    },
  });
}
