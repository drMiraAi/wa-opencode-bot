import { describe, it, expect, vi } from "vitest"
import { createAgent } from "../src/agent.js"
import { createMemoryStore } from "../src/store.js"
import type { AppConfig } from "../src/config.js"

const config = { model: "openrouter/free-router", workDir: "work" } as AppConfig

function fakeSdk(assistantText = "jawaban") {
  return {
    sessions: {
      create: vi.fn(async () => ({ id: "ses_baru" })),
      prompt: vi.fn(async (_input: { sessionID: string; text: string }) => ({ type: "user" })),
    },
    message: {
      list: vi.fn(async () => ({
        data: [{ type: "assistant", content: [{ type: "text", text: assistantText }] }],
      })),
    },
    events: {
      subscribe: () =>
        (async function* () {
          yield { type: "session.idle", data: { sessionID: "ses_baru" } }
          yield { type: "session.idle", data: { sessionID: "ses_lama" } }
        })(),
    },
  }
}

describe("agent", () => {
  it("membuat session dan menyuntik transkrip pada pemakaian pertama", async () => {
    const store = createMemoryStore()
    await store.appendTranscript([{ role: "user", content: "pesan lama", at: "2026-11-22T00:00:00Z" }])
    const sdk = fakeSdk()
    const agent = await createAgent({ sdk: sdk as never, store, config })

    expect(await agent.prompt("halo")).toBe("jawaban")
    expect(sdk.sessions.create).toHaveBeenCalledTimes(1)
    expect(sdk.sessions.prompt.mock.calls[0][0].text).toContain("pesan lama")
    expect(await store.loadSessionId()).toBe("ses_baru")
  })

  it("memakai ulang session yang tersimpan", async () => {
    const store = createMemoryStore()
    await store.saveSessionId("ses_lama")
    const sdk = fakeSdk()
    const agent = await createAgent({ sdk: sdk as never, store, config })
    await agent.prompt("lagi")
    expect(sdk.sessions.create).not.toHaveBeenCalled()
  })

  it("mengosongkan transkrip saat reset", async () => {
    const store = createMemoryStore()
    await store.appendTranscript([{ role: "user", content: "lama", at: "2026-11-22T00:00:00Z" }])
    const agent = await createAgent({ sdk: fakeSdk() as never, store, config })
    await agent.reset()
    expect(await store.loadTranscript(20)).toEqual([])
    expect(await store.loadSessionId()).toBeNull()
  })

  it("membalas ramah saat kuota habis", async () => {
    const sdk = fakeSdk()
    sdk.sessions.prompt.mockRejectedValueOnce(new Error("429 rate limit exceeded"))
    const agent = await createAgent({ sdk: sdk as never, store: createMemoryStore(), config })
    expect(await agent.prompt("halo")).toContain("Kuota")
  })
})
