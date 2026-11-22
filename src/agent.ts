import type { AppConfig } from "./config.js"
import type { Store, TranscriptMessage } from "./store.js"

export interface SdkLike {
  sessions: {
    create(input: { location: { directory: string } }): Promise<{ id: string }>
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

const QUOTA_REPLY = "Kuota gratis OpenRouter habis. Coba lagi besok."

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /429|rate.?limit|quota/i.test(message)
}

export async function createAgent(deps: {
  sdk: SdkLike
  store: Store
  config: AppConfig
}): Promise<Agent> {
  const { sdk, store, config } = deps

  return {
    async prompt(text) {
      let sessionId = await store.loadSessionId()
      let prefix = ""

      if (!sessionId) {
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

      const subscription = sdk.events.subscribe({ types: ["session.idle"] })
      const waitForIdle = (async () => {
        for await (const event of subscription) {
          if (event.type === "session.idle" && event.data?.sessionID === sessionId) return
        }
      })()

      try {
        await sdk.sessions.prompt({ sessionID: sessionId, text: prefix + text })
      } catch (error) {
        if (isQuotaError(error)) return QUOTA_REPLY
        throw error
      }

      await waitForIdle

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
