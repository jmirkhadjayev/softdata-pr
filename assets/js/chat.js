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
      greeting: "Salom! Men SoftData intellektual yordamchisiman. Avtomatlashtirish, xavfsizlik, parking va tizim integratsiyasi bo'yicha savollaringizga mamnuniyat bilan javob beraman. Nima haqida ma'lumot olishni xohlaysiz?",
      chips: ["Xizmatlar narxi qanday?", "Parking tizimi qanday ishlaydi?", "Loyiha qancha vaqt oladi?", "Bog'lanish"],
      handoff: "Mutaxassis bilan bog'lanish"
    },
    ru: {
      title: "SoftData AI",
      status: "онлайн · обычно отвечает сразу",
      launcher: "Чат с AI-помощником",
      close: "Закрыть",
      send: "Отправить",
      placeholder: "Напишите ваш вопрос...",
      greeting: "Здравствуйте! Я виртуальный помощник SoftData. Отвечу на любые вопросы по автоматизации, безопасности, паркингу и системной интеграции. Что вас интересует?",
      chips: ["Сколько стоят услуги?", "Как работает паркинг?", "Сколько занимает проект?", "Контакты"],
      handoff: "Связаться со специалистом"
    },
    en: {
      title: "SoftData AI",
      status: "online · usually replies instantly",
      launcher: "Chat with AI assistant",
      close: "Close",
      send: "Send",
      placeholder: "Type your question...",
      greeting: "Hello! I'm the SoftData AI assistant. I can answer questions about automation, security, smart parking, and system integration. How can I help you today?",
      chips: ["How much does it cost?", "How does parking work?", "How long does a project take?", "Get in touch"],
      handoff: "Talk to a specialist"
    }
  };

  /* ---------- Knowledge base ----------
     Keywords are pooled across all three languages, so a Russian
     question still resolves while the interface is in English. */
  var KB = [
    {
      kw: ["salom", "assalom", "hello", "hi", "hey", "привет", "здравствуй", "здравствуйте", "добрый"],
      a: {
        uz: "Assalomu alaykum! Obyektingiz va ehtiyojlaringiz haqida qisqacha ma'lumot bersangiz — eng maqbul texnologik yechimni tavsiya qilaman.",
        ru: "Здравствуйте! Расскажите вкратце о вашем объекте и задачах — я подскажу, какое решение подойдёт наилучшим образом.",
        en: "Hello! Tell me briefly about your site and requirements, and I'll recommend the most effective solution."
      }
    },
    {
      kw: ["narx", "qancha turadi", "qimmat", "byudjet", "smeta", "цена", "стоимость", "сколько стоит", "бюджет", "смета", "price", "cost", "budget", "quote", "how much"],
      a: {
        uz: "Loyiha narxi uch qismdan shakllanadi: uskunalar + montaj va sozlash + kabel va sarflovchi materiallar. Smetada har bir pozitsiya shaffof tarzda ko'rsatiladi va kelishilgan summa shartnomada mustahkamlanadi — ish davomida yashirin to'lovlar chiqmaydi. Aniq narx esa mutaxassisimizning bepul joyiga chiqib o'tkazadigan auditidan so'ng taqdim etiladi.",
        ru: "Стоимость проекта складывается из трёх составляющих: оборудование + монтаж и настройка + кабель и расходные материалы. В смете каждая позиция детально прописана, а согласованная цена фиксируется в договоре — без скрытых доплат. Точный расчёт формируется после бесплатного выезда специалиста и аудита объекта.",
        en: "The project price consists of three parts: hardware + installation and configuration + cabling and consumables. Every item is transparently detailed in the quote and fixed in the contract — with no hidden surprises. The exact calculation is provided following a complimentary on-site audit."
      }
    },
    {
      kw: ["qancha vaqt", "muddat", "necha kun", "tayyor bo'ladi", "срок", "сколько времени", "как долго", "когда будет", "how long", "timeline", "deadline", "lead time"],
      a: {
        uz: "Kichik obyektlar (bitta kirish nuqtasi, 8–16 kamera) odatda 5–10 ish kuni ichida to'liq ishga tushiriladi. Katta avtoturargohlar yoki ko'p kirishli murakkab majmualar uchun muddat auditdan so'ng belgilanadi va shartnomada qat'iy qayd etiladi.",
        ru: "Небольшие объекты (один въезд, 8–16 камер) обычно сдаются под ключ за 5–10 рабочих дней. Для крупных паркингов или распределённых объектов точный график определяется после аудита и закрепляется в договоре.",
        en: "Standard sites (one entry lane, 8–16 cameras) are typically delivered within 5–10 business days. For larger car parks or multi-entrance facilities, a timeline is defined after the on-site audit and set firmly in the contract."
      }
    },
    {
      kw: ["parking", "parkovka", "shlagbaum", "anpr", "raqam tanish", "avtoturargoh", "паркинг", "парковка", "шлагбаум", "номер", "барьер", "car park", "parking", "barrier", "plate", "licence plate"],
      a: {
        uz: "Avtomatik parking tizimi: tezyurar shlagbaumlar, ANPR intellektual kameralari (davlat raqamlarini tanish), abonementlar va onlayn to'lov yagona dasturda ishlaydi. Avtomobil yaqinlashganda — kamera raqamni bir zumda aniqlaydi va ruxsat bo'lsa to'siq avtomatik ochiladi. Bo'sh joylar tablosi esa real vaqtda yangilanadi.",
        ru: "Автоматический паркинг: скоростные шлагбаумы, ANPR-камеры (распознавание госномеров), абонементы и онлайн-оплата в единой платформе. Автомобиль подъезжает — камера мгновенно считывает номер, шлагбаум открывается автоматически. Табло свободных мест обновляется в реальном времени.",
        en: "Automated parking: high-speed barriers, ANPR cameras (automatic number plate recognition), season passes, and digital payments in a unified platform. As a vehicle approaches, the camera reads the plate instantly, and the barrier lifts automatically. Real-time capacity displays update continuously."
      }
    },
    {
      kw: ["xavfsizlik", "kamera", "videokuzatuv", "cctv", "domofon", "signalizatsiya", "kirish nazorati", "turniket", "arxiv", "безопасность", "камер", "видеонаблюдение", "домофон", "сигнализация", "контроль доступа", "скуд", "турникет", "архив", "security", "camera", "surveillance", "intercom", "alarm", "access control", "turnstile"],
      a: {
        uz: "Xavfsizlik tizimlari: videokuzatuv (CCTV), kirish nazorati (ACS), domofoniya va signalizatsiya. Obyektingiz 24/7 ishonchli nazorat ostida bo'ladi, video yozuvlar xavfsiz arxivda saqlanadi — kerakli hodisani sana va vaqt bo'yicha bir daqiqada topish mumkin. Smartfon orqali masofadan to'g'ridan-to'g'ri kuzatuv mavjud.",
        ru: "Системы безопасности: видеонаблюдение (CCTV), контроль доступа (СКУД), домофония и сигнализация. Объект находится под защитой 24/7, записи хранятся в защищённом архиве — любой инцидент находится по времени за минуту. Доступен онлайн-просмотр со смартфона из любой точки.",
        en: "Security systems: video surveillance (CCTV), access control (ACS), intercom, and alarms. Your facility is protected 24/7, with recordings stored in a secure archive — any incident can be traced in seconds. Live streams can be accessed anytime from your mobile device."
      }
    },
    {
      kw: ["avtomatlashtirish", "avtomatizatsiya", "ish vaqti", "tabel", "hisobot", "xabarnoma", "автоматизац", "рабочего времени", "табель", "отчёт", "отчет", "уведомлен", "automation", "attendance", "timesheet", "report", "notification"],
      a: {
        uz: "Jarayonlarni avtomatlashtirish: qo'lda bajariladigan muntazam ishlarni tizimga o'tkazamiz — xodimlarning kirish-chiqishi qayd etiladi, ish vaqti hisobi tabeli avtomatik yuritiladi, hisobot va xabarnomalar (shu jumladan Telegram orqali) o'z vaqtida jo'natiladi. Inson omili minimallashtiriladi.",
        ru: "Автоматизация процессов: рутинные операции переводятся в цифровую систему — фиксация проходов, автоматический табель рабочего времени, моментальные отчёты и уведомления (включая Telegram). Человеческий фактор сводится к минимуму.",
        en: "Process automation: routine tasks are transitioned into automated workflows — entry and exit logging, automatic attendance timesheets, and instant reports and alerts (including via Telegram). Human error is virtually eliminated."
      }
    },
    {
      kw: ["integratsiya", "1c", "1с", "crm", "erp", "api", "webhook", "ulash", "интеграц", "подключ", "integration", "connect"],
      a: {
        uz: "Tizimlar integratsiyasi: alohida ishlayotgan dasturlarni yagona ekotizimga birlashtiramiz — 1C, CRM, to'lov xizmatlari, kameralar, turniketlar va shlagbaumlar yagona markazdan boshqariladi. API va Webhook orqali ulanadi. Mavjud uskunalaringizni almashtirish shart emas.",
        ru: "Системная интеграция: связываем независимые сервисы в единую экосистему — 1С, CRM, платёжные шлюзы, камеры, турникеты и шлагбаумы управляются из общего центра через API и Webhook. Менять текущее оборудование не требуется.",
        en: "System integration: we connect isolated tools into a unified ecosystem — 1C, CRM, payment systems, cameras, turnstiles, and barriers managed from a single central console via API and Webhooks. Existing equipment can usually be retained."
      }
    },
    {
      kw: ["mavjud jihoz", "eski kamera", "almashtirish", "ishlatib bo'ladi", "уже установлен", "существующ", "имеющ", "менять", "existing equipment", "already have", "reuse", "keep my"],
      a: {
        uz: "Aksariyat hollarda ha — mavjud kamera va shlagbaumlaringizni yangi tizimga ulash mumkin. Auditda har bir uskunani tekshiramiz va qaysi jihozlar tizimga to'g'ri kelishi, qaysilarini yangilash kerakligini asoslab beramiz. Ishlab turgan sifatli uskunani behuda almashtirishni taklif qilmaymiz.",
        ru: "В большинстве случаев да — уже установленные камеры и шлагбаумы можно интегрировать в новую систему. При аудите мы проверяем каждое устройство и объясняем, что можно сохранить, а что стоит обновить. Мы не навязываем замену исправного оборудования.",
        en: "In most cases, yes — your existing cameras and barriers can be integrated into the new system. During the audit, we inspect all devices and advise on what can be kept and what requires upgrading. We never recommend replacing working equipment unnecessarily."
      }
    },
    {
      kw: ["kafolat", "servis", "qo'llab-quvvatlash", "texnik yordam", "buzilsa", "гарант", "сервис", "поддержк", "обслуживан", "сломает", "warranty", "support", "maintenance", "service", "breaks"],
      a: {
        uz: "Rasmiy kafolat muddatida har qanday texnik nosozliklar bepul bartaraf etiladi. Shuningdek, servis shartnomasi bo'yicha rejali profilaktik ko'rik va tezkor chaqiruv xizmati mavjud — mutaxassislarimiz chaqiruv bo'yicha 48 soat ichida yetib borishadi.",
        ru: "В течение гарантийного срока любые неисправности устраняются бесплатно. Также доступно сервисное обслуживание: регулярные профилактические осмотры и оперативный выезд — обычно в течение 48 часов.",
        en: "During the warranty period, all hardware and software faults are resolved free of charge. We also provide ongoing maintenance contracts with scheduled preventive check-ups and prompt call-out service — typically within 48 hours."
      }
    },
    {
      kw: ["viloyat", "toshkentdan tashqari", "boshqa shahar", "регион", "вне ташкента", "другой город", "region", "outside tashkent", "other city"],
      a: {
        uz: "Ha, O'zbekistonning barcha viloyatlarida loyihalarni amalga oshiramiz. Bunday hollarda montaj jadvali, yetkazib berish va servis shartlari mijoz bilan alohida kelishib olinadi.",
        ru: "Да, мы успешно реализуем проекты во всех регионах Узбекистана. График поставки, монтажа и условия сервиса согласуются индивидуально.",
        en: "Yes, we deliver and support projects across all regions of Uzbekistan. Installation schedules, logistics, and service terms are coordinated individually."
      }
    },
    {
      kw: ["bog'lan", "telefon", "raqam", "telegram", "email", "pochta", "manzil", "qayerda", "ofis", "связ", "телефон", "номер", "почта", "адрес", "где", "офис", "contact", "phone", "address", "where", "office", "reach you"],
      a: {
        uz: "Telefon: +998 50 797-97-79 · Telegram: @softdata · Email: info@softdata.uz\nManzil: Toshkent shahri, Yunusobod tumani, Bog'ishamol ko'chasi, 235A\nIsh vaqti: Dushanba – Shanba, 09:00 – 18:00",
        ru: "Телефон: +998 50 797-97-79 · Telegram: @softdata · Email: info@softdata.uz\nАдрес: г. Ташкент, Юнусабадский район, ул. Богишамол, 235A\nЧасы работы: Понедельник – Суббота, 09:00 – 18:00",
        en: "Phone: +998 50 797-97-79 · Telegram: @softdata · Email: info@softdata.uz\nAddress: Tashkent, Yunusabad district, Bogishamol street 235A\nWorking hours: Monday – Saturday, 09:00 – 18:00"
      }
    },
    {
      kw: ["ish vaqti", "soat", "qachon ochiq", "dam olish", "часы работы", "во сколько", "выходной", "график работы", "working hours", "open", "opening"],
      a: {
        uz: "Ish vaqtimiz: Dushanba – Shanba, 09:00 – 18:00. Yakshanba dam olish kuni bo'lishiga qaramay, murojaatingizni saytda istalgan payt qoldirishingiz mumkin — ish kuni boshlanishi bilanoq siz bilan bog'lanamiz.",
        ru: "График работы: Понедельник – Суббота, 09:00 – 18:00. Воскресенье — выходной, но вы можете оставить заявку в любое время — мы свяжемся с вами в начале рабочего дня.",
        en: "Our working hours: Monday – Saturday, 09:00 – 18:00. Sunday is a day off, but you can leave your request anytime — we will get in touch first thing on the next business day."
      }
    },
    {
      kw: ["kim", "kompaniya", "haqingizda", "tajriba", "necha yil", "компани", "о вас", "опыт", "сколько лет", "about you", "company", "experience", "who are you"],
      a: {
        uz: "SoftData — Toshkentda joylashgan yetakchi IT-kompaniya. To'rtta asosiy yo'nalishda ishlaymiz: Automation, Security, Parking va Integration — loyihalashdan montajgacha, sozlashdan texnik xizmat ko'rsatishgacha to'liq bitta jamoa tomonidan amalga oshiriladi.",
        ru: "SoftData — IT-компания в Ташкенте. Мы специализируемся на 4 ключевых направлениях: Automation, Security, Parking и Integration — от проектирования до монтажа, от настройки до сервиса всё выполняется одной командой.",
        en: "SoftData is a Tashkent-based IT company specializing in four core domains: Automation, Security, Parking, and Integration. From engineering design to hardware installation, setup, and long-term support, everything is delivered by our unified team."
      }
    },
    {
      kw: ["loyiha", "misol", "keys", "portfolio", "kim bilan ishlagansiz", "проект", "пример", "кейс", "портфолио", "project", "case", "example", "portfolio"],
      a: {
        uz: "Amalga oshirilgan loyihalarimiz qatorida: savdo markazlari uchun to'liq avtomatlashtirilgan parking, sanoat korxonalarida 64 kamerali videokuzatuv tizimlari, biznes-markazlarda biometrik kirish nazorati va ish vaqti hisobi, logistika markazlarida 1C integratsiyasi hamda turar-joy majmualarida IP-domofoniya. Batafsil ma'lumotni \"Loyihalar\" sahifasida ko'rishingiz mumkin.",
        ru: "Среди наших кейсов: автоматический паркинг для ТЦ, система видеонаблюдения на 64 камеры на заводе, СКУД и учёт рабочего времени в бизнес-центрах, интеграция с 1С на логистических узлах и IP-домофония в жилых комплексах. Подробнее — в разделе «Проекты».",
        en: "Our delivered projects include automated parking for shopping malls, 64-camera surveillance systems for factories, biometric access control and attendance in business centres, 1C logistics integration, and IP intercoms in residential complexes. Explore our Projects page for details."
      }
    },
    {
      kw: ["konsultatsiya", "audit", "chiqib ko'ring", "bepul", "uchrashuv", "консультац", "аудит", "выезд", "бесплатн", "встреч", "consultation", "audit", "site visit", "free", "meeting"],
      a: {
        uz: "Obyektga chiqish va dastlabki audit — mutlaqo bepul va hech qanday majburiyatsiz. Mutaxassisimiz kirish nuqtalarini, mavjud uskunalarni va kabel yo'llarini joyida o'rganib, aniq yechim va smeta taqdim etadi. Telefon: +998 50 797-97-79 yoki \"Aloqa\" sahifasidagi forma orqali murojaat qiling.",
        ru: "Выезд на объект и первичный аудит — абсолютно бесплатны и ни к чему вас не обязывают. Наш специалист осмотрит точки входа, оборудование и кабельные трассы, после чего рассчитает точную смету. Телефон: +998 50 797-97-79 или форма на странице «Контакты».",
        en: "Our initial on-site visit and audit are completely free and carry no obligation. A specialist inspects entryways, existing hardware, and cabling routes, then provides a clear solution and firm quote. Call +998 50 797-97-79 or submit a request on our Contact page."
      }
    },
    {
      kw: ["rahmat", "raxmat", "spasibo", "спасибо", "благодар", "thanks", "thank you", "cheers"],
      a: {
        uz: "Arzimaydi! Yana qandaydir savollaringiz bo'lsa, har doim yordam berishga tayyorman.",
        ru: "Пожалуйста! Если возникнут ещё вопросы, я всегда на связи и готов помочь.",
        en: "You're very welcome! If you have any other questions, I'm always here to help."
      }
    }
  ];

  var FALLBACK = {
    uz: "Ushbu savolga eng to'g'ri va to'liq javob berish uchun obyektingiz bo'yicha biroz ko'proq ma'lumot kerak bo'ladi. Parking, xavfsizlik, avtomatlashtirish, integratsiya, narxlar yoki muddatlar haqida so'rashingiz mumkin — yoki darhol mutaxassisimiz bilan bog'laning: +998 50 797-97-79.",
    ru: "Чтобы дать максимально точный ответ, мне нужно немного больше деталей по вашему объекту. Вы можете задать вопрос о паркинге, безопасности, автоматизации, интеграции, ценах или сроках — либо сразу позвонить нашему специалисту: +998 50 797-97-79.",
    en: "To give you the most accurate answer, I'd need a few more details about your site. You can ask about smart parking, security, process automation, system integration, pricing, or timelines — or speak directly with our team at +998 50 797-97-79."
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
