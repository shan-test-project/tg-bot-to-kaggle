import { Router, type IRouter } from "express";

const router: IRouter = Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const KAGGLE_USERNAME = process.env.KAGGLE_USERNAME;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
}

async function telegramFetch(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function getWebAppUrl(): string {
  const domains = process.env.REPLIT_DOMAINS ?? process.env.REPLIT_DEV_DOMAIN ?? "";
  const domain = domains.split(",")[0]?.trim() ?? "";
  if (domain) {
    return `https://${domain}/`;
  }
  return "https://kaggle-dashboard.replit.app/";
}

router.post("/telegram/webhook", async (req, res) => {
  const update = req.body as Record<string, unknown>;

  try {
    const message = update.message as Record<string, unknown> | undefined;
    const callbackQuery = update.callback_query as Record<string, unknown> | undefined;

    if (message) {
      const chatId = (message.chat as Record<string, unknown>)?.id;
      const text = message.text as string | undefined;
      const from = message.from as Record<string, unknown> | undefined;
      const firstName = (from?.first_name as string) ?? "there";

      if (text === "/start") {
        const webAppUrl = getWebAppUrl();
        await telegramFetch("sendMessage", {
          chat_id: chatId,
          text: `Hi ${firstName}! 👋\n\nWelcome to your Kaggle Notebook Dashboard. Click the button below to open your notebooks and run them with one tap.`,
          reply_markup: {
            inline_keyboard: [[
              {
                text: "📓 Open Notebook Dashboard",
                web_app: { url: webAppUrl },
              },
            ]],
          },
        });
      } else if (text === "/help") {
        await telegramFetch("sendMessage", {
          chat_id: chatId,
          text: `*Kaggle Notebook Dashboard Bot*\n\nCommands:\n/start — Open the dashboard\n/notebooks — List your notebooks\n/help — Show this help\n\nOr just tap the button to open the Mini App and run your notebooks with one click!`,
          parse_mode: "Markdown",
        });
      } else if (text === "/notebooks") {
        const username = KAGGLE_USERNAME ?? "unknown";
        const webAppUrl = getWebAppUrl();
        await telegramFetch("sendMessage", {
          chat_id: chatId,
          text: `Your Kaggle username: *${username}*\n\nOpen the dashboard to see and run your notebooks:`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "📓 Open Dashboard",
                web_app: { url: webAppUrl },
              },
            ]],
          },
        });
      } else {
        const webAppUrl = getWebAppUrl();
        await telegramFetch("sendMessage", {
          chat_id: chatId,
          text: "Open your notebook dashboard below:",
          reply_markup: {
            inline_keyboard: [[
              {
                text: "📓 Open Notebook Dashboard",
                web_app: { url: webAppUrl },
              },
            ]],
          },
        });
      }
    }

    if (callbackQuery) {
      await telegramFetch("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error processing Telegram update");
    res.json({ ok: true });
  }
});

router.post("/telegram/setup", async (req, res) => {
  const webAppUrl = getWebAppUrl();
  const webhookUrl = `${webAppUrl}api/telegram/webhook`;

  try {
    const result = await telegramFetch("setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    }) as { ok: boolean; description?: string };

    if (result.ok) {
      await telegramFetch("setMyCommands", {
        commands: [
          { command: "start", description: "Open the notebook dashboard" },
          { command: "notebooks", description: "List your Kaggle notebooks" },
          { command: "help", description: "Show help" },
        ],
      });

      await telegramFetch("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "📓 Notebooks",
          web_app: { url: webAppUrl },
        },
      });
    }

    res.json({ ok: result.ok, description: result.description ?? "Webhook configured" });
  } catch (err) {
    req.log.error({ err }, "Failed to set webhook");
    res.status(500).json({ ok: false, description: err instanceof Error ? err.message : "Failed to set webhook" });
  }
});

export default router;
