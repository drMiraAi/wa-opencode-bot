import { describe, it, expect } from "vitest"
import { createMemoryStore } from "../src/store.js"
import { createAuthState } from "../src/auth.js"

type LooseKeys = {
  set(data: Record<string, Record<string, unknown>>): Promise<void>
  get(type: string, ids: string[]): Promise<Record<string, unknown>>
  del(type: string, ids: string[]): Promise<void>
}

describe("createAuthState", () => {
  it("menyimpan kunci ke store saat flush dipanggil", async () => {
    const store = createMemoryStore()
    const { auth, flush } = await createAuthState(store)
    const keys = auth.keys as unknown as LooseKeys

    await keys.set({ "app-state": { "1": { value: "x" } } })
    await flush()

    const saved = await store.loadAuthState()
    expect(saved?.keys["app-state"]?.["1"]).toEqual({ value: "x" })
  })

  it("mengembalikan Buffer setelah auth dimuat ulang dari JSON", async () => {
    const memory = createMemoryStore()
    const store = {
      ...memory,
      saveAuthState: async (s: never) => memory.saveAuthState(JSON.parse(JSON.stringify(s))),
      loadAuthState: async () => {
        const s = await memory.loadAuthState()
        return s ? JSON.parse(JSON.stringify(s)) : null
      },
    } as never

    {
      const { auth, flush } = await createAuthState(store)
      await (auth.keys as unknown as LooseKeys).set({
        "app-state": { "1": { value: Buffer.from("rahasia") } },
      })
      await flush()
    }

    const { auth } = await createAuthState(store)
    const got = await (auth.keys as unknown as LooseKeys).get("app-state", ["1"])
    const value = (got["1"] as { value?: unknown } | undefined)?.value
    expect(Buffer.isBuffer(value)).toBe(true)
    expect((value as Buffer).toString()).toBe("rahasia")
  })

  it("menghapus kunci dari store", async () => {
    const store = createMemoryStore()
    const { auth, flush } = await createAuthState(store)
    const keys = auth.keys as unknown as LooseKeys

    await keys.set({ "app-state": { "1": { value: "x" } } })
    await keys.del("app-state", ["1"])
    await flush()

    const saved = await store.loadAuthState()
    expect(saved?.keys["app-state"]?.["1"]).toBeUndefined()
  })
})
