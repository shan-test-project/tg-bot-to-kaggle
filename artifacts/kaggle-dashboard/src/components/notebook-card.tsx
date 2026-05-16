import { Play, Loader2, Lock, Globe, Clock, CheckCircle2, AlertCircle, ExternalLink, Zap } from "lucide-react";
import { useKaggleStatus, useKaggleRun } from "@/hooks/use-kaggle-client";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface NotebookCardProps {
  notebook: {
    ref: string; title: string; slug: string; owner: string;
    lastRunTime?: string | null; totalVotes: number; language: string;
    isPrivate: boolean; url: string;
  };
}

function StatusPill({ status }: { status: string }) {
  if (status === "running" || status === "queued" || status === "cancelAcknowledged") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full animate-pulse-glow border border-violet-500/40 text-violet-300"
        style={{background: "rgba(139,92,246,0.15)"}}>
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        {status === "queued" ? "Queued" : status === "cancelAcknowledged" ? "Cancelling" : "Running"}
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400"
        style={{background: "rgba(16,185,129,0.10)"}}>
        <CheckCircle2 className="w-2.5 h-2.5" />Complete
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border border-red-500/30 text-red-400"
        style={{background: "rgba(239,68,68,0.10)"}}>
        <AlertCircle className="w-2.5 h-2.5" />Error
      </span>
    );
  }
  return null;
}

export function NotebookCard({ notebook }: NotebookCardProps) {
  const { toast } = useToast();
  const { data: statusData } = useKaggleStatus(notebook.ref);
  const runNotebook = useKaggleRun();

  const status = statusData?.status;
  const isRunning = status === "running" || status === "queued" || status === "cancelAcknowledged";
  const isPending = runNotebook.isPending || isRunning;

  const handleRun = () => {
    runNotebook.mutate({ ref: notebook.ref }, {
      onSuccess: () => toast({ title: "Run triggered", description: `${notebook.title} is now running.` }),
      onError: (err) => toast({ variant: "destructive", title: "Run failed", description: err.message || "Failed to trigger run." }),
    });
  };

  return (
    <div className="group relative rounded-2xl border border-border/70 overflow-hidden transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(145deg, hsl(252,22%,11%) 0%, hsl(255,20%,12.5%) 100%)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.3)"
      }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{background: "radial-gradient(circle at top right, rgba(139,92,246,0.08) 0%, transparent 65%)"}} />
      <div className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)"}} />

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <a href={notebook.url} target="_blank" rel="noreferrer"
              className="group/link flex items-start gap-1.5 hover:text-primary transition-colors">
              <h3 className="font-semibold text-sm leading-snug text-foreground group-hover/link:text-primary transition-colors truncate">
                {notebook.title}
              </h3>
              <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{notebook.ref}</p>
          </div>
          {status && <StatusPill status={status} />}
        </div>

        <div className="flex items-center gap-3 mb-4 text-[10px] font-mono text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {notebook.isPrivate ? <><Lock className="w-2.5 h-2.5" />Private</> : <><Globe className="w-2.5 h-2.5" />Public</>}
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="capitalize">{notebook.language}</span>
          <span className="w-px h-3 bg-border" />
          <span className="inline-flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {notebook.lastRunTime ? formatDistanceToNow(new Date(notebook.lastRunTime), { addSuffix: true }) : "Never run"}
          </span>
        </div>

        <button
          onClick={handleRun}
          disabled={isPending}
          className="w-full h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] text-white"
          style={{
            background: isPending
              ? "rgba(109,40,217,0.5)"
              : "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%)",
            boxShadow: isPending ? "none" : "0 4px 15px rgba(109,40,217,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
          }}>
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>{isRunning ? "Running…" : "Starting…"}</span></>
          ) : (
            <><Zap className="w-4 h-4 fill-current" /><span>Run Notebook</span></>
          )}
        </button>
      </div>
    </div>
  );
}
