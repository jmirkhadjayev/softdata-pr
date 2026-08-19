/* ===========================================================
   SoftData — site engine
   Animated dark background (video + particle network) +
   Lenis smooth scroll + GSAP ScrollTrigger reveals +
   typing-cursor signature effect + i18n (UZ/RU/EN) + nav/faq/filter
   =========================================================== */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Language (UZ / RU / EN) ---------- */
  var LANG_KEY = "softdata_lang";
  var LANGS = ["uz", "ru", "en"];

  function getStoredLang() {
    var stored;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { return null; }
    return LANGS.indexOf(stored) !== -1 ? stored : null;
  }
  function storeLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  }
  // Inputs carry their copy in attributes rather than [data-lang] siblings,
  // so the placeholder has to be swapped by hand on every language change.
  function applyPlaceholders(lang) {
    document.querySelectorAll("[data-ph-uz]").forEach(function (el) {
      var text = el.getAttribute("data-ph-" + lang) || el.getAttribute("data-ph-uz");
      if (text) el.setAttribute("placeholder", text);
    });
  }
  function applyLang(lang) {
    document.documentElement.setAttribute("data-site-lang", lang);
    document.documentElement.setAttribute("lang", lang);
    var title = document.body.getAttribute("data-title-" + lang) ||
                document.body.getAttribute("data-title-uz");
    if (title) document.title = title;
    applyPlaceholders(lang);
  }
  function initLang() {
    var lang = getStoredLang() || "uz";
    applyLang(lang);
    var btn = document.getElementById("langSwitch");
    if (btn) {
      btn.addEventListener("click", function (e) {
        var current = document.documentElement.getAttribute("data-site-lang") || "uz";
        // Clicking a specific code jumps straight to it; clicking the frame
        // between the codes just steps to the next language.
        var picked = e.target && e.target.closest && e.target.closest("[data-lang-btn]");
        var next = picked
          ? picked.getAttribute("data-lang-btn")
          : LANGS[(LANGS.indexOf(current) + 1) % LANGS.length];
        if (next === current) return;
        applyLang(next);
        storeLang(next);
      });
    }
  }

  /* ---------- Mobile nav ---------- */
  function initNavToggle() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    if (!toggle || !nav) return;

    function openNav() {
      nav.classList.add("open");
      document.body.classList.add("nav-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.classList.add("is-open");
    }
    function closeNav() {
      nav.classList.remove("open");
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("is-open");
    }

    toggle.addEventListener("click", function () {
      nav.classList.contains("open") ? closeNav() : openNav();
    });
    nav.querySelectorAll(".nav-link").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
    // Close on ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
    // Close on click outside
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") &&
          !nav.contains(e.target) &&
          !toggle.contains(e.target)) {
        closeNav();
      }
    });
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var q = item.querySelector(".faq-q");
      if (!q) return;
      q.addEventListener("click", function () {
        var wasOpen = item.classList.contains("open");
        item.parentElement.querySelectorAll(".faq-item").forEach(function (el) {
          el.classList.remove("open");
        });
        if (!wasOpen) item.classList.add("open");
      });
    });
  }

  /* ---------- Project filter ---------- */
  function initFilter() {
    var buttons = document.querySelectorAll(".filter-btn");
    var rows = document.querySelectorAll("[data-category]");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var cat = btn.getAttribute("data-filter");
        rows.forEach(function (row) {
          var match = cat === "all" || row.getAttribute("data-category") === cat;
          row.style.display = match ? "" : "none";
        });
      });
    });
  }

  /* ---------- Contact form ----------
     Endpoint sozlangan bo'lsa murojaat backendga (u yerdan Telegramga)
     yuboriladi. Sozlanmagan bo'lsa pochta ilovasi ochiladi — forma
     hech qachon "yuborildi" deb yolg'on aytmaydi. */
  var FORM_TXT = {
    uz: {
      sending: "Yuborilmoqda...",
      ok: "Rahmat! Murojaatingiz qabul qilindi, tez orada bog'lanamiz.",
      mail: "Pochta ilovangiz ochildi — xatni yuborsangiz bizga yetib keladi.",
      err: "Yuborilmadi. Iltimos, +998 50 797-97-79 raqamiga qo'ng'iroq qiling yoki Telegram: @softdata",
      wait: "Biroz kuting va qaytadan urinib ko'ring."
    },
    ru: {
      sending: "Отправляется...",
      ok: "Спасибо! Заявка получена, мы свяжемся с вами в ближайшее время.",
      mail: "Открылось почтовое приложение — отправьте письмо, и заявка дойдёт до нас.",
      err: "Не отправлено. Позвоните на +998 50 797-97-79 или напишите в Telegram: @softdata",
      wait: "Подождите немного и попробуйте снова."
    },
    en: {
      sending: "Sending...",
      ok: "Thank you! Your request has been received — we'll be in touch shortly.",
      mail: "Your mail app is open — send the message and it will reach us.",
      err: "Not sent. Please call +998 50 797-97-79 or write on Telegram: @softdata",
      wait: "Please wait a moment and try again."
    }
  };

  function initForm() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    var status = document.getElementById("formStatus");
    var button = form.querySelector('button[type="submit"]');
    var sending = false;

    function say(kind, txt) {
      if (!status) return;
      status.className = "form-status" + (kind ? " is-" + kind : "");
      status.textContent = txt;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;

      var lang = document.documentElement.getAttribute("data-site-lang") || "uz";
      var t = FORM_TXT[lang] || FORM_TXT.uz;
      // form.elements orqali: form.name form elementining o'z atributi,
      // shu nomli input emas — to'g'ridan-to'g'ri form.name ishlamaydi
      function val(n) {
        var f = form.elements[n];
        return f ? String(f.value || "").trim() : "";
      }
      var data = {
        name: val("name"),
        phone: val("phone"),
        message: val("message"),
        company: val("company"),        // honeypot — odam to'ldirmaydi
        lang: lang,
        page: location.pathname
      };
      if (!data.name || !data.phone) return;

      var api = (window.SOFTDATA_API && window.SOFTDATA_API.form) || "";
      if (!api) {
        // Backend hali ulanmagan — hech bo'lmasa xat orqali yetib borsin
        var subject = "Sayt orqali murojaat — " + data.name;
        var body = "Ism: " + data.name + "\nTelefon: " + data.phone +
                   (data.message ? "\n\nXabar:\n" + data.message : "");
        window.location.href = "mailto:info@softdata.uz?subject=" +
          encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
        say("ok", t.mail);
        return;
      }

      sending = true;
      if (button) button.disabled = true;
      say("", t.sending);

      fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (r.status === 429) throw new Error("rate");
        if (!r.ok) throw new Error("http");
        return r.json();
      }).then(function () {
        say("ok", t.ok);
        form.reset();
      }).catch(function (err) {
        say("err", err.message === "rate" ? t.wait : t.err);
      }).then(function () {
        sending = false;
        if (button) button.disabled = false;
      });
    });
  }

  /* ---------- Typing-cursor signature reveal ----------
     Each .type-on heading holds two [data-lang] spans (uz/ru); CSS shows
     only the active one. We must animate each span independently — never
     el.textContent on the parent, or both languages' text gets merged. */
  /* Cyan → violet ramp painted across the accented phrase. Applied per
     character (not as one background-clip on the word) because each char
     span animates its own opacity — a parent-level gradient would show the
     whole phrase before the typing reached it. */
  function accentColor(t) {
    var from = [34, 217, 255], to = [168, 85, 247];
    var c = from.map(function (v, i) { return Math.round(v + (to[i] - v) * t); });
    return "rgb(" + c.join(",") + ")";
  }

  function normalizeWord(w) {
    return w.toLowerCase().replace(/[^0-9a-zà-ÿа-яё'’-]/gi, "");
  }

  function typeReveal(el, animate, accentWords) {
    var text = el.textContent.trim();
    el.textContent = "";
    el.classList.add("type-target");
    var frag = document.createDocumentFragment();
    var chars = [];
    // Group into per-word inline-blocks with real space text nodes between
    // them, so the browser keeps a genuine line-break opportunity at each
    // word boundary (per-char spans with no whitespace text nodes between
    // them give the browser nothing to wrap on and overflow the page).
    var words = text.split(" ");
    var cursor = document.createElement("span");
    cursor.className = "type-cursor";

    // How many characters the ramp has to span, so the gradient runs across
    // the whole accented phrase rather than restarting on every word.
    var accentTotal = 0;
    if (accentWords && accentWords.length) {
      words.forEach(function (w) {
        if (accentWords.indexOf(normalizeWord(w)) !== -1) accentTotal += w.length;
      });
    }
    var accentSeen = 0;

    words.forEach(function (word, wi) {
      var wordSpan = document.createElement("span");
      wordSpan.style.display = "inline-block";
      // nowrap: an inline-block is always a valid break point even with
      // zero whitespace, so without this the cursor (also inline-block)
      // can break away from the word it's nested in onto its own line.
      wordSpan.style.whiteSpace = "nowrap";
      var isAccent = accentTotal > 0 && accentWords.indexOf(normalizeWord(word)) !== -1;
      word.split("").forEach(function (ch) {
        var span = document.createElement("span");
        span.textContent = ch;
        span.style.opacity = animate ? "0" : "1";
        if (isAccent) {
          span.className = "w-accent";
          span.style.color = accentColor(accentTotal > 1 ? accentSeen / (accentTotal - 1) : 0);
          accentSeen++;
        }
        wordSpan.appendChild(span);
        chars.push(span);
      });
      // Cursor lives inside the last word's own inline-block box, so it
      // always wraps together with that word instead of orphaning alone
      // onto a new line when the word barely fits the available width.
      if (wi === words.length - 1) wordSpan.appendChild(cursor);
      frag.appendChild(wordSpan);
      if (wi < words.length - 1) frag.appendChild(document.createTextNode(" "));
    });
    el.appendChild(frag);

    if (animate && window.gsap && window.ScrollTrigger) {
      gsap.to(chars, {
        opacity: 1,
        duration: 0.01,
        stagger: 0.026,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    } else if (animate) {
      chars.forEach(function (c) { c.style.opacity = "1"; });
    }
  }

  function initTypeReveal() {
    var currentLang = document.documentElement.getAttribute("data-site-lang") || "uz";
    document.querySelectorAll(".type-on").forEach(function (el) {
      function accentsFor(lang) {
        var raw = el.getAttribute("data-accent-" + lang);
        return raw ? raw.split(/\s+/).map(normalizeWord) : null;
      }
      var langSpans = el.querySelectorAll("[data-lang]");
      if (langSpans.length) {
        langSpans.forEach(function (span) {
          var lang = span.getAttribute("data-lang");
          typeReveal(span, lang === currentLang, accentsFor(lang));
        });
      } else {
        typeReveal(el, true, accentsFor(currentLang));
      }
    });
  }

  /* ---------- Scroll reveals ---------- */
  function initReveals() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;
    if (window.gsap && window.ScrollTrigger) {
      items.forEach(function (el, i) {
        ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: function () { el.classList.add("is-visible"); }
        });
      });
    } else {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    }
  }

  /* ---------- Lenis smooth scroll ---------- */
  function initLenis() {
    if (!window.Lenis) return;
    var lenis = new Lenis({
      duration: 1.1,
      easing: function (t) { return 1 - Math.pow(1 - t, 3); },
      smoothWheel: true
    });
    if (window.gsap) {
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      });
    }
    if (window.ScrollTrigger) {
      lenis.on("scroll", ScrollTrigger.update);
    }
  }

  /* ---------- Header shadow / hero parallax (lightweight) ---------- */
  function initHeroMotion() {
    var hero = document.querySelector(".hero-visual");
    if (!hero || !window.gsap || !window.ScrollTrigger) return;
    gsap.to(hero, {
      yPercent: 12,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top bottom", end: "bottom top", scrub: true }
    });
  }

  /* ---------- Background video ----------
     The loop only fades in once it can actually play; if the file is
     missing or the browser blocks autoplay we drop the element entirely
     and the CSS/canvas layers carry the background on their own. */
  function initBgVideo() {
    var video = document.querySelector(".bg-fx .fx-video");
    if (!video) return;
    if (reducedMotion) { video.remove(); return; }

    function ready() { video.classList.add("is-ready"); }
    function fail() { video.classList.remove("is-ready"); video.remove(); }

    if (video.readyState >= 3) ready();
    video.addEventListener("canplay", ready);
    video.addEventListener("error", fail, true);
    video.querySelectorAll("source").forEach(function (s) {
      s.addEventListener("error", function () {
        // only give up once every source has failed
        if (video.networkState === 3 /* NETWORK_NO_SOURCE */) fail();
      });
    });

    var attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () { /* autoplay refused — layers below still animate */ });
    }

    // Don't burn battery/CPU while the tab is hidden.
    document.addEventListener("visibilitychange", function () {
      if (!video.isConnected) return;
      if (document.hidden) video.pause();
      else video.play().catch(function () {});
    });
  }

  /* ---------- Particle / node network canvas ---------- */
  function initParticles() {
    var canvas = document.querySelector(".fx-canvas");
    if (!canvas || reducedMotion) { if (canvas) canvas.remove(); return; }
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, nodes = [], raf = null;
    var pointer = { x: -9999, y: -9999 };

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // density scales with viewport, capped so phones stay smooth
      var count = Math.min(84, Math.max(26, Math.round((w * h) / 22000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: Math.random() * 1.6 + 0.7
        });
      }
    }

    var LINK = 148;      // px — max distance for a connecting line
    var LINK2 = LINK * LINK;

    function frame() {
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
      }

      for (i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 > LINK2) continue;
          var t = 1 - d2 / LINK2;
          ctx.strokeStyle = "rgba(120, 200, 255," + (t * 0.17).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        // cursor halo — nodes near the pointer light up
        var pdx = a.x - pointer.x, pdy = a.y - pointer.y;
        var pd2 = pdx * pdx + pdy * pdy;
        var near = pd2 < 42000 ? 1 - pd2 / 42000 : 0;

        ctx.fillStyle = near
          ? "rgba(52, 224, 161," + (0.35 + near * 0.55).toFixed(3) + ")"
          : "rgba(34, 217, 255, 0.42)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + near * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    start();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 180);
    });
    window.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });
    window.addEventListener("pointerleave", function () {
      pointer.x = pointer.y = -9999;
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }

  /* ---------- Cursor-follow shine on cards ---------- */
  function initCardShine() {
    if (reducedMotion) return;
    document.querySelectorAll(".card, .work-card, .partner-tile").forEach(function (card) {
      if (!card.querySelector(".card-shine")) {
        var shine = document.createElement("span");
        shine.className = "card-shine";
        card.appendChild(shine);
      }
      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - rect.left) + "px");
        card.style.setProperty("--my", (e.clientY - rect.top) + "px");
      });
    });
  }

  /* ---------- Count-up stats ---------- */
  function initCounters() {
    var values = document.querySelectorAll(".stat-value");
    if (!values.length) return;

    values.forEach(function (el) {
      // "60+", "<48h", "2.4x" — animate only the numeric core, keep the rest.
      var raw = el.textContent.trim();
      var match = raw.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
      if (!match) return;
      var prefix = match[1], target = parseFloat(match[2]), suffix = match[3];
      var decimals = (match[2].split(".")[1] || "").length;

      if (reducedMotion) return;

      var done = false;
      function run() {
        if (done) return;
        done = true;
        var t0 = null, dur = 1400;
        function tick(now) {
          if (t0 === null) t0 = now;
          var p = Math.min((now - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        el.textContent = prefix + (0).toFixed(decimals) + suffix;
        requestAnimationFrame(tick);
      }

      if (window.ScrollTrigger) {
        ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: run });
      } else {
        run();
      }
    });
  }

  /* ---------- Marquee: duplicate the track for a seamless loop ---------- */
  function initMarquee() {
    document.querySelectorAll(".marquee-track").forEach(function (track) {
      if (track.dataset.cloned === "1") return;
      track.dataset.cloned = "1";
      var clone = track.innerHTML;
      track.innerHTML = clone + clone;   // -50% translate lands exactly on the seam
    });
  }

  /* ---------- Hero AI visual: neural network (built here, not inlined,
     so the 25 KB of generated SVG never ships inside the HTML) ---------- */
  function buildAiNet() {
    var host = document.querySelector("[data-ai-net]");
    if (!host) return;

    var CY = "#22D9FF", VI = "#7C5CFF", MI = "#34E0A1";
    var W = 520, H = 380;
    var layers = [
      { x: 60,  ys: [110, 170, 230, 290],                 color: CY },
      { x: 200, ys: [80, 128, 176, 224, 272, 320],        color: CY },
      { x: 340, ys: [80, 128, 176, 224, 272, 320],        color: VI },
      { x: 460, ys: [140, 200, 260],                      color: MI }
    ];

    var s = [];
    s.push('<svg class="ai-net" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
           'aria-label="Neyron tarmoq va markaziy data server o\'rtasidagi ma\'lumot almashinuvi" fill="none">');
    s.push('<defs>' +
      '<linearGradient id="aiFlow" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + CY + '"/><stop offset="0.5" stop-color="#6C7CFF"/>' +
        '<stop offset="1" stop-color="#A855F7"/></linearGradient>' +
      '<radialGradient id="aiGlowA" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="' + CY + '" stop-opacity="0.55"/>' +
        '<stop offset="1" stop-color="' + CY + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="aiGlowB" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="' + VI + '" stop-opacity="0.45"/>' +
        '<stop offset="1" stop-color="' + VI + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="aiHubGlow" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="' + CY + '" stop-opacity="0.42"/>' +
        '<stop offset="0.55" stop-color="' + VI + '" stop-opacity="0.16"/>' +
        '<stop offset="1" stop-color="' + VI + '" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="aiHubFace" cx="0.35" cy="0.28" r="0.85">' +
        '<stop offset="0" stop-color="#13233A"/><stop offset="1" stop-color="#070C15"/></radialGradient>' +
      '</defs>');

    s.push('<ellipse cx="205" cy="200" rx="150" ry="140" fill="url(#aiGlowA)" opacity="0.5">' +
           '<animate attributeName="opacity" values="0.32;0.6;0.32" dur="5s" repeatCount="indefinite"/></ellipse>');
    s.push('<ellipse cx="350" cy="200" rx="150" ry="140" fill="url(#aiGlowB)" opacity="0.42">' +
           '<animate attributeName="opacity" values="0.5;0.24;0.5" dur="6.5s" repeatCount="indefinite"/></ellipse>');

    var edges = [];
    for (var li = 0; li < layers.length - 1; li++) {
      for (var a = 0; a < layers[li].ys.length; a++) {
        for (var c = 0; c < layers[li + 1].ys.length; c++) {
          edges.push([layers[li].x, layers[li].ys[a], layers[li + 1].x, layers[li + 1].ys[c]]);
        }
      }
    }
    edges.forEach(function (e) {
      var op = (0.10 + 0.05 * (1 - Math.abs(e[1] - e[3]) / 260)).toFixed(2);
      s.push('<line x1="' + e[0] + '" y1="' + e[1] + '" x2="' + e[2] + '" y2="' + e[3] +
             '" stroke="#7FB6FF" stroke-opacity="' + op + '" stroke-width="1"/>');
    });

    // deterministic subset carries the travelling pulses
    for (var i = 0; i < edges.length; i += 3) {
      var e2 = edges[i];
      var L = Math.round(Math.hypot(e2[2] - e2[0], e2[3] - e2[1]));
      var dur = (1.6 + (i % 5) * 0.32).toFixed(2);
      var begin = ((i * 0.07) % 3.2).toFixed(2);
      s.push('<line x1="' + e2[0] + '" y1="' + e2[1] + '" x2="' + e2[2] + '" y2="' + e2[3] +
             '" stroke="url(#aiFlow)" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="16 ' + L + '">' +
             '<animate attributeName="stroke-dashoffset" from="' + (L + 16) + '" to="0" dur="' + dur +
             's" begin="' + begin + 's" repeatCount="indefinite"/></line>');
    }

    layers.forEach(function (layer, li) {
      layer.ys.forEach(function (y, k) {
        var r = (li === 0 || li === 3) ? 7 : 6;
        var d = (2.6 + ((li + k) % 4) * 0.45).toFixed(2);
        var b = (((li * 3 + k) * 0.29) % 2.4).toFixed(2);
        s.push('<circle cx="' + layer.x + '" cy="' + y + '" r="' + (r + 7) + '" fill="' + layer.color + '" fill-opacity="0.10">' +
               '<animate attributeName="r" values="' + (r + 5) + ';' + (r + 13) + ';' + (r + 5) + '" dur="' + d + 's" begin="' + b + 's" repeatCount="indefinite"/>' +
               '<animate attributeName="fill-opacity" values="0.16;0;0.16" dur="' + d + 's" begin="' + b + 's" repeatCount="indefinite"/></circle>');
        s.push('<circle cx="' + layer.x + '" cy="' + y + '" r="' + r + '" fill="#0A101B" stroke="' + layer.color + '" stroke-opacity="0.75" stroke-width="1.4"/>');
        s.push('<circle cx="' + layer.x + '" cy="' + y + '" r="' + (r - 3) + '" fill="' + layer.color + '">' +
               '<animate attributeName="fill-opacity" values="1;0.3;1" dur="' + d + 's" begin="' + b + 's" repeatCount="indefinite"/></circle>');
      });
    });

    s.push('<rect x="0" y="0" width="2.5" height="' + H + '" fill="' + CY + '" opacity="0.5">' +
           '<animate attributeName="x" values="30;490;30" dur="7s" repeatCount="indefinite" calcMode="spline" ' +
           'keyTimes="0;0.5;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>' +
           '<animate attributeName="opacity" values="0;0.55;0" dur="3.5s" repeatCount="indefinite"/></rect>');

    /* Central data server: every node keeps a live link with it, and packets
       travel both ways — outbound (cyan) on even nodes, inbound (mint) on odd. */
    var HX = 260, HY = 200;
    var nodes = [];
    layers.forEach(function (layer) {
      layer.ys.forEach(function (y) { nodes.push({ x: layer.x, y: y }); });
    });

    nodes.forEach(function (n, idx) {
      var L = Math.round(Math.hypot(n.x - HX, n.y - HY));
      if (L < 46) return;                       // too close to the hub to read as a link
      s.push('<line x1="' + HX + '" y1="' + HY + '" x2="' + n.x + '" y2="' + n.y +
             '" stroke="#8FD8FF" stroke-opacity="0.18" stroke-width="1"/>');

      var out = idx % 2 === 0;
      var px1 = out ? HX : n.x, py1 = out ? HY : n.y;
      var px2 = out ? n.x : HX, py2 = out ? n.y : HY;
      var pdur = (1.5 + (idx % 4) * 0.38).toFixed(2);
      var pbeg = ((idx * 0.27) % 3).toFixed(2);
      s.push('<line x1="' + px1 + '" y1="' + py1 + '" x2="' + px2 + '" y2="' + py2 +
             '" stroke="' + (out ? CY : MI) + '" stroke-opacity="0.85" stroke-width="2" ' +
             'stroke-linecap="round" stroke-dasharray="8 ' + L + '">' +
             '<animate attributeName="stroke-dashoffset" from="' + (L + 8) + '" to="0" dur="' + pdur +
             's" begin="' + pbeg + 's" repeatCount="indefinite"/></line>');
    });

    s.push('<circle cx="' + HX + '" cy="' + HY + '" r="54" fill="url(#aiHubGlow)">' +
           '<animate attributeName="opacity" values="0.75;1;0.75" dur="3.4s" repeatCount="indefinite"/></circle>');
    [0, 1.4].forEach(function (delay) {         // radar rings leaving the server
      s.push('<circle cx="' + HX + '" cy="' + HY + '" r="26" fill="none" stroke="' + CY + '" stroke-width="1.2">' +
             '<animate attributeName="r" values="25;54" dur="2.8s" begin="' + delay + 's" repeatCount="indefinite"/>' +
             '<animate attributeName="opacity" values="0.5;0" dur="2.8s" begin="' + delay + 's" repeatCount="indefinite"/></circle>');
    });
    s.push('<circle cx="' + HX + '" cy="' + HY + '" r="33" fill="none" stroke="' + VI + '" stroke-opacity="0.5" ' +
           'stroke-width="1.1" stroke-dasharray="5 9">' +
           '<animateTransform attributeName="transform" type="rotate" from="0 ' + HX + ' ' + HY + '" ' +
           'to="360 ' + HX + ' ' + HY + '" dur="14s" repeatCount="indefinite"/></circle>');
    s.push('<circle cx="' + HX + '" cy="' + HY + '" r="25" fill="url(#aiHubFace)" stroke="url(#aiFlow)" stroke-width="1.8"/>');
    for (var bi = 0; bi < 3; bi++) {            // stacked server blades with blinking LEDs
      var by = HY - 13.5 + bi * 9;
      s.push('<rect x="' + (HX - 13) + '" y="' + by + '" width="26" height="7" rx="2.2" fill="none" ' +
             'stroke="#9FE9FF" stroke-opacity="0.5" stroke-width="1"/>');
      s.push('<circle cx="' + (HX - 8) + '" cy="' + (by + 3.5) + '" r="1.7" fill="' + MI + '">' +
             '<animate attributeName="fill-opacity" values="1;0.15;1" dur="' + (1.1 + bi * 0.4).toFixed(1) +
             's" repeatCount="indefinite"/></circle>');
    }
    s.push('</svg>');

    host.innerHTML = s.join("");
  }

  /* ---------- Scroll progress bar ---------- */
  function initScrollProgress() {
    var bar = document.getElementById("scrollProgress");
    if (!bar) return;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = "scaleX(" + Math.min(Math.max(p, 0), 1) + ")";
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* ---------- Pointer tilt on the direction cards ---------- */
  function initTilt() {
    var cards = document.querySelectorAll("[data-tilt]");
    if (!cards.length || reducedMotion) return;
    // Touch pointers would leave the card stuck mid-tilt, so tilt on fine pointers only.
    if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    cards.forEach(function (card) {
      var frame = null;
      card.addEventListener("pointermove", function (e) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          frame = null;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.style.setProperty("--rx", (-py * 5).toFixed(2) + "deg");
          card.style.setProperty("--ry", (px * 6).toFixed(2) + "deg");
          card.style.setProperty("--mx", (e.clientX - r.left) + "px");
          card.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Header state on scroll ---------- */
  function initHeaderState() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLang();
    initNavToggle();
    initFaq();
    initFilter();
    initForm();
    initHeaderState();
    initScrollProgress();
    initBgVideo();
    initParticles();
    buildAiNet();
    initCardShine();
    initTilt();
    initMarquee();

    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }
    initLenis();
    initTypeReveal();
    initReveals();
    initHeroMotion();
    initCounters();
  });
})();
