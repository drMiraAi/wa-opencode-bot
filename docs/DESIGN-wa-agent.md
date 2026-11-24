# Desain: Balasan WA Setara Agen OpenCode (Cloud)

## Tujuan

Bot di grup `OpenCode Ai` membalas chat master dengan tiga sifat yang sama seperti sesi OpenCode lokal:

1. **Persona & bahasa** — menyapa `master`, bahasa Indonesia formal, gaya ultracave ringkas (jawab dulu, basa-basi buang).
2. **Aturan global & memori** — mengikuti `AGENTS.md` global/project dan status skill aktif.
3. **Skill otomatis** — memilih skill teks yang cocok tanpa master mengetik perintah.

## Keputusan

| Hal | Keputusan |
|---|---|
| Lokasi agen | Tetap di Render (cloud), tanpa PC master |
| Model | `openrouter/free-router` yang sudah ada; persona mengikuti sesi ini |
| Chat | Grup `OpenCode Ai` (`ALLOWED_GROUP_JID`), allowlist tidak diubah |
| Akses PC | **Tidak** — tanpa file, shell, browser, atau tool lokal |
| Pendekatan | A: Cloud Context Pack |

Big Pickle tidak bisa dipanggil langsung dari Render. Yang direplikasi adalah persona, aturan, dan perilaku, bukan bobot model.

## Arsitektur

File baru:

- `src/context.ts` — menyusun *context pack* dan memilih skill card.
- `context/global.md` — salinan ringkas aturan global (`AGENTS.md`): sapaan, ultracave, checklist pilihan, pengumuman skill, verifikasi sebelum klaim selesai.
- `context/project.md` — ringkasan state proyek yang relevan (HANDOFF YouTube Autopilot dan Reels), bukan salinan penuh.
- `context/skills-cloud.md` — daftar skill teks yang bisa dipakai di cloud beserta pemicunya.
- `tests/context.test.ts` — uji penyusunan konteks dan pemilihan skill.

Perubahan:

- `src/agent.ts` — saat sesi baru dibuat, `sdk.sessions.prompt` menerima context pack sebagai awalan. Sesi lama tetap memakai konteks lama sampai `/reset`.
- `src/config.ts` — tidak menambah env wajib baru. Path context relatif terhadap direktori kerja bot.
- `README.md` — dokumentasi perilaku baru dan batasannya.

Alur:

1. `routeMessage` menerima pesan dari JID yang diizinkan.
2. `createAgent.prompt` mengecek sesi. Jika baru, susun context pack dan kirim sebagai awalan prompt pertama.
3. Context pack berisi: persona, aturan global ringkas, ringkasan proyek, dan indeks skill teks.
4. Setiap pesan berikutnya hanya memakai riwayat sesi; tidak menyuntik ulang context penuh.
5. `/reset` menghapus sesi + transkrip, sehingga context pack terpasang ulang.

## Anggaran konteks

- Context pack maksimal ~2.000 token.
- Indeks skill berupa tabel ringkas, bukan isi `SKILL.md` lengkap.
- Satu skill card yang cocok ditambahkan per pesan, maksimal ~300 token.
- Jika tidak ada skill yang cocok, tidak ada card yang ditambahkan.

## Pemetaan skill cloud

Hanya skill yang tidak memerlukan file/shell/browser lokal yang diaktifkan, antara lain:

| Pemicu | Skill |
|---|---|
| ide fitur, rencana, komponen baru | `brainstorming`, `writing-plans` |
| bug, test gagal, perilaku aneh | `systematic-debugging` |
| sebelum klaim selesai | `verification-before-completion` |
| judul, hook, script, SEO, komentar YouTube | `yt-script`, `yt-package`, `yt-seo`, `yt-comment`, dll. |
| caption, Reels, DM, riset IG | `ig-caption`, `ig-reel`, `ig-dm`, `ig-viral`, dll. |
| doc, prompt motion, gaya bahasa | `docs`, `motion-prompt-writer`, `ig-human` |
| jawab ringkas/hemat token | `ultracave` (prinsip, bukan alat) |

Skill yang butuh alat lokal (`ffmpeg`, `see`, `browser`, `winapp-*`, `blender`, `hyperframes`, dll.) **tidak dipakai**. Jika diminta, bot menjawab bahwa tugas itu perlu PC/master dan tidak dijalankan di cloud.

## Perilaku balasan

- Awalan pesan tetap `🤖 ` dari `BOT_PREFIX`.
- Pesan panjang dipecah `chunkText` seperti sekarang.
- Perintah `/help`, `/status`, `/model`, `/reset` tetap dipertahankan.
- `/help` ditambah penjelasan singkat: balasan memakai persona master dan skill teks cloud.
- Master tetap satu-satunya pengirim yang diproses (`isAuthorized`).

## Verifikasi

1. `npm run typecheck` — 0 error.
2. `npm test` — semua test lulus, termasuk test context/router baru.
3. `npm run build` — build sukses.
4. Uji langsung di grup `OpenCode Ai` setelah deploy: `/help`, `halo master`, `/status`, `/reset`, lalu `halo lagi`.
5. Pastikan balasan menyapa `master`, tidak menjanjikan akses PC, dan `/reset` mengembalikan persona.

## Risiko & batas

- Kuota OpenRouter gratis sekitar 50 request/hari.
- Render Free bisa mati saat idle; butuh keepalive yang sudah ada.
- Sesi WhatsApp bentrok jika file dikirim dari PC bersamaan dengan bot; kirim dari satu jalur saja.
- Grup `OpenCode Ai` saat ini hanya berisi perangkat tertaut master sendiri; jika pesan tidak tampak, masalahnya di perangkat tertaut, bukan di jalur pengiriman bot.
- Context pack adalah ringkasan, bukan salinan penuh seluruh skill; skill baru perlu ditambahkan ke indeks secara manual atau lewat sinkronisasi berikutnya.

## Di luar lingkup

- Menjalankan tool/file/shell PC dari WA.
- Memakai bobot model Big Pickle di cloud.
- Menyalin 300+ `SKILL.md` ke Render.
- Mengubah JID tujuan atau allowlist.
