import fs from "fs";
import path from "path";

export interface AppSettings {
  kaggleUsername: string;
  kaggleKey: string;
  telegramBotToken: string;
  sessionSecret: string;
}

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSettings(): AppSettings {
  ensureDataDir();
  let fileSettings: Partial<AppSettings> = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      fileSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    } catch {
      fileSettings = {};
    }
  }
  return {
    kaggleUsername: fileSettings.kaggleUsername ?? process.env.KAGGLE_USERNAME ?? "",
    kaggleKey: fileSettings.kaggleKey ?? process.env.KAGGLE_KEY ?? "",
    telegramBotToken: fileSettings.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "",
    sessionSecret: fileSettings.sessionSecret ?? process.env.SESSION_SECRET ?? "change-me-in-settings",
  };
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  ensureDataDir();
  const current = loadSettings();
  const updated: AppSettings = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export function getSettings(): AppSettings {
  return loadSettings();
}
