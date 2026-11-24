import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import { buildContextPack, CONTEXT_HEADER, loadContextPacks, selectSkill } from "../src/context.js"

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

describe("loadContextPacks", () => {
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
})
