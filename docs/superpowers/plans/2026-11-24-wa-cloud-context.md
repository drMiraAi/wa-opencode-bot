# WA Cloud Context Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buat bot WA di grup `OpenCode Ai` membalas seperti agen sesi ini: persona master, aturan global, dan skill teks otomatis, tetap di cloud Render.

**Architecture:** Context pack ringkas disusun dari tiga file markdown di repo, lalu disuntik sebagai awalan prompt hanya saat sesi OpenCode baru dibuat. Router skill memilih satu skill card per pesan; skill yang butuh alat lokal tidak dipakai.

**Tech Stack:** TypeScript, Vitest, `@opencode/sdk` 2.3.2, Baileys, Render Free, OpenRouter `openrouter/free-router`.

**Spec:** `docs/DESIGN-wa-agent.md`

## Global Constraints

- Model tetap `openrouter/free-router`; jangan tambah API key atau model berbayar.
- Jangan ubah `ALLOWED_GROUP_JID`, `ALLOWED_JID`, atau `isAuthorized`.
- Tidak boleh menjanjikan atau memanggil file, shell, browser, atau tool PC master.
- Balasan tetap diawali `🤖 ` (`BOT_PREFIX`) dan dipecah `chunkText` 3000 karakter.
- Context pack maksimal ~2.000 token; satu skill card maksimal ~300 token.
- Awalan context hanya untuk sesi baru; `/reset` adalah cara memasang ulang.
- Gunakan gaya commit repo: `feat:`, `fix:`, `chore:`, `test:`, `docs:`.

## Review Focus

- Pesan dari JID yang tidak diizinkan tetap diabaikan — diuji di `tests/transport.test.ts` (sudah ada) dan tidak diubah.
- Sesi lama tidak menerima context pack dua kali — diuji di Task 3.
- Skill yang butuh alat lokal tidak pernah dipilih — diuji di Task 1.
- `/reset` mengembalikan persona karena sesi dibuat ulang — diuji di Task 3.
- File context hilang di Render harus gagal dengan jelas, bukan balasan kosong — diuji di Task 2.

---

### Task 1: Context pack builder dan router skill

**Files:**
- Create: `src/context.ts`
- Test: `tests/context.test.ts`

**Interfaces:**
- Produces: `export type ContextPacks = { globalRules: string; projectState: string; skillIndex: string }`
- Produces: `export type SkillCard = { id: string; reason: string }`
- Produces: `export const CONTEXT_HEADER = "Konteks agen WA v1"`
- Produces: `export function buildContextPack(input: ContextPacks & { text: string }): string`
- Produces: `export function selectSkill(text: string): SkillCard | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest"
import { buildContextPack, CONTEXT_HEADER, selectSkill } from "../src/context.js"

const packs = {
  globalRules: "Sapa master di setiap balasan.",
  projectState: "YouTube Autopilot: baca youtube-autopilot/HANDOFF.md sebelum menyambung kerja.",
  skillIndex: "Skill teks tersedia: docs, yt-script, ig-caption.",
}

describe("buildContextPack", () => {
  it("menyusun konteks dan memilih skill yang cocok", () => {
    const out = buildContextPack({ ...packs, text: "bikin fitur baru" })
    expect(out).toContain(CONTEXT_HEADER)
    expect(out).toContain("Sapa master di setiap balasan.")
    expect(out).toContain("Skill aktif: brainstorming — tanya dulu sebelum kode")
  })

  it("tidak menambah skill card bila tidak ada pemicu", () => {
    const out = buildContextPack({ ...packs, text: "halo" })
    expect(out).toContain(CONTEXT_HEADER)
    expect(out).not.toContain("Skill aktif:")
  })

  it("menolak skill yang butuh alat lokal", () => {
    expect(selectSkill("jalankan ffmpeg dan browser")).toBeNull()
  })
})

describe("selectSkill", () => {
  it.each([
    ["ini bug test gagal", "systematic-debugging"],
    ["sudah selesai commit", "verification-before-completion"],
    ["bikin komponen baru", "brainstorming"],
    ["judul youtube thumbnail", "claude-youtube"],
    ["caption instagram reel", "ig-reel"],
    ["tulis dokumen laporan", "docs"],
    ["bikin motion animasi", "motion-prompt-writer"],
    ["jawab ringkas hemat token", "ultracave"],
  ])("memilih %s -> %s", (text, id) => {
    expect(selectSkill(text)?.id).toBe(id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/context.test.ts`
Expected: FAIL — modul `../src/context.js` tidak ditemukan.

- [ ] **Step 3: Implement `src/context.ts`**

Buat konstanta dan fungsi dengan signature di Interfaces. `selectSkill` mencocokkan teks huruf kecil terhadap pola dalam urutan tabel ini; pola pertama yang cocok menang:

