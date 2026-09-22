/* Cutlantis — comportements du site : compte à rebours du prix de lancement, bascule automatique
   au prix normal à l'échéance, simulateur de rentabilité, courbe de démonstration. */
(function () {
  "use strict";
  var C = window.CUTLANTIS || {};
  var PRE = !C.launch_ends;                   // avant le lancement : prix de lancement, pas de compte à rebours
  var END = PRE ? Infinity : new Date(C.launch_ends).getTime();
  var launch = function () { return Date.now() < END; };
  try { localStorage.setItem("cutlantis-lang", (document.documentElement.lang || "").slice(0, 2)); } catch (e) {}

  function langOf(el) {
    var n = el.closest("[lang]");
    return ((n && n.getAttribute("lang")) || document.documentElement.lang || "fr").slice(0, 2);
  }
  function loc(l) { return (C.locales && C.locales[l]) || l; }
  function eur(l, v) {
    return new Intl.NumberFormat(loc(l), { style: "currency", currency: "EUR",
      minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  }
  function num(l, v, d) {
    return new Intl.NumberFormat(loc(l), { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }).format(v);
  }
  function date(l) {
    if (PRE) return "";
    return new Intl.DateTimeFormat(loc(l), { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(END));
  }
  function price() { return launch() ? C.launch_price : C.regular_price; }

  /* ------------------------------------------------ valeurs affichées (prix, dates, vues) */
  function refresh() {
    var on = launch(), p = price();
    document.querySelectorAll("[data-when]").forEach(function (e) {
      e.hidden = (e.getAttribute("data-when") === "launch") !== on;
    });
    document.querySelectorAll("[data-v]").forEach(function (e) {
      var l = langOf(e), k = e.getAttribute("data-v"), v;
      if (k === "price") v = eur(l, p);
      else if (k === "regular") v = eur(l, C.regular_price);
      else if (k === "upgrade") v = eur(l, C.upgrade_price);
      else if (k === "date") v = date(l);
      else if (k === "views") v = num(l, p / C.rpm * 1000);
      else if (k === "views_regular") v = num(l, C.regular_price / C.rpm * 1000);
      else if (k === "rpm") v = eur(l, C.rpm);
      else return;
      if (e.textContent !== v) e.textContent = v;
    });
    document.querySelectorAll("[data-buy]").forEach(function (a) {
      a.href = on ? C.checkout_launch : C.checkout_regular;
    });
    document.querySelectorAll("[data-bar]").forEach(function (b) { b.style.width = (p / 936 * 100).toFixed(1) + "%"; });
    document.querySelectorAll("[data-bar-label]").forEach(function (e) { e.style.left = "calc(" + (p / 936 * 100).toFixed(1) + "% + 10px)"; });
    document.querySelectorAll("[data-roi]").forEach(updateRoi);
  }

  /* ------------------------------------------------ compte à rebours (style timecode) */
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var wasLaunch = launch();
  function tick() {
    if (PRE) return;
    var left = Math.max(0, END - Date.now());
    var s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600),
        m = Math.floor(s % 3600 / 60), sec = s % 60;
    document.querySelectorAll("[data-countdown]").forEach(function (t) {
      var set = function (k, v) { var b = t.querySelector('[data-cd="' + k + '"]'); if (b && b.textContent !== v) b.textContent = v; };
      set("d", pad(d)); set("h", pad(h)); set("m", pad(m)); set("s", pad(sec));
    });
    document.querySelectorAll("[data-cdi]").forEach(function (t) {
      t.textContent = d + " " + t.getAttribute("data-unit") + " " + pad(h) + ":" + pad(m) + ":" + pad(sec);
    });
    if (wasLaunch && !launch()) { wasLaunch = false; refresh(); }   // l'échéance tombe pendant la visite
  }

  /* ------------------------------------------------ simulateur de rentabilité */
  function views(pos) {                       // curseur 0–100 → 10 000 à 5 000 000 vues, échelle log
    var v = Math.pow(10, 4 + pos / 100 * 2.7), step = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / step) * step;
  }
  function updateRoi(box) {
    var l = langOf(box);
    var v = views(+box.querySelector('[data-in="views"]').value);
    var r = +box.querySelector('[data-in="rate"]').value;
    var month = v / 1000 * r, days = price() / (month / 30.4);
    var pay = days <= 1.5 ? box.getAttribute("data-day")
      : days <= 60 ? box.getAttribute("data-days").replace("{n}", Math.round(days))
      : box.getAttribute("data-months").replace("{n}", num(l, days / 30.4, 1));
    box.querySelector('[data-out="views"]').textContent = num(l, v);
    box.querySelector('[data-out="rate"]').textContent = eur(l, r);
    box.querySelector('[data-out="month"]').textContent = eur(l, Math.round(month));
    box.querySelector('[data-out="pay"]').textContent = pay;
  }
  document.querySelectorAll("[data-roi] input").forEach(function (i) {
    i.addEventListener("input", function () { updateRoi(i.closest("[data-roi]")); });
  });

  /* ------------------------------------------------ courbe de démonstration : bandes ↔ lignes */
  document.querySelectorAll("[data-curve]").forEach(function (c) {
    function on(i, yes) {
      c.querySelectorAll('[data-i="' + i + '"]').forEach(function (e) { e.classList.toggle("on", yes); });
    }
    c.querySelectorAll("[data-i]").forEach(function (e) {
      var i = e.getAttribute("data-i");
      e.addEventListener("mouseenter", function () { on(i, true); });
      e.addEventListener("mouseleave", function () { on(i, false); });
    });
  });

  /* ------------------------------------------------ téléchargement : l'ordinateur du visiteur d'abord */
  var ua = navigator.userAgent || "", plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  var phone = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Mac/.test(plat) && navigator.maxTouchPoints > 1);
  var os = /Win/i.test(plat + ua) ? "win" : /Mac/i.test(plat + ua) ? "mac" : "";
  if (phone) document.querySelectorAll("[data-phone]").forEach(function (e) { e.hidden = false; });
  if (os && !phone) {
    document.querySelectorAll('.dl-card[data-os="' + os + '"]').forEach(function (c) {
      c.classList.add("is-yours");
      var y = c.querySelector(".yours"); if (y) y.hidden = false;
      c.parentNode.insertBefore(c, c.parentNode.firstChild);
    });
    document.querySelectorAll('.install-os > [data-os="' + os + '"]').forEach(function (c) {
      c.parentNode.insertBefore(c, c.parentNode.firstChild);
    });
  }
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { b.textContent = b.getAttribute("data-done"); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute("data-copy")).then(done, function () {});
    });
  });

  /* ------------------------------------------------ liens pas encore réglés : un message, pas une erreur */
  var toast;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-pending]");
    if (!a) return;
    e.preventDefault();
    if (!toast) { toast = document.createElement("div"); toast.className = "toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = a.getAttribute("data-pending");
    toast.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(function () { toast.classList.remove("on"); }, 4200);
  });

  /* ------------------------------------------------ page de remerciement après l'achat */
  if (/[?&]merci=1/.test(location.search) || /\/merci$/.test(location.hash)) {
    document.querySelectorAll("[data-thanks]").forEach(function (e) { e.hidden = false; });
  }

  refresh();
  tick();
  setInterval(tick, 1000);
})();
