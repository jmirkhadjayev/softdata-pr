# Backend'ni ulash

Sayt backendsiz ham ishlaydi. Backend ulansa ikki narsa yaxshilanadi:

| | Backendsiz (hozir) | Backend bilan |
|---|---|---|
| **Aloqa formasi** | Pochta ilovasi ochiladi, mijoz xatni o'zi yuboradi | Murojaat Telegramga darhol tushadi |
| **AI chat** | Ichki bilimlar bazasidan javob beradi | Claude modeli erkin savollarga javob beradi |

Kalitlar hech qachon brauzerga tushmaydi — faqat Vercel'ning environment
o'zgaruvchilarida turadi.

---

## 1. Telegram bot (forma uchun)

1. Telegramda **@BotFather** ni oching → `/newbot` → nom va username bering
   → sizga **token** beradi (`123456:AAE...` ko'rinishida).
2. Yangi botingizga Telegramdan **istalgan xabar yozing** (bot sizga birinchi
   bo'lib yoza olmaydi — avval siz yozishingiz shart).
3. Chat ID ni oling — brauzerda oching:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   Javobda `"chat":{"id":123456789` — o'sha raqam **chat ID**.

> Murojaatlar guruhga tushishini xohlasangiz: botni guruhga qo'shing, guruhga
> xabar yozing va o'sha `getUpdates` dan guruhning ID sini oling (manfiy raqam).

## 2. Claude API kaliti (AI chat uchun)

1. https://console.anthropic.com → **API Keys** → Create key.
2. Kalitni nusxalang (`sk-ant-...`). Bir marta ko'rsatiladi.

Chat uchun kalit ixtiyoriy — ulanmasa chat ichki bazadan javob beradi.

## 3. Vercel'ga deploy

1. https://vercel.com → GitHub bilan kiring → **Add New → Project** →
   `softdatauz` repozitoriysini tanlang → **Deploy**.
   Vercel `api/` papkasini avtomatik funksiya sifatida ishga tushiradi.
2. **Settings → Environment Variables** ga qo'shing:

   | Nom | Qiymat |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | BotFather bergan token |
   | `TELEGRAM_CHAT_ID` | 1-bosqichda olingan raqam |
   | `ANTHROPIC_API_KEY` | Claude kaliti (ixtiyoriy) |
   | `ALLOWED_ORIGIN` | `https://jmirkhadjayev.github.io` (ixtiyoriy, xavfsizroq) |

3. **Redeploy** bosing — o'zgaruvchilar faqat yangi deploy'da kuchga kiradi.

## 4. Manzillarni saytga yozish

`assets/js/config.js` faylini oching va Vercel bergan domenni qo'ying:

```js
window.SOFTDATA_API = {
  form: "https://SIZNING-LOYIHA.vercel.app/api/form",
  chat: "https://SIZNING-LOYIHA.vercel.app/api/chat"
};
```

Commit qilib push qiling — tayyor.

## 5. Tekshirish

```bash
curl -X POST https://SIZNING-LOYIHA.vercel.app/api/form \
  -H "Content-Type: application/json" \
  -d '{"name":"Sinov","phone":"+998901234567","message":"tekshiruv"}'
```

`{"ok":true}` qaytsa va Telegramga xabar tushsa — ishlayapti.

---

## Himoya choralari

- **Honeypot** — formada odam ko'rmaydigan `company` maydoni bor. Bot uni
  to'ldirsa, murojaat jimgina tashlab yuboriladi.
- **Rate limit** — bitta IP dan daqiqasiga 5 ta murojaat, 15 ta chat so'rovi.
- **Validatsiya** — ism va telefon majburiy, telefonda kamida 7 ta raqam,
  matn 2000 belgigacha kesiladi.
- **HTML escaping** — Telegram xabariga inyeksiya qilib bo'lmaydi.
- **`ALLOWED_ORIGIN`** — o'rnatilsa, endpoint faqat sizning saytingizdan
  chaqiriladi.

## Xarajat

Ikkalasi ham Vercel'ning bepul tarifiga bemalol sig'adi. Claude API — har
1000 ta chat javobiga taxminan bir necha dollar (`api/chat.js` dagi `MODEL`
ni `claude-haiku-4-5-20251001` ga o'zgartirsangiz sezilarli arzonlashadi).