| Pola (regex, case-insensitive) | id | reason |
|---|---|---|
| `bug\|error\|gagal\|test\|perilaku aneh` | `systematic-debugging` | `diagnosa dulu sebelum perbaikan` |
| `selesai\|commit\|lolos\|verifikasi` | `verification-before-completion` | `jalankan verifikasi sebelum klaim` |
| `ide\|fitur\|bikin\|bangun\|rencana\|komponen` | `brainstorming` | `tanya dulu sebelum kode` |
| `youtube\|yt-\|judul video\|thumbnail\|hook\|seo\|script video` | `claude-youtube` | `pakai skill YouTube` |
| `instagram\|reel\|caption\|dm ig\|ig-` | `ig-reel` | `pakai skill Instagram Reels` |
| `dokumen\|doc\|laporan\|proposal` | `docs` | `pakai skill dokumen` |
| `motion\|animasi\|chart animasi\|video animasi` | `motion-prompt-writer` | `pakai skill prompt motion` |
| `ringkas\|hemat token\|pendek\|ultracave` | `ultracave` | `jawab paling ringkas` |

Kata `ffmpeg`, `browser`, `blender`, `hyperframes`, `winapp` harus mengembalikan `null` walau ada kata kunci lain. `buildContextPack` menggabungkan `\n\n` dari header, `globalRules`, `projectState`, `skillIndex`, lalu `\n\nSkill aktif: ${id} — ${reason}` bila ada card.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/context.test.ts`
Expected: PASS — 10 test.

- [ ] **Step 5: Commit**

```bash
git add src/context.ts tests/context.test.ts
git commit -m "test: context pack dan router skill cloud"
```

---

### Task 2: File context dan loader

**Files:**
- Create: `context/global.md`
- Create: `context/project.md`
- Create: `context/skills-cloud.md`
- Modify: `src/context.ts`
- Test: `tests/context.test.ts`

**Interfaces:**
- Consumes: `ContextPacks` dari Task 1.
- Produces: `export async function loadContextPacks(dir: string): Promise<ContextPacks>`

- [ ] **Step 1: Write the failing test**

Tambahkan ke `tests/context.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadContextPacks } from "../src/context.js"

it("membaca tiga file context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wa-context-"))
  await writeFile(join(dir, "global.md"), "ATURAN_GLOBAL")
  await writeFile(join(dir, "project.md"), "STATE_PROYEK")
  await writeFile(join(dir, "skills-cloud.md"), "INDEKS_SKILL")
  expect(await loadContextPacks(dir)).toEqual({
    globalRules: "ATURAN_GLOBAL",
    projectState: "STATE_PROYEK",
    skillIndex: "INDEKS_SKILL",
  })
})

