import { readFile } from "node:fs/promises"
import { join } from "node:path"

export type ContextPacks = {
  globalRules: string
  projectState: string
  skillIndex: string
}

export type SkillCard = {
  id: string
  reason: string
}

export const CONTEXT_HEADER = "Konteks agen WA v1"

const LOCAL_TOOL_WORDS = /ffmpeg|browser|blender|hyperframes|winapp/i

const SKILL_PATTERNS: Array<{ pattern: RegExp; card: SkillCard }> = [
  {
    pattern: /bug|error|gagal|test|perilaku aneh/i,
    card: { id: "systematic-debugging", reason: "diagnosa dulu sebelum perbaikan" },
  },
  {
    pattern: /selesai|commit|lolos|verifikasi/i,
    card: { id: "verification-before-completion", reason: "jalankan verifikasi sebelum klaim" },
  },
  {
    pattern: /motion|animasi|chart animasi|video animasi/i,
    card: { id: "motion-prompt-writer", reason: "pakai skill prompt motion" },
  },
  {
    pattern: /ide|fitur|bikin|bangun|rencana|komponen/i,
    card: { id: "brainstorming", reason: "tanya dulu sebelum kode" },
  },
  {
    pattern: /youtube|yt-|judul video|thumbnail|hook|seo|script video/i,
    card: { id: "claude-youtube", reason: "pakai skill YouTube" },
  },
  {
    pattern: /instagram|reel|caption|dm ig|ig-/i,
    card: { id: "ig-reel", reason: "pakai skill Instagram Reels" },
  },
  {
    pattern: /dokumen|doc|laporan|proposal/i,
    card: { id: "docs", reason: "pakai skill dokumen" },
  },
  {
    pattern: /ringkas|hemat token|pendek|ultracave/i,
    card: { id: "ultracave", reason: "jawab paling ringkas" },
  },
]

export async function loadContextPacks(dir: string): Promise<ContextPacks> {
  try {
    const [globalRules, projectState, skillIndex] = await Promise.all([
      readFile(join(dir, "global.md"), "utf8"),
      readFile(join(dir, "project.md"), "utf8"),
      readFile(join(dir, "skills-cloud.md"), "utf8"),
    ])
    return { globalRules, projectState, skillIndex }
  } catch (error) {
    throw new Error(`Gagal membaca context: ${String(error)}`)
  }
}

export function selectSkill(text: string): SkillCard | null {
  if (LOCAL_TOOL_WORDS.test(text)) return null
  const match = SKILL_PATTERNS.find((entry) => entry.pattern.test(text))
  return match?.card ?? null
}

export function buildContextPack(input: ContextPacks & { text: string }): string {
  const card = selectSkill(input.text)
  const parts = [
    CONTEXT_HEADER,
    input.globalRules,
    input.projectState,
    input.skillIndex,
  ]
  if (card) parts.push(`Skill aktif: ${card.id} — ${card.reason}`)
  return parts.join("\n\n")
}
