# Bot WhatsApp → OpenCode Agent (Render Free)

Bot WhatsApp satu pengguna yang meneruskan perintah ke agen OpenCode di dalam satu Web Service Render gratis. Auth state dan transkrip disimpan di Supabase.

## Environment variable

Isi di Render Dashboard → Environment:

| Nama | Keterangan |
|---|---|
| `PORT` | Default `3000`. Render biasanya mengisi otomatis. |
| `ALLOWED_GROUP_JID` | JID grup WhatsApp tempat perintah dikirim, mis. `120363000000000000@g.us`. |
| `ALLOWED_JID` | JID nomor master di dalam grup itu, mis. `6281200000000@s.whatsapp.net`. |
| `BOOTSTRAP_TOKEN` | Token rahasia untuk membuka `/qr`. |
| `SUPABASE_URL` | URL project Supabase. |
| `SUPABASE_KEY` | Kunci anon/service role Supabase. |
| `OPENROUTER_API_KEY` | API key OpenRouter. |

Jangan pernah menaruh nilai ini di chat, file, atau log.

## Cara mendapatkan JID grup dan nomor

1. Di WhatsApp, buat grup dengan minimal **3 peserta** (master, kontak tambahan, dan akun yang dipakai Baileys).
2. Nomor yang dipakai Baileys adalah nomor master sendiri sebagai perangkat tertaut, jadi bot tidak ditambahkan sebagai anggota terpisah.
3. JID grup berakhir dengan `@g.us`, JID personal berakhir dengan `@s.whatsapp.net`.

## Mendapatkan JID grup dan nomor

Script `list-jids` memakai auth state yang sama dengan bot, sehingga QR hanya perlu dipindai sekali.

PowerShell:

```powershell
$env:SUPABASE_URL="https://fgwbuirplhzdurtdwolm.supabase.co"
$env:SUPABASE_KEY="<secret key dari Supabase>"
npm run list-jids
```

Jika auth belum ada, QR akan muncul di terminal — pindai lewat WhatsApp → **Perangkat Tertaut** → **Tautkan perangkat**. Setelah terhubung, script mencetak nama grup, JID grup (`...@g.us`), dan JID semua peserta (`...@s.whatsapp.net`). Jangan menaruh secret key ke dalam file.

## Supabase

1. Buat project Supabase baru (tier gratis).
2. Buka SQL Editor, jalankan isi `supabase/schema.sql`.
3. Salin Project URL dan key ke environment variable Render.

## Deploy ke Render

1. Push repositori ini ke GitHub.
2. Di Render, buat **New → Web Service**, pilih repositori tersebut.
3. Runtime: **Docker**. Plan: **Free**.
4. Isi semua environment variable di atas.
5. Deploy. Tunggu hingga status *Live*.

## Scan QR

1. Buka `https://<nama-service>.onrender.com/qr?token=<BOOTSTRAP_TOKEN>` di browser.
2. Di WhatsApp → **Perangkat Tertaut** → **Tautkan perangkat**, lalu pindai QR.
3. Setelah berhasil, endpoint `/qr` otomatis mati.

## Keepalive

Render Free mematikan service setelah 15 menit tanpa traffic. Pasang monitor gratis (UptimeRobot atau cron-job.org) yang mengunjungi `https://<nama-service>.onrender.com/health` setiap **5 menit**.

Tanpa keepalive, bot akan mati dan pesan tidak dibangunkan oleh WhatsApp.

## Perintah di grup

| Perintah | Fungsi |
|---|---|
| `/help` | Daftar perintah |
| `/status` | Session ID dan model yang dipakai |
| `/model` | Nama model LLM |
| `/reset` | Hapus riwayat percakapan |

Pesan selain perintah diteruskan ke agen OpenCode. Balasan bot diawali `🤖`.

## Persona balasan

Bot menjawab dengan sapaan **master**, bahasa Indonesia formal, dan gaya ringkas tanpa basa-basi. Persona dan aturan dimuat dari direktori `context/` saat bot dimulai. Skill teks cloud dipilih otomatis dari isi pesan; skill yang membutuhkan `ffmpeg`, `browser`, `see`, `blender`, atau `winapp-*` tidak dijalankan di cloud. Bot tidak memiliki akses ke PC master. `/reset` memasang kembali persona pada sesi berikutnya.

## Kuota dan risiko

- OpenRouter model gratis: **50 request/hari** tanpa pembelian kredit. Jika habis, bot membalas pesan kuota.
- Jangan menambahkan model berbayar ke fallback mana pun.
- Baileys bukan API resmi WhatsApp; ada risiko nomor terkena banned. Pemakaian dibatasi satu pengguna dan tanpa broadcast.
- Render Free memiliki 0.1 CPU / 512 MB RAM dan batas 750 jam per bulan.
- Grup minimal 3 peserta; peserta lain dapat melihat perintah dan balasan.

## Pengembangan lokal

```bash
npm install
cp .env.example .env
npm test
npm run typecheck
npm run build
npm start
```