it("gagal jelas bila file context hilang", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wa-context-"))
  await expect(loadContextPacks(dir)).rejects.toThrow(/context/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/context.test.ts`
Expected: FAIL — `loadContextPacks is not a function`.

- [ ] **Step 3: Buat file context dan implement loader**

`context/global.md` harus memuat baris persis:

```
Sapa master di setiap balasan.
Gunakan bahasa Indonesia formal.
Gaya ultracave: jawab dulu, basa-basi buang, teknis utuh.
Jangan mengaku punya akses file, shell, browser, atau PC master.
Skill yang butuh alat lokal tidak dijalankan di cloud.
Sebelum klaim selesai, jalankan verifikasi dan sertakan buktinya.
```

`context/project.md` harus memuat baris persis:

```
YouTube Autopilot: baca youtube-autopilot/HANDOFF.md sebelum menyambung kerja.
Instagram Reels: baca instagram-reels/reels-auto/HANDOFF.md sebelum menyambung kerja.
Bot WA: grup OpenCode Ai, model openrouter/free-router.
```

`context/skills-cloud.md` harus memuat daftar id `brainstorming`, `systematic-debugging`, `verification-before-completion`, `claude-youtube`, `ig-reel`, `docs`, `motion-prompt-writer`, `ultracave` dan baris `Skill yang butuh alat lokal tidak dijalankan di cloud.`

Implement `loadContextPacks(dir)` dengan `readFile(join(dir, "global.md"), "utf8")` dan dua file lain; baca paralel dengan `Promise.all`. Biarkan error dari `readFile` melempar dengan pesan menyebut path file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/context.test.ts`
Expected: PASS — 12 test.

- [ ] **Step 5: Commit**

```bash
git add context src/context.ts tests/context.test.ts
git commit -m "feat: file context persona dan loader cloud"
```

---

### Task 3: Suntik context ke sesi OpenCode baru

**Files:**
- Modify: `src/agent.ts:41-88`
- Test: `tests/agent.test.ts`

**Interfaces:**
- Consumes: `ContextPacks`, `buildContextPack` dari Task 1.
- Produces: `createAgent` menerima `context?: ContextPacks` (default tiga string kosong).
- Produces: `Agent.prompt` tidak berubah signature.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `tests/agent.test.ts`:

```ts
const context = {
  globalRules: "Sapa master di setiap balasan.",
  projectState: "Bot WA: grup OpenCode Ai, model openrouter/free-router.",
  skillIndex: "Skill teks tersedia: docs.",
}

it("menyuntik context hanya pada sesi baru", async () => {
  const store = createMemoryStore()
  const sdk = fakeSdk()
  const agent = await createAgent({ sdk: sdk as never, store, config, context })
  await agent.prompt("halo master")
  expect(sdk.sessions.prompt.mock.calls[0][0].text).toContain("Konteks agen WA v1")
  await agent.prompt("lagi")
  expect(sdk.sessions.prompt.mock.calls[1][0].text).not.toContain("Konteks agen WA v1")
})

it("tidak menyuntik context bila tidak dikirim", async () => {
  const sdk = fakeSdk()
  const agent = await createAgent({ sdk: sdk as never, store: createMemoryStore(), config })
  await agent.prompt("halo")
  expect(sdk.sessions.prompt.mock.calls[0][0].text).toBe("halo")
})

it("memasang ulang context setelah reset", async () => {
  const store = createMemoryStore()
  const sdk = fakeSdk()
  const agent = await createAgent({ sdk: sdk as never, store, config, context })
  await agent.reset()
  await agent.prompt("halo lagi")
  expect(sdk.sessions.prompt.mock.calls[0][0].text).toContain("Konteks agen WA v1")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent.test.ts`
Expected: FAIL — argumen `context` diabaikan, prompt tidak mengandung header.

- [ ] **Step 3: Implement injeksi**

Tambahkan `context?: ContextPacks` ke deps `createAgent` dengan default `{globalRules:"",projectState:"",skillIndex:""}`. Di dalam `prompt`, setelah blok `if (!sessionId)` dan sebelum `sdk.sessions.prompt`, hitung `const contextPrefix = buildContextPack({ ...context, text })` hanya ketika session baru dibuat. Gabungkan menjadi `contextPrefix + prefix + text`. Jangan mengubah perilaku kuota, idle timeout, transkrip, atau `reset`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent.test.ts`
Expected: PASS — semua test lulus termasuk 3 test baru.

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts tests/agent.test.ts
git commit -m "feat: suntik context persona ke sesi baru"
```

---

### Task 4: Rangkaikan di entrypoint, perbarui /help dan README

**Files:**
- Modify: `src/index.ts:14-15`
- Modify: `src/transport.ts:146-154`
- Modify: `tests/transport.test.ts:118-142`
- Modify: `README.md:67-84`

**Interfaces:**
- Consumes: `loadContextPacks` dari Task 2, `createAgent({ context })` dari Task 3.
- Produces: bot siap dipakai dengan persona aktif.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `describe("routeMessage")` di `tests/transport.test.ts`:

```ts
it("/help menjelaskan persona dan batas cloud", async () => {
  const send = vi.fn(async () => {})
  const agent = { prompt: vi.fn(async () => "jawaban") } as unknown as Agent
  await routeMessage({
    msg: { chatJid: "1203630@g.us", senderJid: "62812@s.whatsapp.net", text: "/help" },
    config,
    agent,
    send,
  })
  expect(send.mock.calls[0][0]).toContain("persona master dan skill teks cloud")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/transport.test.ts`
Expected: FAIL — teks belum ada di `/help`.

- [ ] **Step 3: Implement wiring**

Di `src/index.ts`, sebelum `createAgent`, panggil `loadContextPacks(fileURLToPath(new URL("../context/", import.meta.url)))` dan teruskan hasilnya sebagai `context`. Tambahkan impor `fileURLToPath` dari `node:url`. Di `src/transport.ts`, tambahkan tepat satu baris ke daftar `/help`: `Balasan memakai persona master dan skill teks cloud (tanpa akses PC).` Di `README.md`, tambahkan bagian `## Persona balasan` yang menyatakan sapaan `master`, gaya ringkas, skill teks cloud, dan ketiadaan akses PC.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/transport.test.ts && npm run typecheck && npm run build`
Expected: PASS — test, typecheck, dan build sukses.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/transport.ts tests/transport.test.ts README.md
git commit -m "feat: aktifkan persona cloud di bot WA"
```

---

### Task 5: Verifikasi akhir dan uji langsung

**Files:** tidak ada perubahan kode.

**Interfaces:**
- Consumes: bot terdeploy dari Task 4.

- [ ] **Step 1: Jalankan verifikasi lokal**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS — seluruh test, typecheck 0 error, build sukses.

- [ ] **Step 2: Deploy ke Render**

Push commit ke branch yang dipakai Render (`feat/wa-opencode-bot`), tunggu deploy sukses, lalu resume service Render dan aktifkan kembali workflow keepalive.

- [ ] **Step 3: Uji langsung di grup `OpenCode Ai`**

Kirim berurutan: `/help`, `halo master`, `/status`, `/reset`, `halo lagi`.
Expected: balasan menyapa `master`, `/status` menampilkan `openrouter/free-router`, `/reset` mengembalikan sesi baru, `halo lagi` kembali menyapa `master`.

- [ ] **Step 4: Lapor bukti**

Catat hasil uji langsung ke chat. Jangan klaim selesai hanya dari log deploy.

- [ ] **Step 5: Commit bila ada perbaikan**

```bash
git add -A && git commit -m "fix: perbaikan persona cloud"
```
