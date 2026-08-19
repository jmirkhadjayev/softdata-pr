/* ===========================================================
   POST /api/chat — AI yordamchi javobini Claude API'dan oladi

   Kerakli environment o'zgaruvchilari:
     ANTHROPIC_API_KEY    console.anthropic.com dan olinadi
     ALLOWED_ORIGIN       (ixtiyoriy) sayt manzili

   Kalit faqat shu yerda turadi. Frontend chat.js bu endpointga
   {message, lang, history} yuboradi va {reply} oladi.
   =========================================================== */

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 700;

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 15;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 500) hits.clear();
    return false;
  }
  rec.n++;
  return rec.n > MAX_PER_WINDOW;
}

/* Kompaniya haqidagi barcha ma'lumot shu yerda — model faqat shundan
   javob beradi. Sayt matni o'zgarsa, shu matnni ham yangilang. */
const COMPANY = `
SoftData MChJ — Toshkentdagi IT kompaniya. To'rt yo'nalish:

PARKING (avtomatik parkovka): shlagbaum, ANPR kameralar (davlat raqamini
tanish), abonement, onlayn to'lov, bo'sh joylar tablosi real vaqtda,
avtomatik hisobot. Mashina yaqinlashadi — kamera raqamni o'qiydi, ruxsat
bo'lsa to'siq o'zi ochiladi.

SECURITY (xavfsizlik): videokuzatuv (CCTV), kirish nazorati (ACS),
domofon, signalizatsiya, arxiv va serverlar. Obyekt 24/7 nazoratda,
hodisani sana va vaqt bo'yicha bir daqiqada topish mumkin, telefondan
kuzatiladi.

AUTOMATION (jarayon avtomatlashtirish): kirish-chiqish qayd etiladi,
ish vaqti o'zi hisoblanadi, avtomatik hisobotlar, Telegram xabarnomalari,
stsenariylar va qoidalar, boshqaruv paneli.

INTEGRATION (tizim integratsiyasi): 1C, CRM/ERP, to'lov servislari,
kameralar, turniketlar va shlagbaumlar yagona markazdan. API va webhook.
Mavjud jihozni almashtirish shart emas — ko'p hollarda ulanadi.

SERVIS: jihoz yetkazib berish, montaj va sozlash, kafolat, rejali texnik
ko'rik, chaqiruv bo'yicha chiqish (odatda 48 soat ichida), litsenziyalangan
dasturiy ta'minot, xodimlarni o'qitish.

ISH TARTIBI: 1) obyektga bepul chiqish va audit 2) loyiha va aniq smeta
3) yetkazib berish va montaj 4) sozlash, test, o'qitish 5) servis.

NARX: jihoz + montaj va sozlash + kabel/materiallar. Smetada har bir
pozitsiya alohida, kelishilgan narx shartnomada qayd etiladi, yashirin
qo'shimcha yo'q. Aniq raqam bepul auditdan keyin beriladi.

MUDDAT: kichik obyekt (bitta kirish, 8-16 kamera) — 5-10 ish kuni.
Yirik parking yoki ko'p kirishli obyekt — auditdan keyin aniqlanadi.

MIJOZLAR: chakana savdo, ishlab chiqarish, xizmat ko'rsatish, umumiy
ovqatlanish, ta'lim, biznes-markazlar, turar-joy majmualari, logistika,
tibbiyot markazlari. Viloyatlarda ham ishlaydi.

ALOQA: telefon +998 50 797-97-79 · Telegram @softdata ·
email info@softdata.uz · manzil: Toshkent, Yunusobod tumani,
Bog'ishamol ko'chasi 235A · ish vaqti: Dushanba-Shanba 09:00-18:00.
`.trim();

const SYSTEM = `Sen SoftData kompaniyasining sayti (softdata.uz) uchun AI yordamchisisan.

QOIDALAR:
- Faqat quyidagi ma'lumotga tayanib javob ber. Ma'lumotda yo'q narsani
  o'ylab topma — bilmasang, mutaxassis bilan bog'lanishni taklif qil
  (+998 50 797-97-79).
- Aniq narx aytma. Narx tuzilishini tushuntir va bepul auditni taklif qil.
- Qisqa yoz: 2-4 gap. Texnik jargon ishlatma, oddiy tilda gapir.
- Foydalanuvchi qaysi tilda yozgan bo'lsa, o'sha tilda javob ber
  (o'zbek / rus / ingliz).
- Savol kompaniya faoliyatiga aloqasiz bo'lsa, muloyim ravishda
  mavzuga qaytar.
- Emoji ishlatma. Markdown formatlash ishlatma — oddiy matn yoz.

MA'LUMOT:
${COMPANY}`;

module.exports = async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("ANTHROPIC_API_KEY sozlanmagan");
    return res.status(500).json({ error: "not_configured" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too_many_requests" });

  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const message = String(body.message || "").trim().slice(0, 1500);
  if (!message) return res.status(400).json({ error: "empty_message" });

  // Oldingi 6 ta xabar kontekst uchun
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const messages = history
    .filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && m.text; })
    .map(function (m) {
      return { role: m.role, content: String(m.text).slice(0, 1500) };
    });
  messages.push({ role: "user", content: message });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages: messages
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic xatosi:", data);
      return res.status(502).json({ error: "upstream_failed" });
    }
    const reply = (data.content || [])
      .filter(function (b) { return b.type === "text"; })
      .map(function (b) { return b.text; })
      .join("")
      .trim();
    if (!reply) return res.status(502).json({ error: "empty_reply" });
    return res.status(200).json({ reply: reply });
  } catch (err) {
    console.error("Anthropic'ga ulanmadi:", err);
    return res.status(502).json({ error: "upstream_failed" });
  }
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
