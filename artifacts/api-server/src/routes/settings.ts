import { Router, type IRouter } from "express";
import { getSettings, saveSettings } from "../settings-store";

const router: IRouter = Router();

router.get("/settings", (_req, res) => {
  const s = getSettings();
  res.json({
    kaggleUsername: s.kaggleUsername,
    kaggleKey: s.kaggleKey ? "***" + s.kaggleKey.slice(-4) : "",
    telegramBotToken: s.telegramBotToken ? "***" + s.telegramBotToken.slice(-4) : "",
    hasKaggleUsername: !!s.kaggleUsername,
    hasKaggleKey: !!s.kaggleKey,
    hasTelegramBotToken: !!s.telegramBotToken,
  });
});

router.put("/settings", (req, res) => {
  const body = req.body as Record<string, string>;
  const partial: Record<string, string> = {};
  if (body.kaggleUsername !== undefined) partial.kaggleUsername = body.kaggleUsername;
  if (body.kaggleKey && !body.kaggleKey.startsWith("***")) partial.kaggleKey = body.kaggleKey;
  if (body.telegramBotToken && !body.telegramBotToken.startsWith("***")) partial.telegramBotToken = body.telegramBotToken;
  saveSettings(partial);
  res.json({ ok: true, message: "Settings saved" });
});

export default router;
