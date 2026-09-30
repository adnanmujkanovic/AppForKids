/* SparkForge Engine — a tiny game engine kids can program in real JavaScript.
 * Runs inside a sandboxed iframe (Code Mode) and in exported/deployed games.
 *
 *   const game = createGame({ ...config });
 *   game.onCollect((thing) => { game.score = game.score + thing.points; });
 *   game.onHit((danger) => { game.lives = game.lives - 1; });
 *   game.start();
 */
(function () {
  "use strict";
  var W = 360, H = 480, HIT = 30;

  function report(type, data) {
    try { parent.postMessage(Object.assign({ sparkforge: type }, data || {}), "*"); } catch (e) { /* standalone */ }
  }

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  window.createGame = function (cfg) {
    cfg = cfg || {};
    var kind = cfg.kind || "catcher";
    var theme = cfg.theme || { sky: "#1b1f4b", ground: "#3f7d5a", decorations: [] };
    var player = cfg.player || { emoji: "🙂", name: "Player", speed: 5 };
    var collectibles = cfg.collectibles || [];
    var hazards = cfg.hazards || [];
    var rules = cfg.rules || { lives: 3, timeLimit: 0 };
    var levels = cfg.levels && cfg.levels.length ? cfg.levels : [{ name: "Level 1", targetScore: 10, spawnRate: 3, hazardSpeed: 3 }];
    var quiz = cfg.quiz || [];
    var hooks = { start: [], collect: [], hit: [], frame: [], level: [], answer: [] };

    var root = document.getElementById("game") || document.body;
    root.innerHTML = "";
    var wrap = el("div", "position:relative;width:100%;max-width:420px;margin:0 auto;border-radius:20px;overflow:hidden;background:#000;touch-action:none;user-select:none;font-family:system-ui,sans-serif");
    var canvas = el("canvas", "display:block;width:100%;aspect-ratio:" + W + "/" + H);
    var hud = el("div", "position:absolute;top:8px;left:8px;right:8px;display:flex;justify-content:space-between;gap:6px;pointer-events:none;color:#fff;font-weight:800;font-size:14px");
    var toast = el("div", "position:absolute;left:10px;right:10px;bottom:10px;background:rgba(255,255,255,.95);color:#1d1b2e;border-radius:12px;padding:8px 10px;font-weight:700;font-size:13px;display:none");
    var overlay = el("div", "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(15,12,40,.75);color:#fff;text-align:center;padding:20px");
    var quizBox = el("div", "position:absolute;inset:44px 12px 12px;display:none;flex-direction:column;gap:8px;justify-content:center");
    wrap.appendChild(canvas); wrap.appendChild(hud); wrap.appendChild(quizBox); wrap.appendChild(toast); wrap.appendChild(overlay);
    root.appendChild(wrap);
    var pad = el("div", "display:flex;justify-content:center;gap:10px;margin-top:10px");
    root.appendChild(pad);

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    var g = canvas.getContext("2d"); g.scale(dpr, dpr);

    var s = { px: W / 2, py: kind === "explorer" ? H / 2 : H - 60, things: [], spawnAcc: 0, invuln: 0, keys: {}, target: null, running: false, quizIndex: 0, seen: {} };
    var toastTimer = 0;

    var game = {
      score: 0, lives: rules.lives, level: 0, time: rules.timeLimit,
      player: player, config: cfg,
      onStart: function (f) { hooks.start.push(f); return game; },
      onCollect: function (f) { hooks.collect.push(f); return game; },
      onHit: function (f) { hooks.hit.push(f); return game; },
      onFrame: function (f) { hooks.frame.push(f); return game; },
      onLevel: function (f) { hooks.level.push(f); return game; },
      onAnswer: function (f) { hooks.answer.push(f); return game; },
      target: function () { return levels[game.level] ? levels[game.level].targetScore : Infinity; },
      levelName: function () { return levels[game.level] ? levels[game.level].name : ""; },
      say: function (text) {
        toast.textContent = String(text); toast.style.display = "block";
        clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.style.display = "none"; }, 3200);
      },
      spawn: function (emoji, opts) {
        opts = opts || {};
        var good = opts.good !== false;
        s.things.push({ x: opts.x != null ? opts.x : 20 + Math.random() * (W - 40), y: opts.y != null ? opts.y : -20,
          vx: opts.vx || 0, vy: opts.vy != null ? opts.vy : (kind === "catcher" ? 90 : 0), emoji: emoji, good: good,
          points: opts.points != null ? opts.points : 1, name: opts.name || emoji, fact: opts.fact || "", moves: !!opts.moves });
      },
      nextLevel: function () {
        if (!s.running) return;
        if (game.level >= levels.length - 1) return game.win("You beat every level!");
        game.level += 1; game.time = rules.timeLimit;
        banner("⬆️ " + game.levelName());
        if (kind === "explorer") populate();
        hooks.level.forEach(function (f) { f(game.level); });
      },
      win: function (msg) { end(true, msg || "You win!"); },
      over: function (msg) { end(false, msg || "Game over"); },
      start: function () { showStart(); return game; }
    };
    window.game = game;

    function run(list, arg) {
      for (var i = 0; i < list.length; i++) {
        try { list[i](arg, game); } catch (e) { report("error", { message: e.message, stack: String(e.stack || "") }); throw e; }
      }
    }

    function banner(text) {
      var b = el("div", "position:absolute;top:40%;left:0;right:0;text-align:center;font-size:30px;font-weight:900;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.3);pointer-events:none", text);
      wrap.appendChild(b); setTimeout(function () { b.remove(); }, 1400);
    }

    function button(label, fn) {
      var b = el("button", "background:#5b3df5;color:#fff;border:0;border-radius:14px;padding:12px 24px;font-size:18px;font-weight:900;cursor:pointer", label);
      b.onclick = fn; return b;
    }

    function showStart() {
      overlay.innerHTML = ""; overlay.style.display = "flex";
      overlay.appendChild(el("div", "font-size:54px", player.emoji));
      overlay.appendChild(el("h2", "margin:0", cfg.title || "My Game"));
      if (cfg.goal) overlay.appendChild(el("p", "margin:0;max-width:280px", cfg.goal));
      overlay.appendChild(button("▶ PLAY", begin));
    }

    function end(won, msg) {
      if (!s.running) return;
      s.running = false; quizBox.style.display = "none"; pad.innerHTML = "";
      overlay.innerHTML = ""; overlay.style.display = "flex";
      overlay.appendChild(el("div", "font-size:54px", won ? "🏆" : "💥"));
      overlay.appendChild(el("h2", "margin:0", won ? "You win!" : "Game over"));
      overlay.appendChild(el("p", "margin:0;max-width:280px", msg));
      overlay.appendChild(el("p", "margin:0", "Score: " + game.score));
      overlay.appendChild(button("↻ Play again", begin));
      report("end", { result: won ? "won" : "lost", score: game.score });
    }

    function populate() {
      var lv = levels[game.level] || { spawnRate: 3, hazardSpeed: 3 };
      s.things = [];
      var n = 4 + lv.spawnRate * 2;
      function free() {
        for (var i = 0; i < 30; i++) {
          var x = 30 + Math.random() * (W - 60), y = 70 + Math.random() * (H - 100);
          if (Math.hypot(x - s.px, y - s.py) > 90) return { x: x, y: y };
        }
        return { x: 40, y: 80 };
      }
      for (var i = 0; i < n && collectibles.length; i++) {
        var c = collectibles[i % collectibles.length], p = free();
        game.spawn(c.emoji, { x: p.x, y: p.y, vy: 0, points: c.points, name: c.name, fact: c.fact });
      }
      var hn = Math.min(8, hazards.length * (1 + game.level));
      for (var j = 0; j < hn; j++) {
        var h = hazards[j % hazards.length], q = free(), sp = 20 + lv.hazardSpeed * 12, a = Math.random() * Math.PI * 2;
        game.spawn(h.emoji, { x: q.x, y: q.y, good: false, vx: h.moves ? Math.cos(a) * sp : 0, vy: h.moves ? Math.sin(a) * sp : 0, name: h.name, moves: h.moves });
      }
    }

    function begin() {
      game.score = 0; game.lives = rules.lives; game.level = 0; game.time = rules.timeLimit;
      s.px = W / 2; s.py = kind === "explorer" ? H / 2 : H - 60; s.things = []; s.spawnAcc = 0; s.invuln = 0; s.target = null; s.quizIndex = 0; s.seen = {};
      overlay.style.display = "none"; s.running = true;
      if (kind === "explorer") populate();
      buildPad();
      banner(game.levelName());
      run(hooks.start);
      if (kind === "quiz") showQuestion();
    }

    function buildPad() {
      pad.innerHTML = "";
      if (kind === "quiz") return;
      var dirs = kind === "explorer" ? [["⬆️", "arrowup"], ["⬅️", "arrowleft"], ["⬇️", "arrowdown"], ["➡️", "arrowright"]] : [["⬅️", "arrowleft"], ["➡️", "arrowright"]];
      dirs.forEach(function (d) {
        var b = el("button", "width:60px;height:52px;border-radius:14px;border:1px solid #e8e4f0;background:#fff;font-size:22px;touch-action:none", d[0]);
        b.onpointerdown = function () { s.target = null; s.keys[d[1]] = true; };
        b.onpointerup = b.onpointerleave = b.onpointercancel = function () { s.keys[d[1]] = false; };
        pad.appendChild(b);
      });
    }

    function showQuestion() {
      var q = quiz[s.quizIndex];
      quizBox.innerHTML = ""; quizBox.style.display = "flex";
      if (!q) {
        var final = levels[levels.length - 1].targetScore;
        return game.score >= final ? game.win("Quiz complete!") : game.over("Out of questions — you needed " + final + " points.");
      }
      quizBox.appendChild(el("div", "background:rgba(255,255,255,.95);color:#1d1b2e;padding:14px;border-radius:14px;font-weight:900;text-align:center", q.question));
      q.options.forEach(function (o, i) {
        var b = el("button", "background:#fff;border:0;border-radius:12px;padding:12px;font-weight:800;font-size:15px;cursor:pointer", o);
        b.onclick = function () {
          var correct = i === q.answer;
          b.style.background = correct ? "#b8f0dc" : "#ffd0ca";
          if (hooks.answer.length) run(hooks.answer, { correct: correct, question: q });
          else { if (correct) game.score += 10; else if (rules.lives) game.lives -= 1; }
          if (q.explanation) game.say((correct ? "✅ " : "❌ ") + q.explanation);
          setTimeout(function () {
            if (!s.running) return;
            if (rules.lives && game.lives <= 0) return game.over("Out of lives!");
            if (game.score >= game.target() && game.level < levels.length - 1) game.nextLevel();
            s.quizIndex += 1; showQuestion();
          }, 900);
        };
        quizBox.appendChild(b);
      });
    }

    window.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].indexOf(k) >= 0) e.preventDefault();
      s.keys[k] = true; s.target = null;
    });
    window.addEventListener("keyup", function (e) { s.keys[e.key.toLowerCase()] = false; });
    function point(e) {
      if (!s.running) return;
      if (e.type === "pointermove" && e.buttons === 0 && e.pointerType !== "mouse") return;
      var r = canvas.getBoundingClientRect();
      s.target = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    }
    canvas.addEventListener("pointerdown", point);
    canvas.addEventListener("pointermove", point);

    function step(dt) {
      if (!s.running || kind === "quiz") return;
      var lv = levels[game.level] || { spawnRate: 3, hazardSpeed: 3 };
      var speed = (player.speed || 0) * 34, k = s.keys;
      var dx = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0);
      var dy = kind === "explorer" ? (k.arrowdown || k.s ? 1 : 0) - (k.arrowup || k.w ? 1 : 0) : 0;
      if (!dx && !dy && s.target) {
        var tx = s.target.x - s.px, ty = kind === "explorer" ? s.target.y - s.py : 0, d = Math.hypot(tx, ty);
        if (d > 6) { dx = tx / d; dy = ty / d; }
      }
      s.px = Math.max(20, Math.min(W - 20, s.px + dx * speed * dt));
      if (kind === "explorer") s.py = Math.max(70, Math.min(H - 20, s.py + dy * speed * dt));

      if (kind === "catcher" && (collectibles.length || hazards.length)) {
        s.spawnAcc += dt * (0.2 + lv.spawnRate * 0.2);
        while (s.spawnAcc >= 1) {
          s.spawnAcc -= 1;
          var chance = hazards.length ? Math.min(0.45, hazards.length / (hazards.length + collectibles.length)) : 0;
          if (collectibles.length && Math.random() >= chance) {
            var c = collectibles[Math.floor(Math.random() * collectibles.length)];
            game.spawn(c.emoji, { vy: 70 + game.level * 12, points: c.points, name: c.name, fact: c.fact });
          } else if (hazards.length) {
            var h = hazards[Math.floor(Math.random() * hazards.length)];
            game.spawn(h.emoji, { good: false, vy: 50 + lv.hazardSpeed * 22, vx: h.moves ? (Math.random() - 0.5) * 80 : 0, name: h.name, moves: h.moves });
          }
        }
      }
      s.invuln = Math.max(0, s.invuln - dt);
      var keep = [];
      for (var i = 0; i < s.things.length; i++) {
        var t = s.things[i];
        t.x += t.vx * dt; t.y += t.vy * dt;
        if (t.moves) {
          if (t.x < 20 || t.x > W - 20) t.vx *= -1;
          if (kind === "explorer" && (t.y < 70 || t.y > H - 20)) t.vy *= -1;
        }
        var hit = Math.hypot(t.x - s.px, t.y - s.py) < HIT;
        if (hit && t.good) {
          if (hooks.collect.length) run(hooks.collect, t);
          else { game.score += t.points; if (t.fact && !s.seen[t.name]) { s.seen[t.name] = 1; game.say(t.emoji + " " + t.fact); } }
          if (!s.running) return;
          continue;
        }
        if (hit && !t.good && s.invuln <= 0) {
          s.invuln = 1.2;
          if (hooks.hit.length) run(hooks.hit, t);
          else { game.lives -= 1; if (game.lives <= 0) game.over("The " + t.name.toLowerCase() + " got you!"); }
          if (!s.running) return;
          if (kind === "catcher") continue;
        }
        if (t.y < H + 30) keep.push(t);
      }
      s.things = keep;
      if (rules.timeLimit) { game.time -= dt; if (game.time <= 0) return game.over("Time's up! ⏱️"); }
      if (hooks.frame.length) run(hooks.frame, dt);
      else if (game.score >= game.target()) game.nextLevel();
      if (kind === "explorer" && s.running && !s.things.some(function (x) { return x.good; }) && game.score < game.target()) {
        game.over("You collected everything, but there weren't enough points to finish the level!");
      }
    }

    function draw() {
      g.fillStyle = kind === "explorer" ? theme.ground : theme.sky; g.fillRect(0, 0, W, H);
      g.fillStyle = kind === "explorer" ? theme.sky : theme.ground;
      if (kind === "explorer") g.fillRect(0, 0, W, 50); else g.fillRect(0, H - 34, W, 34);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.globalAlpha = 0.55; g.font = "26px serif";
      (theme.decorations || []).forEach(function (d, i) { g.fillText(d, ((i * 97) % 300) + 30, kind === "explorer" ? ((i * 151) % 360) + 80 : H - 24 - (i % 2) * 8); });
      g.globalAlpha = 1; g.font = "30px serif";
      s.things.forEach(function (t) { g.fillText(t.emoji, t.x, t.y); });
      if (kind !== "quiz") {
        g.globalAlpha = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 ? 0.3 : 1;
        g.font = "40px serif"; g.fillText(player.emoji, s.px, s.py); g.globalAlpha = 1;
      }
      var hearts = rules.lives ? "❤️".repeat(Math.max(0, Math.min(game.lives, 6))) : "";
      hud.innerHTML = "";
      [ "⭐ " + game.score + (isFinite(game.target()) ? " / " + game.target() : ""), game.levelName(), hearts, rules.timeLimit ? "⏱️ " + Math.max(0, Math.ceil(game.time)) : "" ]
        .forEach(function (txt) { if (txt) hud.appendChild(el("span", "background:rgba(0,0,0,.45);padding:3px 9px;border-radius:999px", txt)); });
    }

    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      try { step(dt); } catch (e) { s.running = false; }
      draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return game;
  };

  window.addEventListener("error", function (e) {
    report("error", { message: e.message, line: e.lineno });
  });
  report("ready");
})();
