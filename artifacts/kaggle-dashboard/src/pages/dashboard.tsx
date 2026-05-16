import { useKaggleNotebooks, useKaggleCreds } from "@/hooks/use-kaggle-client";
import { useSetupTelegramBot } from "@workspace/api-client-react";
import { NotebookCard } from "@/components/notebook-card";
import { SettingsModal } from "@/components/settings-modal";
import { SiKaggle } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { RefreshCw, Bot, AlertTriangle, BookOpen, Sparkles, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border p-5 card-shimmer overflow-hidden relative">
      <div className="absolute inset-0 opacity-30"
        style={{background: "radial-gradient(circle at top right, rgba(139,92,246,0.08) 0%, transparent 70%)"}} />
      <div className="skeleton-shimmer h-5 w-2/3 rounded-lg mb-3" />
      <div className="flex gap-2 mb-5">
        <div className="skeleton-shimmer h-5 w-14 rounded-full" />
        <div className="skeleton-shimmer h-5 w-16 rounded-full" />
        <div className="skeleton-shimmer h-5 w-24 rounded-full" />
      </div>
      <div className="skeleton-shimmer h-10 w-full rounded-xl" />
    </div>
  );
}

export default function Dashboard() {
  const { isLoading: credsLoading } = useKaggleCreds();
  const { data, isLoading, isError, refetch, isFetching } = useKaggleNotebooks();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const setupBot = useSetupTelegramBot({
    mutation: {
      onSuccess: () => toast({ title: "Bot Configured", description: "Telegram webhook registered successfully." }),
      onError: (err: any) => toast({ variant: "destructive", title: "Setup Failed", description: err.error || "Failed to configure bot." }),
    }
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["kaggle-creds"] });
    queryClient.invalidateQueries({ queryKey: ["kaggle-notebooks"] });
    refetch();
  };

  const notebooks = data?.notebooks ?? [];
  const cachedAt = data?.cachedAt;
  const isFromCache = !!cachedAt;
  const showLoading = credsLoading || isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{background: "radial-gradient(circle, rgba(139,92,246,1) 0%, transparent 70%)"}} />
        <div className="absolute top-1/2 -left-32 w-64 h-64 rounded-full opacity-8"
          style={{background: "radial-gradient(circle, rgba(168,85,247,1) 0%, transparent 70%)"}} />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/60 backdrop-blur-xl"
        style={{background: "rgba(12, 10, 20, 0.85)"}}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-purple-sm border border-primary/30"
              style={{background: "linear-gradient(135deg, #4c1d95, #6d28d9)"}}>
              <SiKaggle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none purple-gradient-text">Kaggle Control</h1>
              {!showLoading && !isError && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {notebooks.length} notebook{notebooks.length !== 1 ? "s" : ""}
                  {isFromCache && " · cached"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              style={{background: "rgba(139,92,246,0.06)"}}>
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setupBot.mutate()}
              disabled={setupBot.isPending}
              className="h-8 px-3 rounded-lg border border-primary/30 text-xs font-semibold text-primary flex items-center gap-1.5 hover:bg-primary/10 transition-all disabled:opacity-50"
              style={{background: "rgba(139,92,246,0.08)"}}>
              <Bot className="w-3.5 h-3.5" />
              {setupBot.isPending ? "Setting up…" : "Setup Bot"}
            </button>
            <SettingsModal onSaved={handleRefresh} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 relative z-10">
        {isFromCache && !showLoading && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/20 text-amber-400 text-xs font-mono"
            style={{background: "rgba(245,158,11,0.06)"}}>
            <WifiOff className="w-3 h-3 shrink-0" />
            <span>
              Showing cached data from{" "}
              <strong>{formatDistanceToNow(new Date(cachedAt!), { addSuffix: true })}</strong>.
            </span>
          </div>
        )}

        {!showLoading && !isError && notebooks.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Your Notebooks</span>
          </div>
        )}

        {showLoading && (
          <div className="grid grid-cols-1 gap-3">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {isError && (
          <div className="mt-8 p-8 rounded-2xl border border-destructive/20 text-center"
            style={{background: "rgba(239,68,68,0.06)"}}>
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4 border border-destructive/20">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="font-bold text-base mb-1">Connection Failed</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Could not reach the Kaggle API. Check your credentials in Settings and try again.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isFetching}>
                {isFetching ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Trying…</> : "Try Again"}
              </Button>
            </div>
          </div>
        )}

        {!showLoading && !isError && notebooks.length === 0 && (
          <div className="mt-8 p-10 rounded-2xl border border-border/60 text-center card-shimmer">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-base mb-1">No Notebooks Found</h3>
            <p className="text-sm text-muted-foreground mb-4">Check your Kaggle username in Settings or create your first notebook on Kaggle.</p>
          </div>
        )}

        {!showLoading && !isError && notebooks.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {notebooks.map((notebook) => (
              <NotebookCard key={notebook.ref} notebook={notebook} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
