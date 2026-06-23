/* =========================================================================
   NS-Push — Cloudflare Worker
   Görevi: uygulamadan "şu kişiye bildirim gönder" isteği gelince,
   o kişinin Firebase'deki token'larını okuyup FCM ile push gönderir.

   GEREKLİ SECRET'LAR (Cloudflare > Settings > Variables and Secrets):
     - SERVICE_EMAIL   : JSON'daki "client_email"
     - PRIVATE_KEY     : JSON'daki "private_key" (BEGIN...END dahil, tamamı)
     - PROJECT_ID      : ns-mesaj-b19a7
     - DB_URL          : https://ns-mesaj-b19a7-default-rtdb.firebaseio.com
========================================================================= */

export default {
  async fetch(request, env) {
    // CORS (tarayıcıdan çağrılacağı için)
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return new Response("NS-Push çalışıyor", { headers: cors });

    try {
      const body = await request.json();
      const to = (body.to || "").toString();          // alıcı kullanıcı adı
      const from = (body.from || "").toString();       // gönderen kullanıcı adı
      const title = (body.title || "NS-Mesaj").toString();
      const text = (body.body || "Yeni mesaj").toString();
      if (!to) return json({ ok: false, error: "alıcı yok" }, cors);

      // 0) Alıcı, göndereni sessize aldıysa push gönderme
      if (from) {
        try {
          const muteRes = await fetch(`${env.DB_URL}/prefs/${to}/muted/${from}.json`);
          const muted = await muteRes.json();
          if (muted === true) return json({ ok: true, sent: 0, note: "muted" }, cors);
        } catch (e) {}
      }

      // 1) Alıcının token'larını Firebase'den oku
      const tokRes = await fetch(`${env.DB_URL}/pushTokens/${to}.json`);
      const tokens = await tokRes.json();
      if (!tokens) return json({ ok: true, sent: 0, note: "token yok" }, cors);
      const tokenList = Object.keys(tokens);

      // 2) Google erişim token'ı al (servis hesabıyla)
      const accessToken = await getAccessToken(env);

      // 3) Her token'a FCM v1 ile push gönder
      let sent = 0;
      for (const t of tokenList) {
        const r = await fetch(
          `https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`,
          {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + accessToken,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: {
                token: t,
                data: { title: String(title || "NS-Mesaj"), body: String(text || "Yeni mesaj") },
                webpush: { fcm_options: { link: "./ns-mesaj.html" } }
              }
            })
          }
        );
        if (r.ok) sent++;
        else {
          // geçersiz token'ı temizle
          if (r.status === 404 || r.status === 400) {
            await fetch(`${env.DB_URL}/pushTokens/${to}/${t}.json`, { method: "DELETE" });
          }
        }
      }
      return json({ ok: true, sent }, cors);
    } catch (e) {
      return json({ ok: false, error: e.message }, cors);
    }
  }
};

function json(obj, cors) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json", ...cors }
  });
}

/* ---- Servis hesabıyla OAuth2 access token üret (JWT imzala) ---- */
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.SERVICE_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;

  const key = await importKey(env.PRIVATE_KEY);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token alınamadı: " + JSON.stringify(data));
  return data.access_token;
}

async function importKey(pem) {
  let s = pem.replace(/\\n/g, "\n");          // düz metin \n -> gerçek satır
  s = s.replace(/-----[^-]*-----/g, "");       // BEGIN/END satırlarını (her dilde) sil
  s = s.replace(/[^A-Za-z0-9+/=]/g, "");       // SADECE base64 karakterleri bırak
  const der = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
}

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
