/* ===========================================================
   SoftData — admin panel engine

   Saytdagi barcha matnlar HTML fayllarning ichida turadi
   (uz/ru/en uchligi ko'rinishida). Panel ularni GitHub API
   orqali o'qiydi, tahrirlashga beradi va o'zgargan fayllarni
   qaytadan commit qiladi. GitHub Pages 1-2 daqiqada yangilaydi.

   Muhim: HTML DOMParser bilan qayta yig'ilmaydi — faqat matn
   bo'laklari almashtiriladi, qolgan bayt o'z joyida qoladi.
   =========================================================== */

(function () {
  "use strict";

  var CFG_KEY = "softdata_admin_cfg";
  var FILES = [
    "index.html", "biz-haqimizda.html", "yechimlar.html",
    "loyihalar.html", "hamkorlar.html", "aloqa.html"
  ];
  var LANGS = ["uz", "ru", "en"];
  var LANG_LABEL = { uz: "O'zbekcha (asosiy)", ru: "Ruscha", en: "Inglizcha" };

  /* Mashina tarjimasi domen atamalarini buzadi — chiqishdan keyin
     shu jadval bo'yicha to'g'irlanadi. Yangi atama qo'shsangiz shu yerga. */
  var GLOSSARY = {
    ru: [
      [/табл(о|ица) вакансий/gi, "табло свободных мест"],
      [/свободных мест табло/gi, "табло свободных мест"],
      [/подписк(а|и|у)/gi, "абонемент"],
      [/шлагбаум откроется сам/gi, "шлагбаум откроется сам"],
      [/распознавание номеров/gi, "распознавание госномеров"],
      [/направлени(е|я|й) услуг/gi, "направлений услуг"]
    ],
    en: [
      [/vacanc(y|ies) table/gi, "free-space display"],
      [/table of vacancies/gi, "free-space display"],
      [/subscription/gi, "season pass"],
      [/number recognition/gi, "licence plate recognition"],
      [/the car approaches/gi, "a car pulls up"],
      [/reads the number/gi, "reads the plate"]
    ]
  };

  /* ---------------- state ---------------- */
  var cfg = { owner: "", repo: "", branch: "main", token: "" };
  var files = {};        // path -> { raw, sha, dirty }
  var entries = [];       // barcha tahrirlanadigan matnlar
  var busy = false;

  /* ---------------- utils ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  // Foydalanuvchi kiritgan matnni HTML ichiga xavfsiz joylash.
  // Mavjud entity (&nbsp; &#8594;) buzilmasligi uchun & tanlab qochiriladi.
  function escapeText(s) {
    return String(s)
      .replace(/&(?![a-zA-Z][a-zA-Z0-9]{1,9};|#[0-9]{1,6};|#x[0-9a-fA-F]{1,6};)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- status bar ---------------- */
  var bar, barText, barSpin;
  function status(msg, kind, sticky) {
    if (!bar) return;
    bar.className = "bar is-on" + (kind ? " " + kind : "");
    barText.textContent = msg;
    barSpin.style.display = kind === "load" ? "block" : "none";
    clearTimeout(status._t);
    if (!sticky && kind !== "load") {
      status._t = setTimeout(function () { bar.className = "bar"; }, 4200);
    }
  }
  function statusOff() { if (bar) bar.className = "bar"; }

  /* ---------------- GitHub API ---------------- */
  function gh(path, opts) {
    opts = opts || {};
    return fetch("https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + path, {
      method: opts.method || "GET",
      headers: {
        "Authorization": "Bearer " + cfg.token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = (j && j.message) || ("HTTP " + r.status);
          throw new Error(m);
        }
        return j;
      });
    });
  }

  function loadFile(path) {
    return gh("/contents/" + encodeURIComponent(path) + "?ref=" + encodeURIComponent(cfg.branch))
      .then(function (j) {
        files[path] = { raw: b64decode(j.content), sha: j.sha, dirty: false };
      });
  }

  function saveFile(path, message) {
    var f = files[path];
    return gh("/contents/" + encodeURIComponent(path), {
      method: "PUT",
      body: {
        message: message,
        content: b64encode(f.raw),
        sha: f.sha,
        branch: cfg.branch
      }
    }).then(function (j) {
      f.sha = j.content.sha;   // keyingi saqlash uchun yangi sha
      f.dirty = false;
    });
  }

  /* ---------------- matnlarni ajratib olish ----------------
     1) <span data-lang="uz">..</span><span ru>..</span><span en>..</span>
     2) data-title-uz / data-ph-uz / data-accent-uz atributlari      */

  var SPAN_RE = new RegExp(
    '<span([^>]*?)data-lang="uz"([^>]*?)>([\\s\\S]*?)<\\/span>(\\s*)' +
    '<span([^>]*?)data-lang="ru"([^>]*?)>([\\s\\S]*?)<\\/span>(\\s*)' +
    '<span([^>]*?)data-lang="en"([^>]*?)>([\\s\\S]*?)<\\/span>', "g");

  var ATTR_PREFIXES = [
    { p: "data-title", label: "sahifa sarlavhasi (browser tab)" },
    { p: "data-ph", label: "forma placeholder" },
    { p: "data-accent", label: "sarlavhadagi rangli so'zlar" }
  ];

  // Eng yaqin oldingi HTML izohi bo'lim nomi sifatida ishlatiladi
  // (fayllarda <!-- HERO -->, <!-- CTA --> kabi belgilar bor)
  function sectionOf(raw, idx) {
    var all = raw.slice(0, idx).match(/<!--\s*([^>]{1,60}?)\s*-->/g);
    if (!all || !all.length) return "";
    var last = all[all.length - 1].replace(/<!--\s*|\s*-->/g, "").trim();
    return (last && !/^=/.test(last)) ? last : "";
  }
  function tagOf(raw, idx) {
    var head = raw.slice(Math.max(0, idx - 400), idx);
    var m = head.match(/<(h1|h2|h3|h4|p|title|label|button|a|li|div|span|td)\b[^>]*>(?![\s\S]*<(h1|h2|h3|h4|p|title|label|button|a|li|div|span|td)\b)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function extract() {
    entries = [];
    FILES.forEach(function (path) {
      var raw = files[path].raw, m;
      SPAN_RE.lastIndex = 0;
      while ((m = SPAN_RE.exec(raw))) {
        entries.push({
          id: entries.length,
          file: path,
          kind: "span",
          at: m.index,
          section: sectionOf(raw, m.index),
          tag: tagOf(raw, m.index),
          uz: m[3], ru: m[7], en: m[11],
          orig: { uz: m[3], ru: m[7], en: m[11] }
        });
      }
      ATTR_PREFIXES.forEach(function (def) {
        var tagRe = new RegExp("<[a-zA-Z][^>]*" + def.p + '-uz="[^"]*"[^>]*>', "g");
        var t;
        while ((t = tagRe.exec(raw))) {
          var tag = t[0], vals = {}, ok = true;
          LANGS.forEach(function (L) {
            var v = tag.match(new RegExp(def.p + "-" + L + '="([^"]*)"'));
            if (!v) ok = false; else vals[L] = v[1];
          });
          if (!ok) continue;
          entries.push({
            id: entries.length,
            file: path,
            kind: "attr",
            prefix: def.p,
            at: t.index,
            section: def.label,
            tag: def.p,
            uz: vals.uz, ru: vals.ru, en: vals.en,
            orig: { uz: vals.uz, ru: vals.ru, en: vals.en }
          });
        }
      });
    });
    entries.sort(function (a, b) {
      return FILES.indexOf(a.file) - FILES.indexOf(b.file) || a.at - b.at;
    });
  }

  /* ---------------- o'zgarishlarni faylga qaytarish ---------------- */
  function applyToRaw(path) {
    var raw = files[path].raw;
    var mine = entries.filter(function (e) { return e.file === path && isDirty(e); });
    if (!mine.length) return false;

    // orqadan oldinga — oldingi almashtirish keyingilarining o'rnini surmaydi
    mine.sort(function (a, b) { return b.at - a.at; });

    mine.forEach(function (e) {
      if (e.kind === "span") {
        SPAN_RE.lastIndex = e.at;
        var m = SPAN_RE.exec(raw);
        if (!m || m.index !== e.at) { e.error = "joyi topilmadi"; return; }
        var rebuilt =
          '<span' + m[1] + 'data-lang="uz"' + m[2] + '>' + escapeText(e.uz) + '</span>' + m[4] +
          '<span' + m[5] + 'data-lang="ru"' + m[6] + '>' + escapeText(e.ru) + '</span>' + m[8] +
          '<span' + m[9] + 'data-lang="en"' + m[10] + '>' + escapeText(e.en) + '</span>';
        raw = raw.slice(0, m.index) + rebuilt + raw.slice(m.index + m[0].length);
      } else {
        var tagRe = new RegExp("<[a-zA-Z][^>]*" + e.prefix + '-uz="[^"]*"[^>]*>', "g");
        tagRe.lastIndex = e.at;
        var t = tagRe.exec(raw);
        if (!t || t.index !== e.at) { e.error = "joyi topilmadi"; return; }
        var tag = t[0];
        LANGS.forEach(function (L) {
          // atribut qiymatida " bo'lishi mumkin emas
          var safe = String(e[L]).replace(/"/g, "&quot;").replace(/</g, "&lt;");
          tag = tag.replace(new RegExp(e.prefix + "-" + L + '="[^"]*"'),
                            e.prefix + "-" + L + '="' + safe + '"');
        });
        raw = raw.slice(0, t.index) + tag + raw.slice(t.index + t[0].length);
      }
    });

    files[path].raw = raw;
    files[path].dirty = true;
    return true;
  }

  function isDirty(e) {
    return e.uz !== e.orig.uz || e.ru !== e.orig.ru || e.en !== e.orig.en;
  }
  function dirtyCount() { return entries.filter(isDirty).length; }

  /* ---------------- tarjima ---------------- */
  function rawTranslate(text, to) {
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=uz&tl=" +
              to + "&dt=t&q=" + encodeURIComponent(text);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("tarjima xizmati javob bermadi (" + r.status + ")");
      return r.json();
    }).then(function (j) {
      if (!j || !j[0]) throw new Error("tarjima bo'sh qaytdi");
      return j[0].map(function (p) { return p[0] || ""; }).join("");
    });
  }
  function polish(text, to) {
    (GLOSSARY[to] || []).forEach(function (pair) {
      text = text.replace(pair[0], pair[1]);
    });
    return text.replace(/\s+([,.;:!?])/g, "$1").trim();
  }
  function translate(text, to) {
    if (!String(text).trim()) return Promise.resolve("");
    var tries = 0;
    function attempt() {
      tries++;
      return rawTranslate(text, to).catch(function (err) {
        if (tries >= 3) throw err;
        return sleep(600 * tries).then(attempt);
      });
    }
    return attempt().then(function (t) { return polish(t, to); });
  }

  // Navbat: bepul endpoint ko'p parallel so'rovda bloklaydi
  function runQueue(tasks, onProgress) {
    var i = 0, active = 0, done = 0, failed = 0, total = tasks.length;
    return new Promise(function (resolve) {
      function next() {
        if (done + failed >= total) return resolve({ done: done, failed: failed });
        while (active < 3 && i < total) {
          var task = tasks[i++];
          active++;
          task().then(function () { done++; }, function () { failed++; })
            .then(function () {
              active--;
              if (onProgress) onProgress(done + failed, total);
              setTimeout(next, 140);
            });
        }
      }
      next();
    });
  }

  function translateEntry(e) {
    var targets = LANGS.filter(function (L) { return L !== "uz"; });
    return Promise.all(targets.map(function (L) {
      var box = document.querySelector('[data-ta="' + e.id + '-' + L + '"]');
      if (box) box.classList.add("translating");
      return translate(e.uz, L).then(function (t) {
        e[L] = t;
        if (box) { box.value = t; box.classList.remove("translating"); }
      }, function (err) {
        if (box) box.classList.remove("translating");
        throw err;
      });
    })).then(function () { markRow(e); });
  }

  /* ---------------- render ---------------- */
  var listEl, counterEl, searchEl, filterEl;

  function markRow(e) {
    var row = document.querySelector('[data-row="' + e.id + '"]');
    if (row) row.classList.toggle("is-dirty", isDirty(e));
    LANGS.forEach(function (L) {
      var box = document.querySelector('[data-ta="' + e.id + '-' + L + '"]');
      if (box) box.classList.toggle("changed", e[L] !== e.orig[L]);
    });
    updateCounter();
  }

  function updateCounter() {
    var d = dirtyCount();
    counterEl.innerHTML = "Jami <b>" + entries.length + "</b> ta matn" +
      (d ? ' &nbsp;·&nbsp; <span class="dirty">' + d + " ta o'zgargan</span>" : "");
    $("#saveBtn").disabled = busy || d === 0;
    $("#trAllBtn").disabled = busy;
  }

  function visible() {
    var q = (searchEl.value || "").trim().toLowerCase();
    var f = filterEl.value;
    return entries.filter(function (e) {
      if (f === "__dirty" && !isDirty(e)) return false;
      if (f && f !== "__dirty" && e.file !== f) return false;
      if (!q) return true;
      return (e.uz + " " + e.ru + " " + e.en + " " + e.section).toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    listEl.innerHTML = "";
    var rows = visible();
    if (!rows.length) {
      listEl.appendChild(el("div", "empty", "Hech narsa topilmadi."));
      updateCounter();
      return;
    }
    var curKey = null, group = null, count = 0, countEl = null;

    rows.forEach(function (e) {
      var key = e.file + "|" + e.section;
      if (key !== curKey) {
        curKey = key;
        group = el("div", "group");
        var head = el("div", "group-head");
        head.appendChild(el("span", "g-file", e.file));
        if (e.section) head.appendChild(el("span", null, "· " + e.section));
        countEl = el("span", "g-count", "");
        head.appendChild(countEl);
        group.appendChild(head);
        listEl.appendChild(group);
        count = 0;
      }
      count++;
      countEl.textContent = count + " ta";
      group.appendChild(rowEl(e));
    });
    updateCounter();
  }

  function rowEl(e) {
    var row = el("div", "item" + (isDirty(e) ? " is-dirty" : ""));
    row.setAttribute("data-row", e.id);

    var meta = el("div", "item-meta");
    meta.appendChild(el("span", "tag", e.kind === "attr" ? e.prefix : "<" + (e.tag || "span") + ">"));
    meta.appendChild(document.createElement("br"));
    meta.appendChild(document.createTextNode(e.file));
    if (e.prefix === "data-accent") {
      meta.appendChild(document.createElement("br"));
      var w = el("span", "warn", "⚠ bu so'zlar sarlavha ichida aynan mavjud bo'lishi shart");
      meta.appendChild(w);
    }
    row.appendChild(meta);

    var langs = el("div", "item-langs");
    LANGS.forEach(function (L) {
      var box = el("div", "lang" + (L === "uz" ? " src" : ""));
      var head = el("div", "lang-head");
      head.appendChild(el("span", "code", L.toUpperCase()));
      head.appendChild(el("span", null, LANG_LABEL[L]));
      if (L === "uz") {
        var tb = el("button", "btn btn-sm btn-ghost", "→ tarjima");
        tb.type = "button";
        tb.title = "Shu qatorni rus va ingliz tiliga tarjima qilish";
        tb.addEventListener("click", function () {
          if (busy) return;
          tb.disabled = true;
          status("Tarjima qilinmoqda...", "load", true);
          translateEntry(e).then(function () {
            status("Tarjima qilindi", "ok");
          }, function (err) {
            status("Tarjima xatosi: " + err.message, "err");
          }).then(function () { tb.disabled = false; });
        });
        head.appendChild(tb);
      }
      box.appendChild(head);

      var ta = document.createElement("textarea");
      ta.value = e[L];
      ta.setAttribute("data-ta", e.id + "-" + L);
      ta.spellcheck = false;
      if (e[L] !== e.orig[L]) ta.className = "changed";
      ta.addEventListener("input", function () {
        e[L] = ta.value;
        markRow(e);
      });
      box.appendChild(ta);
      langs.appendChild(box);
    });
    row.appendChild(langs);
    return row;
  }

  /* ---------------- actions ---------------- */
  function loadAll() {
    busy = true;
    status("Fayllar yuklanmoqda...", "load", true);
    return FILES.reduce(function (p, f) {
      return p.then(function () { return loadFile(f); });
    }, Promise.resolve()).then(function () {
      extract();
      render();
      busy = false;
      status(entries.length + " ta matn yuklandi", "ok");
    }, function (err) {
      busy = false;
      status("Yuklashda xato: " + err.message, "err", true);
      throw err;
    });
  }

  function translateAllDirty() {
    var todo = entries.filter(function (e) {
      return e.uz !== e.orig.uz;      // faqat o'zbekchasi o'zgarganlar
    });
    if (!todo.length) {
      status("O'zbekcha matni o'zgargan qator yo'q", "err");
      return;
    }
    if (!confirm(todo.length + " ta qator rus va ingliz tiliga tarjima qilinadi.\n" +
                 "Mavjud tarjimalar almashtiriladi. Davom etamizmi?")) return;
    busy = true;
    updateCounter();
    var tasks = todo.map(function (e) { return function () { return translateEntry(e); }; });
    runQueue(tasks, function (d, t) {
      status("Tarjima: " + d + " / " + t, "load", true);
    }).then(function (r) {
      busy = false;
      updateCounter();
      if (r.failed) status(r.done + " ta tarjima qilindi, " + r.failed + " tasida xato", "err", true);
      else status(r.done + " ta qator tarjima qilindi", "ok");
    });
  }

  function saveAll() {
    var d = dirtyCount();
    if (!d) return;
    if (!confirm(d + " ta o'zgarish GitHub'ga saqlanadi va sayt yangilanadi.\nDavom etamizmi?")) return;

    busy = true;
    updateCounter();
    status("Saqlanmoqda...", "load", true);

    var changed = [];
    FILES.forEach(function (p) { if (applyToRaw(p)) changed.push(p); });

    if (!changed.length) {
      busy = false;
      status("Saqlash uchun o'zgarish topilmadi", "err");
      return;
    }
    var msg = "Sayt matnlari yangilandi (" + d + " ta o'zgarish)";
    changed.reduce(function (p, path) {
      return p.then(function () {
        status("Saqlanmoqda: " + path, "load", true);
        return saveFile(path, msg);
      });
    }, Promise.resolve()).then(function () {
      // fayllar qayta yozildi — indekslar siljidi, holatni yangilaymiz
      entries.forEach(function (e) {
        e.orig = { uz: e.uz, ru: e.ru, en: e.en };
      });
      extract();
      render();
      busy = false;
      status("Saqlandi. Sayt 1-2 daqiqada yangilanadi.", "ok", true);
    }, function (err) {
      busy = false;
      updateCounter();
      status("Saqlashda xato: " + err.message, "err", true);
    });
  }

  /* ---------------- login ---------------- */
  function readCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch (e) { return null; }
  }
  function writeCfg(c) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
  }
  function showScreen(name) {
    $("#loginScreen").classList.toggle("is-on", name === "login");
    $("#editorScreen").classList.toggle("is-on", name === "editor");
    $("#topActions").style.display = name === "editor" ? "flex" : "none";
  }

  function doLogin() {
    cfg = {
      owner: $("#inOwner").value.trim(),
      repo: $("#inRepo").value.trim(),
      branch: $("#inBranch").value.trim() || "main",
      token: $("#inToken").value.trim()
    };
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      status("Owner, repo va token to'ldirilishi kerak", "err");
      return;
    }
    status("Ulanmoqda...", "load", true);
    gh("").then(function (r) {
      writeCfg(cfg);
      $("#repoLabel").textContent = cfg.owner + "/" + cfg.repo + " · " + cfg.branch;
      showScreen("editor");
      return loadAll();
    }).catch(function (err) {
      status("Ulanmadi: " + err.message, "err", true);
    });
  }

  /* ---------------- init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    bar = $("#bar"); barText = $("#barText"); barSpin = $("#barSpin");
    listEl = $("#list"); counterEl = $("#counter");
    searchEl = $("#search"); filterEl = $("#filter");

    FILES.forEach(function (f) {
      var o = document.createElement("option");
      o.value = f; o.textContent = f;
      filterEl.appendChild(o);
    });

    var saved = readCfg();
    if (saved) {
      $("#inOwner").value = saved.owner || "";
      $("#inRepo").value = saved.repo || "";
      $("#inBranch").value = saved.branch || "main";
      $("#inToken").value = saved.token || "";
    }

    $("#loginBtn").addEventListener("click", doLogin);
    $("#inToken").addEventListener("keydown", function (e) {
      if (e.key === "Enter") doLogin();
    });
    $("#logoutBtn").addEventListener("click", function () {
      if (dirtyCount() && !confirm("Saqlanmagan o'zgarishlar bor. Baribir chiqamizmi?")) return;
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      location.reload();
    });
    $("#reloadBtn").addEventListener("click", function () {
      if (dirtyCount() && !confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etamizmi?")) return;
      loadAll().catch(function () {});
    });
    $("#saveBtn").addEventListener("click", saveAll);
    $("#trAllBtn").addEventListener("click", translateAllDirty);
    searchEl.addEventListener("input", render);
    filterEl.addEventListener("change", render);

    window.addEventListener("beforeunload", function (e) {
      if (dirtyCount()) { e.preventDefault(); e.returnValue = ""; }
    });

    if (saved && saved.token) {
      $("#repoLabel").textContent = saved.owner + "/" + saved.repo + " · " + (saved.branch || "main");
      cfg = saved;
      showScreen("editor");
      loadAll().catch(function () { showScreen("login"); });
    } else {
      showScreen("login");
    }
  });
})();
