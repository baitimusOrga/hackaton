/* @ds-bundle: {"format":4,"namespace":"Zweit","components":[{"name":"Button"},{"name":"Input"},{"name":"Chip"},{"name":"Badge"},{"name":"ListingCard"},{"name":"AuctionTimer"}]} */
(function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function cls(base, mods) { return [base].concat((mods || []).filter(Boolean).map(function (m) { return base + "--" + m; })).join(" "); }

  var ICONS = {
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function formatCHF(n) {
    var whole = Math.floor(n), rp = Math.round((n - whole) * 100);
    var s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "’");
    return "CHF " + s + (rp ? "." + (rp < 10 ? "0" + rp : rp) : ".–");
  }

  function Button(p) {
    p = p || {};
    var tag = p.href ? "a" : "button";
    var mods = [p.variant, p.size, p.block && "block"];
    var attrs = p.href ? ' href="' + esc(p.href) + '"' : ' type="' + esc(p.type || "button") + '"';
    if (p.disabled) attrs += p.href ? ' aria-disabled="true"' : " disabled";
    return el("<" + tag + ' class="' + cls("zw-btn", mods) + '"' + attrs + ">" + (p.icon && ICONS[p.icon] ? ICONS[p.icon] : "") + "<span>" + esc(p.label) + "</span></" + tag + ">");
  }

  function Input(p) {
    p = p || {};
    var id = p.id || "zw-" + Math.random().toString(36).slice(2, 8);
    var inv = p.error ? ' aria-invalid="true"' : "";
    var input = '<input class="zw-input' + (p.unit ? " zw-input--price" : "") + '" id="' + id + '" type="' + esc(p.type || "text") + '" placeholder="' + esc(p.placeholder) + '"' + (p.value != null ? ' value="' + esc(p.value) + '"' : "") + (p.inputMode ? ' inputmode="' + esc(p.inputMode) + '"' : "") + inv + (p.describedBy || p.help || p.error ? ' aria-describedby="' + id + '-help"' : "") + ">";
    if (p.unit) input = '<div class="zw-affix"><span class="zw-affix__unit">' + esc(p.unit) + "</span>" + input + "</div>";
    var help = p.error ? '<p class="zw-help zw-help--error" id="' + id + '-help">' + esc(p.error) + "</p>" : p.help ? '<p class="zw-help" id="' + id + '-help">' + esc(p.help) + "</p>" : "";
    return el('<div class="zw-field"><label class="zw-label" for="' + id + '">' + esc(p.label) + "</label>" + input + help + "</div>");
  }

  function Chip(p) {
    p = p || {};
    var node = el('<button type="button" class="zw-chip" aria-pressed="' + (p.selected ? "true" : "false") + '">' + (p.selected ? ICONS.check : "") + "<span>" + esc(p.label) + "</span></button>");
    node.addEventListener("click", function () {
      var on = node.getAttribute("aria-pressed") !== "true";
      node.setAttribute("aria-pressed", on ? "true" : "false");
      var svg = node.querySelector("svg"); if (svg) svg.remove();
      if (on) node.insertAdjacentHTML("afterbegin", ICONS.check);
      if (p.onChange) p.onChange(on);
    });
    return node;
  }

  function Badge(p) {
    p = p || {};
    return el('<span class="' + cls("zw-badge", [p.variant]) + '">' + esc(p.label) + "</span>");
  }

  function AuctionTimer(p) {
    p = p || {};
    var node = el('<span class="' + cls("zw-timer", [p.urgent && "urgent", p.ended && "ended"]) + '" role="timer" aria-live="off">' + ICONS.clock + '<span class="zw-timer__label">' + esc(p.label || "Endet in") + '</span><span class="zw-timer__value"></span></span>');
    var val = node.querySelector(".zw-timer__value");
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function render() {
      var ms = Math.max(0, (p.endsAt instanceof Date ? p.endsAt.getTime() : +p.endsAt) - Date.now());
      var s = Math.floor(ms / 1000);
      val.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
      if (ms <= 0) { node.classList.add("zw-timer--ended"); node.classList.remove("zw-timer--urgent"); node.querySelector(".zw-timer__label").textContent = p.endedLabel || "Beendet"; return; }
      if (ms < 10 * 60 * 1000 && !p.ended) node.classList.add("zw-timer--urgent");
      setTimeout(render, 1000 - (Date.now() % 1000));
    }
    if (p.endsAt != null) render(); else val.textContent = p.value || "00:00:00";
    return node;
  }

  function ListingCard(p) {
    p = p || {};
    var mode = p.mode || "fixed";
    var modeLabel = { auction: "Auktion", fixed: "Festpreis", offer: "Preisvorschlag" }[mode];
    var badges = '<span class="zw-badge' + (mode === "auction" ? " zw-badge--inverse" : "") + '">' + esc(p.modeLabel || modeLabel) + "</span>" + (p.greenPick ? '<span class="zw-badge zw-badge--green">' + esc(p.greenLabel || "Grüne Wahl") + "</span>" : "");
    var price = mode === "auction"
      ? '<p class="zw-card__price zw-card__price--bid">' + esc(formatCHF(p.price)) + "<small>" + esc(p.priceLabel || "Gebot") + "</small></p>"
      : '<p class="zw-card__price">' + esc(formatCHF(p.price)) + (p.originalPrice ? '<small>neu ' + esc(formatCHF(p.originalPrice)) + "</small>" : "") + "</p>";
    var media = '<div class="zw-card__media">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : "") + "</div>";
    var node = el('<a class="zw-card" href="' + esc(p.href || "#") + '">' + media + '<div class="zw-card__badges">' + badges + "</div>" +
      '<h3 class="zw-card__title">' + esc(p.title) + "</h3>" + price +
      '<p class="zw-card__meta">' + esc([p.condition, p.location].filter(Boolean).join(" · ")) + "</p>" +
      (p.co2Saved ? '<p class="zw-card__green">spart ca. ' + esc(p.co2Saved) + " kg CO₂</p>" : "") + "</a>");
    if (mode === "auction" && p.endsAt) node.querySelector(".zw-card__badges").appendChild(AuctionTimer({ endsAt: p.endsAt, label: p.timerLabel }));
    return node;
  }

  window.Zweit = { Button: Button, Input: Input, Chip: Chip, Badge: Badge, ListingCard: ListingCard, AuctionTimer: AuctionTimer, formatCHF: formatCHF, icons: ICONS };
})();
