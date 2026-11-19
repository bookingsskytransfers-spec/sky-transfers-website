/* Sky Transfers - the chat box (stage 3 of the AI assistant, 19 Nov 2026).

   A small "Ask a question" button that opens a chat with the Sky Transfers
   assistant. The page sends the conversation to the booking server
   (assist-chat.js), which asks Claude and answers with text and, when there is
   a trip to book, a button that opens the booking form with it filled in. The
   assistant answers, quotes and hands over that link - it cannot make or
   change a booking and never takes payment.

   PUBLIC = false: the button only appears on a page opened with ?chat=preview
   (remembered for the browser session), so it can be tried on the live site
   before visitors see it. Nothing is fetched and nothing is drawn otherwise.

   The conversation is kept in this browser tab only (sessionStorage), so it
   survives the reload when a booking button is pressed. No cookies, no
   tracking, no other script. */
(function () {
  "use strict";
  var PUBLIC = false;
  var SERVER = "https://sky-transfers-booking-server.onrender.com";
  var PHONE = "+61 481 437 772", EMAIL = "info@skytransfers.com.au", SITE = "https://www.skytransfers.com.au";
  var STORE = "skyChat", MAX_CHARS = 1000;
  var d = document, w = window;
  var mem = {};
  function get(k) { if (Object.prototype.hasOwnProperty.call(mem, k)) return mem[k]; try { return w.sessionStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { mem[k] = v; try { w.sessionStorage.setItem(k, v); } catch (e) {} }

  if (/[?&]chat=preview(&|$)/.test(location.search)) set("skyChatPreview", "1");
  if (!PUBLIC && get("skyChatPreview") !== "1") return;
  if (!w.fetch || !d.body) return;

  var state = { open: false, msgs: [] };
  try {
    var saved = JSON.parse(get(STORE) || "null");
    if (saved && Array.isArray(saved.msgs)) state = { open: !!saved.open, msgs: saved.msgs.filter(function (m) {
      return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content;
    }).map(function (m) { return { role: m.role, content: m.content, links: Array.isArray(m.links) ? m.links.slice(0, 2) : [] }; }).slice(-40) };
  } catch (e) {}
  function save() { set(STORE, JSON.stringify({ open: state.open, msgs: state.msgs.slice(-40) })); }

  function el(tag, cls, text) { var n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  var CSS = [
    ".skc-open{position:fixed;right:18px;bottom:88px;z-index:200;display:flex;align-items:center;gap:8px;padding:0 16px 0 13px;height:46px;border:1px solid var(--gold,#C9A227);border-radius:23px;background:var(--navy,#101828);color:var(--navy-text,#F6F2E8);font:600 14.5px/1 Figtree,-apple-system,'Segoe UI',Arial,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.28)}",
    ".skc-open svg{width:20px;height:20px;fill:none;stroke:var(--gold,#C9A227);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}",
    ".skc-open:hover{filter:brightness(1.15)}.skc-open:focus-visible,.skc-x:focus-visible,.skc-send:focus-visible,.skc-chip:focus-visible,.skc-book:focus-visible{outline:2px solid var(--gold,#C9A227);outline-offset:2px}",
    ".skc-panel{position:fixed;right:18px;bottom:18px;z-index:300;width:380px;max-width:calc(100vw - 24px);height:600px;max-height:calc(100vh - 36px);max-height:calc(100dvh - 36px);display:flex;flex-direction:column;background:var(--card,#fff);color:var(--text,#333B4C);border:1px solid var(--line,#E5E0D2);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.32);overflow:hidden;font:15px/1.5 Figtree,-apple-system,'Segoe UI',Arial,sans-serif}",
    ".skc-panel[hidden],.skc-open[hidden]{display:none}",
    ".skc-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;background:var(--navy,#101828);color:var(--navy-text,#F6F2E8)}",
    ".skc-head b{display:block;font:400 18px/1.2 Marcellus,Georgia,serif}.skc-head span{display:block;font-size:12.5px;opacity:.8;margin-top:2px}.skc-head div{flex:1;min-width:0}",
    ".skc-x{flex:none;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer}.skc-x:hover{background:rgba(255,255,255,.12)}",
    ".skc-new{flex:none;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.35);border-radius:15px;background:transparent;color:inherit;font:inherit;font-size:12.5px;cursor:pointer}.skc-new:hover{background:rgba(255,255,255,.12)}.skc-new[hidden]{display:none}.skc-new:focus-visible{outline:2px solid var(--gold,#C9A227);outline-offset:2px}",
    ".skc-log{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px;background:var(--ground,#F7F4ED);overscroll-behavior:contain}",
    ".skc-m{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".skc-a{align-self:flex-start;background:var(--card,#fff);color:var(--ink,#141D30);border:1px solid var(--line,#E5E0D2);border-bottom-left-radius:4px}",
    ".skc-u{align-self:flex-end;background:var(--navy,#101828);color:var(--navy-text,#F6F2E8);border-bottom-right-radius:4px}",
    ".skc-n{align-self:center;max-width:100%;font-size:13.5px;color:var(--err,#B0392F);text-align:center}",
    ".skc-m a{color:inherit;text-decoration:underline}",
    ".skc-wait{color:var(--muted,#68707F);font-style:italic}",
    ".skc-links{align-self:flex-start;display:flex;flex-direction:column;gap:6px;max-width:88%}",
    ".skc-book{display:block;padding:10px 14px;border-radius:10px;background:var(--gold,#C9A227);color:#141D30;font-weight:700;text-decoration:none;text-align:center}.skc-book:hover{filter:brightness(1.07)}",
    ".skc-chips{display:flex;flex-wrap:wrap;gap:6px}",
    ".skc-chip{padding:7px 11px;border:1px solid var(--line,#E5E0D2);border-radius:16px;background:var(--card,#fff);color:var(--ink,#141D30);font:inherit;font-size:13.5px;cursor:pointer}.skc-chip:hover{border-color:var(--gold,#C9A227)}",
    ".skc-form{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--line,#E5E0D2);background:var(--card,#fff)}",
    ".skc-in{flex:1;min-width:0;resize:none;max-height:110px;overflow-y:hidden;padding:9px 11px;border:1px solid var(--line,#E5E0D2);border-radius:10px;background:var(--card,#fff);color:var(--ink,#141D30);font:inherit;font-size:16px;line-height:1.35}",
    ".skc-in:focus{outline:2px solid var(--gold,#C9A227);outline-offset:0;border-color:transparent}",
    ".skc-send{flex:none;height:42px;padding:0 15px;border:0;border-radius:10px;background:var(--navy,#101828);color:var(--navy-text,#F6F2E8);font:inherit;font-weight:700;cursor:pointer}.skc-send[disabled]{opacity:.5;cursor:default}",
    ".skc-foot{margin:0;padding:0 14px 10px;background:var(--card,#fff);color:var(--muted,#68707F);font-size:12px;line-height:1.4}.skc-foot a{color:inherit}",
    "@media (max-width:620px){.skc-open{right:14px;bottom:80px;width:54px;height:54px;padding:0;justify-content:center;border-radius:50%}.skc-open span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.skc-open svg{width:24px;height:24px}",
    ".skc-panel{left:0;right:0;bottom:0;width:auto;max-width:none;height:86vh;height:86dvh;max-height:none;border-radius:14px 14px 0 0;border-width:1px 0 0}}"
  ].join("\n");

  var openBtn, panel, log, input, sendBtn, chips, fresh, busy = false;

  /* text with our own pages, the phone number and the email made into links */
  function fill(node, text) {
    var re = /(https:\/\/www\.skytransfers\.com\.au\/[^\s<>"')\]]*[^\s<>"')\].,;:!?])|(\+61 481 437 772)|(info@skytransfers\.com\.au)/g, last = 0, m, a;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) node.appendChild(d.createTextNode(text.slice(last, m.index)));
      a = el("a", null, m[0]);
      a.href = m[1] ? m[1] : m[2] ? "tel:+61481437772" : "mailto:" + EMAIL;
      node.appendChild(a); last = m.index + m[0].length;
    }
    if (last < text.length) node.appendChild(d.createTextNode(text.slice(last)));
  }
  function bubble(role, text, links) {
    var b = el("div", "skc-m " + (role === "user" ? "skc-u" : role === "note" ? "skc-n" : "skc-a"));
    fill(b, String(text)); log.appendChild(b);
    if (links && links.length) {
      var box = el("div", "skc-links");
      links.forEach(function (l) {
        if (!l || typeof l.url !== "string" || l.url.indexOf(SITE + "/") !== 0) return;
        var a = el("a", "skc-book", l.label || "Open the booking form");
        a.href = l.url;
        a.addEventListener("click", function () { show(false); });   /* the form is under the chat box */
        box.appendChild(a);
      });
      if (box.firstChild) log.appendChild(box);
    }
    log.scrollTop = log.scrollHeight;
    return b;
  }
  function draw() {
    log.textContent = "";
    bubble("assistant", "Hi, I'm the Sky Transfers assistant. Ask me for a price, or anything about your transfer.");
    if (!state.msgs.length) {
      chips = el("div", "skc-chips");
      ["Price from Gold Coast Airport", "Which vehicle fits 6 people?", "Do you have child seats?"].forEach(function (q) {
        var c = el("button", "skc-chip", q); c.type = "button";
        c.addEventListener("click", function () { send(q); });
        chips.appendChild(c);
      });
      log.appendChild(chips);
    }
    state.msgs.forEach(function (m) { bubble(m.role, m.content, m.links); });
  }
  function send(text) {
    text = String(text || "").replace(/\s+$/, "").replace(/^\s+/, "");
    if (!text || busy) return;
    if (text.length > MAX_CHARS) { bubble("note", "That message is a little long for the chat. Please shorten it, or call or WhatsApp " + PHONE + "."); return; }
    if (chips && chips.parentNode) chips.parentNode.removeChild(chips);
    state.msgs.push({ role: "user", content: text }); save();
    fresh.hidden = false;
    bubble("user", text);
    input.value = ""; size();
    busy = true; sendBtn.disabled = true;
    var waiting = el("div", "skc-m skc-a skc-wait", "Typing…"); log.appendChild(waiting); log.scrollTop = log.scrollHeight;
    var ctl = w.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 70000);
    var body = JSON.stringify({ messages: state.msgs.slice(-20).map(function (m) { return { role: m.role, content: m.content }; }) });
    fetch(SERVER + "/assist/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().then(function (j) { return j; }, function () { return null; }); })
      .then(function (j) {
        if (j && j.ok && j.reply) { state.msgs.push({ role: "assistant", content: j.reply, links: Array.isArray(j.links) ? j.links.slice(0, 2) : [] }); save(); done(); bubble("assistant", j.reply, j.links); }
        else fail(j && j.message);
      }, function () { fail(); });
    function done() { clearTimeout(timer); busy = false; sendBtn.disabled = false; if (waiting.parentNode) waiting.parentNode.removeChild(waiting); }
    /* An unanswered message is not kept: it would be sent again with the next one. It goes back in the box to send again. */
    function fail(msg) {
      done();
      var lastMsg = state.msgs[state.msgs.length - 1];
      if (lastMsg && lastMsg.role === "user" && lastMsg.content === text) { state.msgs.pop(); save(); if (!input.value) { input.value = text; size(); } }
      bubble("note", msg || "Sorry, the chat could not connect just now. Please call or WhatsApp " + PHONE + " - we answer 24 hours a day.");
    }
  }
  function size() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; input.style.overflowY = input.scrollHeight > 110 ? "auto" : "hidden"; }
  function show(yes) {
    state.open = yes; save();
    panel.hidden = !yes; openBtn.hidden = yes;
    openBtn.setAttribute("aria-expanded", yes ? "true" : "false");
    /* on a phone the keyboard would cover the conversation at once, so the visitor taps the box when ready */
    if (yes) { log.scrollTop = log.scrollHeight; if (w.innerWidth > 620) { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } } }
    else { try { openBtn.focus({ preventScroll: true }); } catch (e) { openBtn.focus(); } }
  }
  function build() {
    var st = el("style"); st.textContent = CSS; d.head.appendChild(st);
    openBtn = el("button", "skc-open"); openBtn.type = "button"; openBtn.setAttribute("aria-haspopup", "dialog"); openBtn.setAttribute("aria-label", "Ask a question - chat with the Sky Transfers assistant");
    var ns = "http://www.w3.org/2000/svg", svg = d.createElementNS(ns, "svg"), path = d.createElementNS(ns, "path");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", "M4 5.5h16v10.5H9.5L5.5 19.5V16H4z"); svg.appendChild(path);
    openBtn.appendChild(svg); openBtn.appendChild(el("span", null, "Ask a question"));
    panel = el("div", "skc-panel"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Chat with the Sky Transfers assistant"); panel.hidden = true;
    var head = el("div", "skc-head"), title = el("div");
    title.appendChild(el("b", null, "Ask Sky Transfers")); title.appendChild(el("span", null, "AI assistant · prices and answers"));
    var x = el("button", "skc-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close the chat");
    fresh = el("button", "skc-new", "New chat"); fresh.type = "button"; fresh.hidden = !state.msgs.length;
    fresh.addEventListener("click", function () { if (busy) return; state.msgs = []; save(); draw(); fresh.hidden = true; input.focus(); });
    head.appendChild(title); head.appendChild(fresh); head.appendChild(x);
    log = el("div", "skc-log"); log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite");
    var form = el("form", "skc-form"); form.setAttribute("novalidate", "");
    input = el("textarea", "skc-in"); input.rows = 1; input.maxLength = MAX_CHARS; input.placeholder = "Type your question"; input.setAttribute("aria-label", "Your question");
    sendBtn = el("button", "skc-send", "Send"); sendBtn.type = "submit";
    form.appendChild(input); form.appendChild(sendBtn);
    var foot = el("p", "skc-foot");
    fill(foot, "An AI assistant - it can make mistakes, and it cannot make or change a booking. Please don't type card details. To talk to us, call or WhatsApp " + PHONE + ".");
    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(foot);
    d.body.appendChild(openBtn); d.body.appendChild(panel);
    openBtn.addEventListener("click", function () { show(true); });
    x.addEventListener("click", function () { show(false); });
    form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
    input.addEventListener("input", size);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(input.value); } });
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") show(false); });
    draw();
    if (state.open) { panel.hidden = false; openBtn.hidden = true; openBtn.setAttribute("aria-expanded", "true"); log.scrollTop = log.scrollHeight; } else openBtn.setAttribute("aria-expanded", "false");
  }
  function start() {
    var known = get("skyChatOn"), t = Date.now();
    if (known && t - parseInt(known, 10) < 5 * 60 * 1000) return build();
    fetch(SERVER + "/assist/chat/status").then(function (r) { return r.json(); }).then(function (j) { if (j && j.on) { set("skyChatOn", String(Date.now())); build(); } }, function () {});
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})();
