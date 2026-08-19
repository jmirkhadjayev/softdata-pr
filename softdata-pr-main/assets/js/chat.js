/* ===========================================================
   SoftData — AI assistant widget
   Floating chat launcher + panel, trilingual (UZ/RU/EN),
   answers from a local knowledge base built out of the site's
   own content. Opens itself 5s after the first page of a visit.

   Wiring a real LLM: set window.SOFTDATA_CHAT_ENDPOINT to a URL
   that accepts {message, lang, history} and returns {reply}.
   The key must live on that endpoint, never in this file — a
   static page cannot hold an API key without publishing it.
   =========================================================== */

(function () {
  "use strict";

  var AUTO_OPEN_MS = 5000;
  var SESSION_KEY = "softdata_chat_seen";
  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function lang() {
    var l = document.documentElement.getAttribute("data-site-lang");
    return (l === "ru" || l === "en") ? l : "uz";
  }

  /* ---------- Interface copy ---------- */
  var UI = {
    uz: {
      title: "SoftData AI",
      status: "onlayn · odatda darhol javob beradi",
      launcher: "AI yordamchi bilan suhbat",
      close: "Yopish",
      send: "Yuborish",
      placeholder: "Savolingizni yozing...",
      greeting: "Salom! Men SoftData AI yordamchisiman. Parking, xavfsizlik, avtomatlashtirish va integratsiya bo'yicha savollaringizga javob beraman. Nima qiziqtiryapti?",
      chips: ["Narx qanday?", "Parking qanday ishlaydi?", "Qancha vaqt oladi?", "Bog'lanish"],
      handoff: "Jonli mutaxassis bilan gaplashish"
    },
    ru: {
      title: "SoftData AI",
      status: "онлайн · обычно отвечает сразу",
      launcher: "Чат с AI-помощником",
      close: "Закрыть",
      send: "Отправить",
      placeholder: "Напишите ваш вопрос...",
      greeting: "Здравствуйте! Я AI-помощник SoftData. Отвечу на вопросы по паркингу, безопасности, автоматизации и интеграции. Что вас интересует?",
      chips: ["Сколько стоит?", "Как работает паркинг?", "Сколько занимает?", "Связаться"],
      handoff: "Связаться с живым специалистом"
    },
    en: {
      title: "SoftData AI",
      status: "online · usually replies instantly",
      launcher: "Chat with the AI assistant",
      close: "Close",
      send: "Send",
      placeholder: "Type your question...",
      greeting: "Hi! I'm the SoftData AI assistant. I can answer questions about parking, security, automation and integration. What would you like to know?",
      chips: ["How much does it cost?", "How does parking work?", "How long does it take?", "Contact"],
      handoff: "Talk to a human specialist"
    }
  };

  /* ---------- Knowledge base ----------
     Keywords are pooled across all three languages, so a Russian
     question still resolves while the interface is in English. */
  var KB = [
    {
      kw: ["salom", "assalom", "hello", "hi", "hey", "привет", "здравствуй", "здравствуйте", "добрый"],
      a: {
        uz: "Salom! Obyektingiz haqida qisqacha aytsangiz — qaysi yechim mos kelishini aytaman.",
        ru: "Здравствуйте! Расскажите коротко о вашем объекте — подскажу, какое решение подойдёт.",
        en: "Hello! Tell me briefly about your site and I'll suggest which solution fits."
      }
    },
    {
      kw: ["narx", "qancha turadi", "qimmat", "byudjet", "smeta", "цена", "стоимость", "сколько стоит", "бюджет", "смета", "price", "cost", "budget", "quote", "how much"],
      a: {
        uz: "Narx uch qismdan iborat: jihoz + montaj va sozlash + kabel/materiallar. Smetada har bir pozitsiya alohida ko'rsatiladi va kelishilgan narx shartnomada qayd etiladi — jarayonda yashirin qo'shimcha chiqmaydi. Aniq raqam obyektga bepul chiqib, auditdan keyin beriladi.",
        ru: "Цена состоит из трёх частей: оборудование + монтаж и настройка + кабель и материалы. В смете каждая позиция указана отдельно, согласованная цена фиксируется в договоре — скрытых доплат не появляется. Точная сумма — после бесплатного выезда и аудита.",
        en: "The price has three parts: equipment + installation and setup + cable and materials. Every line is itemised in the quote and the agreed price is fixed in the contract — no hidden extras. The exact figure comes after a free site visit and audit."
      }
    },
    {
      kw: ["qancha vaqt", "muddat", "necha kun", "tayyor bo'ladi", "срок", "сколько времени", "как долго", "когда будет", "how long", "timeline", "deadline", "lead time"],
      a: {
        uz: "Kichik obyekt (bitta kirish, 8–16 kamera) odatda 5–10 ish kunida topshiriladi. Yirik parking yoki ko'p kirishli obyekt uchun muddat auditdan keyin aniqlanadi va shartnomada qayd etiladi.",
        ru: "Небольшой объект (один въезд, 8–16 камер) обычно сдаётся за 5–10 рабочих дней. По крупному паркингу или объекту с несколькими въездами срок определяется после аудита и фиксируется в договоре.",
        en: "A small site (one entrance, 8–16 cameras) is usually handed over in 5–10 working days. For a large car park or a site with several entrances the timeline is set after the audit and written into the contract."
      }
    },
    {
      kw: ["parking", "parkovka", "shlagbaum", "anpr", "raqam tanish", "avtoturargoh", "паркинг", "парковка", "шлагбаум", "номер", "барьер", "car park", "parking", "barrier", "plate", "licence plate"],
      a: {
        uz: "Avtomatik parking: shlagbaum, ANPR kameralar (davlat raqamini tanish), abonement va onlayn to'lov bitta tizimda. Mashina yaqinlashadi — kamera raqamni o'qiydi, ruxsat bo'lsa to'siq o'zi ochiladi, navbat yo'qoladi. Bo'sh joylar tablosi real vaqtda yangilanadi, hisobot avtomatik shakllanadi.",
        ru: "Автоматический паркинг: шлагбаум, ANPR-камеры (распознавание госномеров), абонементы и онлайн-оплата в одной системе. Машина подъезжает — камера считывает номер, при наличии доступа барьер открывается сам, очередь исчезает. Табло свободных мест обновляется в реальном времени, отчёт формируется автоматически.",
        en: "Automated parking: barrier, ANPR cameras (licence plate recognition), season passes and online payment in one system. A car pulls up — the camera reads the plate and, if access is granted, the barrier opens by itself, so the queue disappears. The free-space display updates in real time and reports are generated automatically."
      }
    },
    {
      kw: ["xavfsizlik", "kamera", "videokuzatuv", "cctv", "domofon", "signalizatsiya", "kirish nazorati", "turniket", "arxiv", "безопасность", "камер", "видеонаблюдение", "домофон", "сигнализация", "контроль доступа", "скуд", "турникет", "архив", "security", "camera", "surveillance", "intercom", "alarm", "access control", "turnstile"],
      a: {
        uz: "Xavfsizlik yo'nalishi: videokuzatuv (CCTV), kirish nazorati, domofon va signalizatsiya. Obyekt 24/7 nazoratda, yozuvlar arxivda saqlanadi — hodisani sana va vaqt bo'yicha bir daqiqada topasiz. Telefoningizdan istalgan joydan kuzatishingiz mumkin.",
        ru: "Направление безопасности: видеонаблюдение (CCTV), контроль доступа, домофония и сигнализация. Объект под контролем 24/7, записи хранятся в архиве — инцидент находится по дате и времени за минуту. Смотреть можно с телефона из любой точки.",
        en: "The security service covers video surveillance (CCTV), access control, intercom and alarms. Your site stays under control 24/7 and recordings are kept in the archive — any incident is found by date and time in under a minute. You can watch from your phone, anywhere."
      }
    },
    {
      kw: ["avtomatlashtirish", "avtomatizatsiya", "ish vaqti", "tabel", "hisobot", "xabarnoma", "автоматизац", "рабочего времени", "табель", "отчёт", "отчет", "уведомлен", "automation", "attendance", "timesheet", "report", "notification"],
      a: {
        uz: "Avtomatlashtirish: qo'lda bajarilayotgan ishlarni tizimga o'tkazamiz — kirish-chiqish qayd etiladi, ish vaqti o'zi hisoblanadi, hisobot va xabarnomalar (shu jumladan Telegram orqali) avtomatik jo'natiladi. Odam omili kamayadi, ma'lumot har doim bitta joyda bo'ladi.",
        ru: "Автоматизация: переводим ручные операции в систему — вход-выход фиксируется, рабочее время считается само, отчёты и уведомления (в том числе в Telegram) отправляются автоматически. Человеческий фактор снижается, данные всегда в одном месте.",
        en: "Automation: we move manual work into the system — entries and exits are logged, working time is calculated automatically, and reports and notifications (including via Telegram) are sent on their own. Human error drops and the data always lives in one place."
      }
    },
    {
      kw: ["integratsiya", "1c", "1с", "crm", "erp", "api", "webhook", "ulash", "интеграц", "подключ", "integration", "connect"],
      a: {
        uz: "Integratsiya: alohida ishlayotgan tizimlarni bir-biriga ulaymiz — 1C, CRM, to'lov servislari, kameralar, turniketlar va shlagbaumlar yagona markazdan boshqariladi. API va webhook orqali ham ishlaymiz. Mavjud jihozlaringizni almashtirish shart emas.",
        ru: "Интеграция: связываем разрозненные системы — 1С, CRM, платёжные сервисы, камеры, турникеты и шлагбаумы управляются из единого центра. Работаем через API и webhook. Менять имеющееся оборудование не обязательно.",
        en: "Integration: we connect systems that run in isolation — 1C, CRM, payment services, cameras, turnstiles and barriers are managed from a single centre. We also work over API and webhooks. You don't have to replace your existing equipment."
      }
    },
    {
      kw: ["mavjud jihoz", "eski kamera", "almashtirish", "ishlatib bo'ladi", "уже установлен", "существующ", "имеющ", "менять", "existing equipment", "already have", "reuse", "keep my"],
      a: {
        uz: "Ko'p hollarda ha — mavjud kamera va shlagbaumlaringizni yangi tizimga ulash mumkin. Auditda har bir jihozni tekshiramiz va qaysilari qoladi, qaysilari almashtirilishi kerakligini sababi bilan aytamiz. Ishlaydigan jihozni shunchaki sotish uchun almashtirishni taklif qilmaymiz.",
        ru: "В большинстве случаев да — уже установленные камеры и шлагбаумы можно подключить к новой системе. На аудите проверяем каждое устройство и объясняем, что останется, а что стоит заменить и почему. Мы не предлагаем менять работающее оборудование ради продажи.",
        en: "In most cases yes — your existing cameras and barriers can be connected to the new system. During the audit we check every device and explain what stays, what should be replaced and why. We never suggest replacing working equipment just to make a sale."
      }
    },
    {
      kw: ["kafolat", "servis", "qo'llab-quvvatlash", "texnik yordam", "buzilsa", "гарант", "сервис", "поддержк", "обслуживан", "сломает", "warranty", "support", "maintenance", "service", "breaks"],
      a: {
        uz: "Kafolat muddatida nosozliklarni bepul bartaraf etamiz. Keyin servis shartnomasi bo'yicha rejali texnik ko'rik va chaqiruv bo'yicha chiqish mavjud — servisga chiqish odatda 48 soat ichida amalga oshiriladi.",
        ru: "В течение гарантийного срока устраняем неисправности бесплатно. Далее — по договору сервисного обслуживания: плановые осмотры и выезд по вызову. Выезд сервиса обычно в течение 48 часов.",
        en: "During the warranty period we fix faults free of charge. After that a service contract covers scheduled inspections and call-out visits — a service visit normally happens within 48 hours."
      }
    },
    {
      kw: ["viloyat", "toshkentdan tashqari", "boshqa shahar", "регион", "вне ташкента", "другой город", "region", "outside tashkent", "other city"],
      a: {
        uz: "Ha, viloyatlarda ham loyihalarni amalga oshiramiz. Bunday hollarda montaj grafigi va servis shartlari alohida kelishiladi.",
        ru: "Да, реализуем проекты и в регионах. В таких случаях график монтажа и условия сервиса согласуются отдельно.",
        en: "Yes, we deliver projects in the regions as well. In those cases the installation schedule and service terms are agreed separately."
      }
    },
    {
      kw: ["bog'lan", "telefon", "raqam", "telegram", "email", "pochta", "manzil", "qayerda", "ofis", "связ", "телефон", "номер", "почта", "адрес", "где", "офис", "contact", "phone", "address", "where", "office", "reach you"],
      a: {
        uz: "Telefon: +998 50 797-97-79 · Telegram: @softdata · Email: info@softdata.uz\nManzil: Toshkent, Yunusobod tumani, Bog'ishamol ko'chasi, 235A\nIsh vaqti: Dushanba – Shanba, 09:00 – 18:00",
        ru: "Телефон: +998 50 797-97-79 · Telegram: @softdata · Email: info@softdata.uz\nАдрес: Ташкент, Юнусабадский район, ул. Богишамол, 235A\nЧасы работы: Понедельник – Суббота, 09:00 – 18:00",
        en: "Phone: +998 50 797-97-79 · Telegram: @softdata · Email: info@softdata.uz\nAddress: Tashkent, Yunusabad district, Bogishamol street 235A\nWorking hours: Monday – Saturday, 09:00 – 18:00"
      }
    },
    {
      kw: ["ish vaqti", "soat", "qachon ochiq", "dam olish", "часы работы", "во сколько", "выходной", "график работы", "working hours", "open", "opening"],
      a: {
        uz: "Ish vaqtimiz: Dushanba – Shanba, 09:00 – 18:00. Yakshanba dam olish kuni, lekin murojaatingizni istalgan vaqtda qoldirishingiz mumkin — ish kuni boshlanishi bilan javob beramiz.",
        ru: "Часы работы: Понедельник – Суббота, 09:00 – 18:00. Воскресенье выходной, но заявку можно оставить в любое время — ответим с началом рабочего дня.",
        en: "Working hours: Monday – Saturday, 09:00 – 18:00. Sunday is a day off, but you can leave a request any time — we reply when the working day starts."
      }
    },
    {
      kw: ["kim", "kompaniya", "haqingizda", "tajriba", "necha yil", "компани", "о вас", "опыт", "сколько лет", "about you", "company", "experience", "who are you"],
      a: {
        uz: "SOFT DATA — Toshkentda joylashgan IT kompaniya. To'rtta yo'nalishda ishlaymiz: Automation, Security, Parking va Integration — loyihadan montajgacha, sozlashdan servisgacha hammasi bitta jamoada. Alohida pudratchilarni qidirishingiz shart emas.",
        ru: "SOFT DATA — IT-компания в Ташкенте. Работаем по четырём направлениям: Automation, Security, Parking и Integration — от проекта до монтажа, от настройки до сервиса всё в одной команде. Не нужно искать отдельных подрядчиков.",
        en: "SOFT DATA is an IT company based in Tashkent. We work across four services — Automation, Security, Parking and Integration — from design to installation and from setup to service, all in one team. No need to chase separate contractors."
      }
    },
    {
      kw: ["loyiha", "misol", "keys", "portfolio", "kim bilan ishlagansiz", "проект", "пример", "кейс", "портфолио", "project", "case", "example", "portfolio"],
      a: {
        uz: "Amalga oshirilgan loyihalarimiz orasida: savdo markazi uchun avtomatik parking, ishlab chiqarishda 64 kamerali videokuzatuv, biznes-markazda kirish nazorati va ish vaqti hisobi, logistika markazida 1C integratsiyasi, turar-joy majmuasida domofon. Batafsil — \"Loyihalar\" sahifasida.",
        ru: "Среди реализованных проектов: автоматический паркинг для торгового центра, видеонаблюдение на 64 камеры на производстве, СКУД и учёт рабочего времени в бизнес-центре, интеграция с 1С в логистическом центре, домофония в жилом комплексе. Подробнее — на странице «Проекты».",
        en: "Delivered projects include automated parking for a shopping centre, a 64-camera surveillance system at a factory, access control and time tracking in a business centre, 1C integration at a logistics hub, and intercom in a residential complex. See the Projects page for details."
      }
    },
    {
      kw: ["konsultatsiya", "audit", "chiqib ko'ring", "bepul", "uchrashuv", "консультац", "аудит", "выезд", "бесплатн", "встреч", "consultation", "audit", "site visit", "free", "meeting"],
      a: {
        uz: "Obyektga chiqish va audit — bepul va majburiyatsiz. Mutaxassis kirish nuqtalarini, mavjud jihozlarni va kabel yo'llarini ko'radi, so'ng nima kerakligini va qancha turishini aniq aytadi. Telefon: +998 50 797-97-79 yoki \"Aloqa\" sahifasidagi forma.",
        ru: "Выезд на объект и аудит — бесплатно и без обязательств. Специалист осмотрит точки входа, имеющееся оборудование и трассы кабеля, затем точно скажет, что нужно и сколько это стоит. Телефон: +998 50 797-97-79 или форма на странице «Контакты».",
        en: "The site visit and audit are free and come with no obligation. A specialist inspects the entry points, existing equipment and cable routes, then tells you exactly what is needed and what it costs. Call +998 50 797-97-79 or use the form on the Contact page."
      }
    },
    {
      kw: ["rahmat", "raxmat", "spasibo", "спасибо", "благодар", "thanks", "thank you", "cheers"],
      a: {
        uz: "Arzimaydi! Yana savol bo'lsa — shu yerdaman.",
        ru: "Пожалуйста! Если появятся вопросы — я здесь.",
        en: "You're welcome! If anything else comes up, I'm right here."
      }
    }
  ];

  var FALLBACK = {
    uz: "Bu savolga aniq javob berish uchun obyektingiz haqida biroz ko'proq ma'lumot kerak. Parking, xavfsizlik, avtomatlashtirish, integratsiya, narx yoki muddat haqida so'rashingiz mumkin — yoki darhol mutaxassis bilan bog'laning: +998 50 797-97-79.",
    ru: "Чтобы ответить точно, нужно чуть больше деталей по вашему объекту. Можно спросить про паркинг, безопасность, автоматизацию, интеграцию, цену или сроки — либо сразу связаться со специалистом: +998 50 797-97-79.",
    en: "To answer that precisely I'd need a bit more detail about your site. You can ask about parking, security, automation, integration, price or timelines — or reach a specialist directly on +998 50 797-97-79."
  };

  /* ---------- Matching ---------- */
  function normalize(s) {
    return " " + s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim() + " ";
  }
  function findAnswer(text) {
    var q = normalize(text), best = null, bestScore = 0;
    KB.forEach(function (item) {
      var score = 0;
      item.kw.forEach(function (k) {
        if (q.indexOf(k) !== -1) score += k.length;   // longer hits outrank incidental ones
      });
      if (score > bestScore) { bestScore = score; best = item; }
    });
    return best ? best.a[lang()] : FALLBACK[lang()];
  }

  /* ---------- DOM ---------- */
  var root, panel, launcher, list, input, form, chipsBox, titleEl, statusEl, sendBtn, closeBtn, badge;
  var opened = false, autoTimer = null;
  var history = [];   // backend ulanganda modelga kontekst sifatida beriladi

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function build() {
    root = el("div", "chat-widget");

    launcher = el("button", "chat-launcher");
    launcher.type = "button";
    // Inline SVG rather than styled spans: the glyph keeps its exact geometry
    // no matter what the surrounding layout does to it.
    launcher.innerHTML =
      '<svg class="chat-launcher-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">' +
        '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9.6L5.4 20v-3.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" ' +
          'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
        '<circle class="cl-dot" cx="8"  cy="11" r="1.35" fill="currentColor"/>' +
        '<circle class="cl-dot" cx="12" cy="11" r="1.35" fill="currentColor"/>' +
        '<circle class="cl-dot" cx="16" cy="11" r="1.35" fill="currentColor"/>' +
      '</svg>';
    badge = el("span", "chat-badge");
    badge.setAttribute("aria-hidden", "true");
    launcher.appendChild(badge);

    panel = el("div", "chat-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");

    var head = el("div", "chat-head");
    var avatar = el("span", "chat-avatar");
    avatar.innerHTML = '<span class="ca-core"></span>';
    var headText = el("div", "chat-head-text");
    titleEl = el("span", "chat-title");
    statusEl = el("span", "chat-status");
    headText.appendChild(titleEl);
    headText.appendChild(statusEl);
    closeBtn = el("button", "chat-close");
    closeBtn.type = "button";
    closeBtn.innerHTML = "&#10005;";
    head.appendChild(avatar);
    head.appendChild(headText);
    head.appendChild(closeBtn);

    list = el("div", "chat-list");
    list.setAttribute("data-lenis-prevent", "");   // let the transcript scroll under Lenis
    list.setAttribute("role", "log");
    list.setAttribute("aria-live", "polite");

    chipsBox = el("div", "chat-chips");

    form = el("form", "chat-form");
    input = el("input", "chat-input");
    input.type = "text";
    input.autocomplete = "off";
    sendBtn = el("button", "chat-send");
    sendBtn.type = "submit";
    sendBtn.innerHTML = "&#8594;";
    form.appendChild(input);
    form.appendChild(sendBtn);

    panel.appendChild(head);
    panel.appendChild(list);
    panel.appendChild(chipsBox);
    panel.appendChild(form);

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);
  }

  function bubble(role, text) {
    var row = el("div", "chat-msg chat-msg-" + role);
    var b = el("div", "chat-bubble");
    // answers may carry line breaks (contact block); keep them without innerHTML
    text.split("\n").forEach(function (line, i) {
      if (i) b.appendChild(document.createElement("br"));
      b.appendChild(document.createTextNode(line));
    });
    row.appendChild(b);
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
    return row;
  }

  function typing() {
    var row = el("div", "chat-msg chat-msg-bot chat-typing");
    row.innerHTML = '<div class="chat-bubble"><span></span><span></span><span></span></div>';
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
    return row;
  }

  function renderChips() {
    chipsBox.innerHTML = "";
    UI[lang()].chips.forEach(function (label) {
      var c = el("button", "chat-chip", label);
      c.type = "button";
      c.addEventListener("click", function () { submit(label); });
      chipsBox.appendChild(c);
    });
  }

  function renderChrome() {
    var t = UI[lang()];
    titleEl.textContent = t.title;
    statusEl.textContent = t.status;
    input.placeholder = t.placeholder;
    launcher.setAttribute("aria-label", t.launcher);
    launcher.title = t.launcher;
    closeBtn.setAttribute("aria-label", t.close);
    sendBtn.setAttribute("aria-label", t.send);
    panel.setAttribute("aria-label", t.title);
    renderChips();
    // Nothing said yet? Then the greeting can follow the new language too.
    if (list.children.length === 1) {
      list.innerHTML = "";
      bubble("bot", t.greeting);
    }
  }

  /* ---------- Reply ---------- */
  function respond(text) {
    var wait = reducedMotion ? 120 : 520 + Math.min(text.length * 8, 700);
    var ind = typing();
    var endpoint = (window.SOFTDATA_API && window.SOFTDATA_API.chat) ||
                   window.SOFTDATA_CHAT_ENDPOINT;

    function finish(answer) {
      if (ind.parentNode) ind.parentNode.removeChild(ind);
      bubble("bot", answer);
      history.push({ role: "assistant", text: answer });
      if (history.length > 12) history = history.slice(-12);
    }

    if (endpoint) {
      // Backend ulangan: model javob beradi, uzilsa ichki bazaga qaytamiz
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          lang: lang(),
          history: history.slice(0, -1)   // oxirgisi — hozirgi savol
        })
      })
        .then(function (r) {
          if (!r.ok) throw new Error("http");
          return r.json();
        })
        .then(function (d) { finish((d && d.reply) || findAnswer(text)); })
        .catch(function () { finish(findAnswer(text)); });
      return;
    }
    setTimeout(function () { finish(findAnswer(text)); }, wait);
  }

  function submit(text) {
    text = (text || "").trim();
    if (!text) return;
    bubble("user", text);
    history.push({ role: "user", text: text });
    input.value = "";
    respond(text);
  }

  /* ---------- Open / close ---------- */
  function open(auto) {
    if (opened) return;
    opened = true;
    clearTimeout(autoTimer);
    root.classList.add("is-open");
    badge.classList.remove("is-on");
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
    if (!list.children.length) bubble("bot", UI[lang()].greeting);
    // Auto-opening must not steal the caret from whatever the visitor is doing.
    if (!auto && window.innerWidth > 720) input.focus();
  }
  function close() {
    opened = false;
    root.classList.remove("is-open");
    clearTimeout(autoTimer);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  }

  function init() {
    build();
    renderChrome();

    launcher.addEventListener("click", function () { opened ? close() : open(false); });
    closeBtn.addEventListener("click", close);
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(input.value); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && opened) close();
    });
    // Any element can summon the assistant, e.g. the hero button.
    document.querySelectorAll("[data-chat-open]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); open(false); });
    });

    // Keep the widget in step with the site language switcher.
    new MutationObserver(renderChrome).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-site-lang"]
    });

    var seen;
    try { seen = sessionStorage.getItem(SESSION_KEY); } catch (e) { seen = null; }
    if (!seen) {
      autoTimer = setTimeout(function () {
        badge.classList.add("is-on");
        open(true);
      }, AUTO_OPEN_MS);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
