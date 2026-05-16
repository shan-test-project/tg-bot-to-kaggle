import { useState, useEffect } from "react";
import { Settings, X, Eye, EyeOff, Save, CheckCircle } from "lucide-react";

interface SettingsState {
  kaggleUsername: string;
  kaggleKey: string;
  telegramBotToken: string;
  hasKaggleUsername: boolean;
  hasKaggleKey: boolean;
  hasTelegramBotToken: boolean;
}

function FieldInput({
  label, value, onChange, placeholder, secret = false, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; secret?: boolean; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 px-3 pr-10 rounded-xl text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all font-mono"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/60 font-mono">{hint}</p>}
    </div>
  );
}

export function SettingsModal({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ kaggleUsername: "", kaggleKey: "", telegramBotToken: "" });
  const [current, setCurrent] = useState<SettingsState | null>(null);

  async function fetchCurrent() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data: SettingsState = await res.json();
        setCurrent(data);
        setForm({
          kaggleUsername: data.kaggleUsername,
          kaggleKey: "",
          telegramBotToken: "",
        });
      }
    } catch {}
  }

  useEffect(() => {
    if (open) fetchCurrent();
  }, [open]);

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      if (form.kaggleUsername) body.kaggleUsername = form.kaggleUsername;
      if (form.kaggleKey) body.kaggleKey = form.kaggleKey;
      if (form.telegramBotToken) body.telegramBotToken = form.telegramBotToken;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchCurrent();
      onSaved?.();
    } catch (e) {
      setError("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        style={{ background: "rgba(139,92,246,0.06)" }}
        title="Settings"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-border shadow-2xl z-10"
            style={{ background: "rgba(14, 11, 24, 0.98)" }}>

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-primary/30"
                  style={{ background: "linear-gradient(135deg, #4c1d95, #6d28d9)" }}>
                  <Settings className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="font-bold text-sm">Settings</h2>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/60">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex gap-2 text-[10px] font-mono">
                <span className={`px-2 py-0.5 rounded-full border ${current?.hasKaggleUsername ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}`}>
                  {current?.hasKaggleUsername ? "✓ Kaggle User" : "✗ Kaggle User"}
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${current?.hasKaggleKey ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}`}>
                  {current?.hasKaggleKey ? "✓ API Key" : "✗ API Key"}
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${current?.hasTelegramBotToken ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}`}>
                  {current?.hasTelegramBotToken ? "✓ TG Bot" : "✗ TG Bot"}
                </span>
              </div>

              <FieldInput
                label="Kaggle Username"
                value={form.kaggleUsername}
                onChange={v => setForm(f => ({ ...f, kaggleUsername: v }))}
                placeholder="e.g. your_kaggle_username"
                hint="Your Kaggle profile username"
              />
              <FieldInput
                label="Kaggle API Key"
                value={form.kaggleKey}
                onChange={v => setForm(f => ({ ...f, kaggleKey: v }))}
                placeholder={current?.hasKaggleKey ? "Leave blank to keep current" : "KGAT_xxxxxxxxxxxxxxxx"}
                secret
                hint="From kaggle.com → Account → API → Create New Token"
              />
              <FieldInput
                label="Telegram Bot Token"
                value={form.telegramBotToken}
                onChange={v => setForm(f => ({ ...f, telegramBotToken: v }))}
                placeholder={current?.hasTelegramBotToken ? "Leave blank to keep current" : "123456:ABCdef..."}
                secret
                hint="From @BotFather on Telegram"
              />

              {error && (
                <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: saved ? "linear-gradient(135deg, #166534, #15803d)" : "linear-gradient(135deg, #4c1d95, #7c3aed)" }}>
                {saved ? (
                  <><CheckCircle className="w-4 h-4" />Saved!</>
                ) : loading ? (
                  "Saving…"
                ) : (
                  <><Save className="w-4 h-4" />Save Settings</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
