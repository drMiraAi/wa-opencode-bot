import type { AppConfig } from "./config.js"
import { buildContextPack, type ContextPacks } from "./context.js"
import type { Store, TranscriptMessage } from "./store.js"

export interface SdkLike {
  sessions: {
    create(input: { location: { directory: string } }): Promise<{ id: string }>
    get(input: { sessionID: string }): Promise<unknown>
    prompt(input: { sessionID: string; text: string }): Promise<unknown>
  }
  message: {
    list(input: { sessionID: string }): Promise<{
      data: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
    }>
  }
  events: {
    subscribe(input: { types: string[] }): AsyncIterable<{
      type: string
      data?: { sessionID?: string }
    }>
  }
}

export interface Agent {
  prompt(text: string): Promise<string>
  reset(): Promise<void>
  status(): Promise<{ sessionId: string | null; model: string }>
}

export function formatStatusReport(status: { sessionId: string | null; model: string }): string {
  return `Laporan otomatis: bot aktif | model ${status.model} | session ${status.sessionId ?? "-"}`
}

const QUOTA_REPLY = "Kuota gratis OpenRouter habis. Coba lagi besok."
const IDLE_TIMEOUT_MS = 120_000

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /429|rate.?limit|quota/i.test(message)
}

export async function createAgent(deps: {
  sdk: SdkLike
  store: Store
  config: AppConfig
  idleTimeoutMs?: number
  context?: ContextPacks
}): Promise<Agent> {
  const { sdk, store, config } = deps
  const timeout = deps.idleTimeoutMs ?? IDLE_TIMEOUT_MS
  const context = deps.context

  return {
    async prompt(text) {
      let sessionId = await store.loadSessionId()

      if (sessionId) {
        try {
          await sdk.sessions.get({ sessionID: sessionId })
        } catch {
          sessionId = null
          await store.saveSessionId(null)
        }
      }

      let prefix = ""
      let isNewSession = false
      if (!sessionId) {
        isNewSession = true
        const history = await store.loadTranscript(20)
        if (history.length > 0) {
          prefix =
            "Percakapan sebelumnya:\n" +
            history.map((m) => `${m.role}: ${m.content}`).join("\n") +
            "\n\n"
        }
        const session = await sdk.sessions.create({ location: { directory: config.workDir } })
        sessionId = session.id
        await store.saveSessionId(sessionId)
      }

      const iterator = sdk.events.subscribe({ types: ["session.idle"] })[Symbol.asyncIterator]()
      const idle = (async () => {
        while (true) {
          const step = await iterator.next()
          if (step.done) return
          if (step.value.type === "session.idle" && step.value.data?.sessionID === sessionId) return
        }
      })()

      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const contextPrefix = isNewSession && context
          ? buildContextPack({ ...context, text }) + "\n\n"
          : ""
        await sdk.sessions.prompt({ sessionID: sessionId, text: contextPrefix + prefix + text })
        await Promise.race([
          idle,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeout)
          }),
        ])

        const { data } = await sdk.message.list({ sessionID: sessionId })
        const assistant = [...data].reverse().find((message) => message.type === "assistant")
        const answer = (assistant?.content ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n")

        const at = new Date().toISOString()
        const pair: TranscriptMessage[] = [
          { role: "user", content: text, at },
          { role: "assistant", content: answer, at },
        ]
        await store.appendTranscript(pair)

        return answer
      } catch (error) {
        if (isQuotaError(error)) return QUOTA_REPLY
        throw error
      } finally {
        if (timer) clearTimeout(timer)
        await iterator.return?.()
      }
    },

    async reset() {
      await store.saveSessionId(null)
      await store.clearTranscript()
    },

    async status() {
      return { sessionId: await store.loadSessionId(), model: config.model }
    },
  }
}
