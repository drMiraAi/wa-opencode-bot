import { describe, it, expect } from "vitest"
import { createMemoryStore } from "../src/store.js"

describe("memory store", () => {
  it("menyimpan dan memuat session id", async () => {
    const s = createMemoryStore()
    await s.saveSessionId("ses_123")
    expect(await s.loadSessionId()).toBe("ses_123")
  })

  it("membatasi transkrip sesuai limit", async () => {
    const s = createMemoryStore()
    await s.appendTranscript(
      Array.from({ length: 25 }, (_, i) => ({
        role: "user" as const,
        content: `pesan-${i}`,
        at: new Date().toISOString(),
      })),
    )
    const rows = await s.loadTranscript(20)
    expect(rows).toHaveLength(20)
    expect(rows.at(-1)?.content).toBe("pesan-24")
  })

  it("mengosongkan transkrip saat reset", async () => {
    const s = createMemoryStore()
    await s.appendTranscript([{ role: "user", content: "halo", at: new Date().toISOString() }])
    await s.clearTranscript()
    expect(await s.loadTranscript(20)).toEqual([])
  })
})
