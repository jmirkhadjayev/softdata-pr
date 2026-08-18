/* ===========================================================
   POST /api/form — aloqa formasi murojaatini Telegramga yuboradi

   Kerakli environment o'zgaruvchilari (Vercel → Settings → Environment Variables):
     TELEGRAM_BOT_TOKEN   @BotFather bergan token
     TELEGRAM_CHAT_ID     murojaat tushadigan chat (shaxsiy yoki guruh)
     ALLOWED_ORIGIN       (ixtiyoriy) sayt manzili, standart: barchasi

   Tokenlar faqat shu yerda — brauzerga hech qachon tushmaydi.
   =========================================================== */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;   // odam xato yozib qayta yuborishi mumkin
const hits = new Map();   // best-effort: serverless instance yashagunicha

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 500) hits.clear();      // xotira o'smasin
    return false;
  }
  rec.n++;
  return rec.n > MAX_PER_WINDOW;
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan");
    return res.status(500).json({ error: "not_configured" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too_many_requests" });

  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});

  // Honeypot: odam ko'rmaydigan maydon. To'ldirilgan bo'lsa — bot.
  // Muvaffaqiyat qaytaramiz, aks holda spamer usulini o'zgartiradi.
  if (clean(body.company, 50)) return res.status(200).json({ ok: true });

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const message = clean(body.message, 2000);
  const lang = ["uz", "ru", "en"].includes(body.lang) ? body.lang : "uz";
  const page = clean(body.page, 200);

  if (!name || !phone) return res.status(400).json({ error: "missing_fields" });
  if (!/[0-9]{7,}/.test(phone.replace(/\D/g, ""))) {
    return res.status(400).json({ error: "bad_phone" });
  }

  const text =
    "<b>🔔 Yangi murojaat — softdata.uz</b>\n\n" +
    "<b>Ism:</b> " + esc(name) + "\n" +
    "<b>Telefon:</b> " + esc(phone) + "\n" +
    (message ? "<b>Xabar:</b> " + esc(message) + "\n" : "") +
    "\n<i>til: " + lang + (page ? " · " + esc(page) : "") + "</i>";

  try {
    const tg = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await tg.json();
    if (!data.ok) {
      console.error("Telegram xatosi:", data);
      return res.status(502).json({ error: "delivery_failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Telegramga ulanmadi:", err);
    return res.status(502).json({ error: "delivery_failed" });
  }
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
