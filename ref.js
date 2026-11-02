/* Referral links (the affiliate programme, 3 Nov 2026).
   A page opened as /?ref=palmbeachhost remembers "palmbeachhost" for 30 days,
   in a first-party cookie and in localStorage - nothing is sent anywhere until
   the guest books, when the booking form passes it to our own server. The last
   link clicked wins. Whether the code is real is decided by the server at
   booking time, never here: an unknown code is simply ignored, with no error
   for the guest. */
(function () {
  var KEY = "sky_ref", DAYS = 30, RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  function norm(v) { v = String(v || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, ""); return RE.test(v) ? v : ""; }
  function save(code) {
    var exp = Date.now() + DAYS * 864e5;
    try { document.cookie = KEY + "=" + code + "; max-age=" + DAYS * 86400 + "; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify({ code: code, exp: exp })); } catch (e) {}
  }
  function read() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY) || "null");
      if (j && j.exp > Date.now() && norm(j.code)) return norm(j.code);
    } catch (e) {}
    var m = document.cookie.match(/(?:^|;\s*)sky_ref=([^;]+)/);
    return m ? norm(decodeURIComponent(m[1])) : "";
  }
  var found = "";
  try { found = norm(new URLSearchParams(location.search).get("ref")); } catch (e) {}
  if (found) {
    save(found);
    /* Take ?ref= off the address once it is remembered, so the page a guest
       goes on to share or bookmark is the plain one (the canonical URL). */
    try {
      var u = new URL(location.href); u.searchParams.delete("ref");
      history.replaceState(history.state, "", u.pathname + (u.search || "") + u.hash);
    } catch (e) {}
  }
  window.skyRef = read;
})();
