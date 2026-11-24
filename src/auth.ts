import { BufferJSON, initAuthCreds, type AuthenticationState } from "@whiskeysockets/baileys"
import type { Store } from "./store.js"

export async function createAuthState(store: Store): Promise<{
  auth: AuthenticationState
  persist: () => void
  flush: () => Promise<void>
}> {
  const raw = await store.loadAuthState()
  const saved = raw ? JSON.parse(JSON.stringify(raw), BufferJSON.reviver) : null
  const creds = { ...(initAuthCreds() as object), ...(saved?.creds ?? {}) }
  const keys: Record<string, Record<string, unknown>> = { ...(saved?.keys ?? {}) }
  let timer: ReturnType<typeof setTimeout> | undefined

  const save = () =>
    store.saveAuthState(JSON.parse(JSON.stringify({ creds, keys }, BufferJSON.replacer)))

  const persist = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void save()
    }, 1000)
  }

  const keyStore = {
    async get(type: string, ids: string[]) {
      const result: Record<string, unknown> = {}
      for (const id of ids) {
        const value = keys[type]?.[id]
        if (value !== undefined) result[id] = value
      }
      return result
    },
    async set(data: Record<string, Record<string, unknown>>) {
      for (const [type, entries] of Object.entries(data)) {
        keys[type] = { ...(keys[type] ?? {}), ...entries }
      }
      persist()
    },
    async del(type: string, ids: string[]) {
      for (const id of ids) {
        if (keys[type]) delete keys[type]![id]
      }
      persist()
    },
  }

  const flush = async () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    await save()
  }

  return {
    auth: { creds: creds as AuthenticationState["creds"], keys: keyStore as never },
    persist,
    flush,
  }
}
