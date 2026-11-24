import { describe, it, expect, vi } from "vitest"
import { createAgent, formatStatusReport } from "../src/agent.js"
import { createMemoryStore } from "../src/store.js"
import type { AppConfig } from "../src/config.js"

const config = { model: "openrouter/free-router", workDir: "work" } as AppConfig
const context = {
  globalRules: "Sapa master di setiap balasan.",
  projectState: "Bot WA: grup OpenCode Ai, model openrouter/free-router.",
  skillIndex: "Skill teks tersedia: docs.",
}

function fakeSdk(assistantText = "jawaban") {
  return {
    sessions: {
      create: vi.fn(async () => ({ id: "ses_baru" })),
      get: vi.fn(async (_input: { sessionID: string }) => ({})),
      prompt: vi.fn(async (_input: { sessionID: string; text: string }) => ({ type: "user" })),
    },
    message: {
      list: vi.fn(async () => ({
        data: [{ type: "assistant", content: [{ type: "text", text: assistantText }] }],
      })),
    },
    events: {
      subscribe: vi.fn((_input: { types: string[] }) =>
        (async function* () {
          yield { type: "session.execution.succeeded", data: { sessionID: "ses_baru" } }
          yield { type: "session.execution.succeeded", data: { sessionID: "ses_lama" } }
        })(),
      ),
    },
  }
}

describe("formatStatusReport", () => {
  it("menampilkan model dan session", () => {
    expect(formatStatusReport({ sessionId: "ses_1", model: "openrouter/free-router" })).toBe(
      "Laporan otomatis: bot aktif | model openrouter/free-router | session ses_1",
    )
  })
})

describe("agent", () => {
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

  it("membuat ulang session saat session tersimpan sudah tidak dikenal", async () => {
    const store = createMemoryStore()
    await store.saveSessionId("ses_stale")
    const sdk = fakeSdk()
    sdk.sessions.get.mockRejectedValueOnce(new Error("session not found"))
    const agent = await createAgent({ sdk: sdk as never, store, config })

    expect(await agent.prompt("halo")).toBe("jawaban")
    expect(sdk.sessions.create).toHaveBeenCalledTimes(1)
    expect(sdk.sessions.prompt.mock.calls[0][0].sessionID).toBe("ses_baru")
  })

  it("menutup subscription saat kuota habis di message.list", async () => {
    let closed = false
    const sdk = fakeSdk()
    sdk.message.list.mockRejectedValueOnce(new Error("429 quota exceeded"))
    sdk.events.subscribe = vi.fn((_input: { types: string[] }) =>
      (async function* () {
        try {
          yield { type: "session.execution.succeeded", data: { sessionID: "ses_baru" } }
        } finally {
          closed = true
        }
      })(),
    )
    const agent = await createAgent({ sdk: sdk as never, store: createMemoryStore(), config })

    expect(await agent.prompt("halo")).toContain("Kuota")
    expect(closed).toBe(true)
  })

  it("berlangganan event eksekusi session agar balasan tidak menunggu timeout", async () => {
    const sdk = fakeSdk()
    const agent = await createAgent({ sdk: sdk as never, store: createMemoryStore(), config })
    await agent.prompt("halo")
    expect(sdk.events.subscribe).toHaveBeenCalledWith({
      types: ["session.execution.succeeded", "session.execution.failed"],
    })
  })

  it("tetap menjawab bila event eksekusi tidak pernah muncul", async () => {
    const sdk = fakeSdk()
    sdk.events.subscribe = vi.fn((_input: { types: string[] }) =>
      ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise(() => {}),
          return: async () => ({ done: true, value: undefined }),
        }),
      }) as never,
    )
    const agent = await createAgent({
      sdk: sdk as never,
      store: createMemoryStore(),
      config,
      idleTimeoutMs: 20,
    })

    expect(await agent.prompt("halo")).toBe("jawaban")
  })
})
