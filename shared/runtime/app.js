/* SparkForge App runtime (vanilla JS) — renders an app spec in exported/deployed apps. */
(function () {
  "use strict";
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  window.renderApp = function (spec) {
    var root = document.getElementById("app");
    var state = { screen: spec.startScreen, item: null, vars: {}, search: {} };
    var color = spec.theme.color;
    function fill(text) {
      return String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, k) {
        if (state.item && k in state.item) { var v = state.item[k]; return Array.isArray(v) ? v.join(", ") : String(v); }
        return state.vars[k] || "";
      });
    }
    function go(id) { if (spec.screens.some(function (s) { return s.id === id; })) { state.screen = id; render(); } }
    function render() {
      root.innerHTML = "";
      var phone = el("div", "max-width:400px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:#fff;font-family:system-ui,sans-serif");
      phone.appendChild(el("div", "padding:14px 16px;color:#fff;font-weight:900;background:" + color, spec.theme.emoji + " " + spec.title));
      var body = el("div", "flex:1;padding:16px;display:flex;flex-direction:column;gap:12px");
      var screen = spec.screens.find(function (s) { return s.id === state.screen; });
      if (!screen) body.appendChild(el("p", "", "This screen doesn't exist."));
      else screen.blocks.forEach(function (b) {
        if (b.type === "heading") body.appendChild(el("h2", "margin:0", fill(b.text)));
        else if (b.type === "text") body.appendChild(el("p", "margin:0", fill(b.text)));
        else if (b.type === "image") body.appendChild(el("div", "font-size:72px;text-align:center", fill(b.emoji || "🖼️")));
        else if (b.type === "card") {
          var parts = fill(b.text).split("|"), c = el("div", "border-radius:16px;padding:14px;background:#f8f5ff");
          c.appendChild(el("div", "font-size:26px", b.emoji)); c.appendChild(el("b", "", parts[0]));
          if (parts.length > 1) c.appendChild(el("p", "margin:4px 0 0", parts.slice(1).join("|")));
          body.appendChild(c);
        } else if (b.type === "button") {
          var btn = el("button", "border:0;color:#fff;border-radius:14px;padding:12px;font-weight:900;font-size:16px;background:" + color, (b.emoji ? b.emoji + " " : "") + (b.text || "Go"));
          btn.onclick = function () { go(b.goTo); }; body.appendChild(btn);
        } else if (b.type === "search") {
          var inp = el("input", "padding:12px;border-radius:12px;border:2px solid #e8e4f0;font-size:16px");
          inp.placeholder = "🔍 Search…"; inp.value = state.search[state.screen] || "";
          inp.oninput = function () { state.search[state.screen] = inp.value; render(); var n = root.querySelector("input"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
          body.appendChild(inp);
        } else if (b.type === "list") {
          var col = spec.collections.find(function (x) { return x.name === b.collection; });
          var q = (state.search[state.screen] || "").toLowerCase();
          ((col && col.items) || []).filter(function (it) { return !q || (it.title + " " + it.subtitle).toLowerCase().indexOf(q) >= 0; }).forEach(function (it) {
            var row = el("button", "display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:#f8f5ff;border:0;text-align:left;width:100%;cursor:pointer");
            row.appendChild(el("span", "font-size:28px", it.emoji));
            var t = el("span", ""); t.appendChild(el("b", "", it.title)); t.appendChild(el("br")); t.appendChild(el("small", "color:#8a87a3", it.subtitle));
            row.appendChild(t);
            row.onclick = function () { state.item = it; if (b.goTo) go(b.goTo); else render(); };
            body.appendChild(row);
          });
        } else if (b.type === "input") {
          var lab = el("label", "display:flex;flex-direction:column;gap:6px;font-weight:800", b.text || "Type here");
          var input = el("input", "padding:12px;border-radius:12px;border:2px solid #e8e4f0;font-size:16px");
          input.value = state.vars[b.variable] || "";
          input.onchange = function () { state.vars[b.variable] = input.value; render(); };
          lab.appendChild(input); body.appendChild(lab);
        } else if (b.type === "facts" && state.item && state.item.facts.length) {
          var ul = el("ul", "");
          state.item.facts.forEach(function (f) { ul.appendChild(el("li", "margin-bottom:6px", "💡 " + f)); });
          body.appendChild(ul);
        } else if (b.type === "aiGuide") {
          body.appendChild(el("div", "border-radius:16px;padding:14px;background:#f8f5ff", "🤖 The AI guide works inside SparkForge."));
        }
      });
      phone.appendChild(body);
      var nav = spec.screens.filter(function (s) { return s.inNav; });
      if (nav.length > 1) {
        var bar = el("div", "display:flex;border-top:1px solid #e8e4f0;position:sticky;bottom:0;background:#fff");
        nav.forEach(function (s) {
          var b = el("button", "flex:1;border:0;background:#fff;padding:8px 2px;font-weight:800;font-size:12px;color:" + (s.id === state.screen ? "#1d1b2e" : "#8a87a3"), s.emoji + " " + s.title);
          b.onclick = function () { go(s.id); }; bar.appendChild(b);
        });
        phone.appendChild(bar);
      }
      root.appendChild(phone);
    }
    render();
  };
})();
