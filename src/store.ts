import { createClient } from "@supabase/supabase-js"
import type { AppConfig } from "./config.js"

export type SerializedAuth = {
  creds: Record<string, unknown>
  keys: Record<string, Record<string, unknown>>
}

export type TranscriptMessage = {
  role: "user" | "assistant"
  content: string
  at: string
}

export interface Store {
  loadAuthState(): Promise<SerializedAuth | null>
  saveAuthState(state: SerializedAuth): Promise<void>
  loadSessionId(): Promise<string | null>
  saveSessionId(id: string | null): Promise<void>
  appendTranscript(messages: TranscriptMessage[]): Promise<void>
  loadTranscript(limit: number): Promise<TranscriptMessage[]>
  clearTranscript(): Promise<void>
  isQrDisabled(): Promise<boolean>
  setQrDisabled(value: boolean): Promise<void>
}

export function createMemoryStore(): Store {
  let authState: SerializedAuth | null = null
  let sessionId: string | null = null
  let transcript: TranscriptMessage[] = []
  let qrDisabled = false

  return {
    async loadAuthState() {
      return authState
    },
    async saveAuthState(state) {
      authState = state
    },
    async loadSessionId() {
      return sessionId
    },
    async saveSessionId(id) {
      sessionId = id
    },
    async appendTranscript(messages) {
      transcript.push(...messages)
    },
    async loadTranscript(limit) {
      return transcript.slice(-limit)
    },
    async clearTranscript() {
      transcript = []
    },
    async isQrDisabled() {
      return qrDisabled
    },
    async setQrDisabled(value) {
      qrDisabled = value
    },
  }
}

export function createSupabaseStore(config: AppConfig): Store {
  const client = createClient(config.supabaseUrl, config.supabaseKey)

  return {
    async loadAuthState() {
      const { data, error } = await client
        .from("wa_auth")
        .select("state")
        .eq("id", "singleton")
        .maybeSingle()
      if (error) throw error
      return (data?.state as SerializedAuth) ?? null
    },

    async saveAuthState(state) {
      const { error } = await client.from("wa_auth").upsert({
        id: "singleton",
        state,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    },

    async loadSessionId() {
      const { data, error } = await client
        .from("wa_meta")
        .select("session_id")
        .eq("id", "singleton")
        .maybeSingle()
      if (error) throw error
      return (data?.session_id as string | null) ?? null
    },

    async saveSessionId(id) {
      const { error } = await client.from("wa_meta").upsert({
        id: "singleton",
        session_id: id,
      })
      if (error) throw error
    },

    async appendTranscript(messages) {
      if (messages.length === 0) return
      const { error } = await client.from("wa_transcript").insert(
        messages.map((m) => ({ role: m.role, content: m.content, at: m.at })),
      )
      if (error) throw error
    },

    async loadTranscript(limit) {
      const { data, error } = await client
        .from("wa_transcript")
        .select("role, content, at")
        .order("id", { ascending: false })
        .limit(limit)
      if (error) throw error
      return ((data ?? []) as TranscriptMessage[]).reverse()
    },

    async clearTranscript() {
      const { error } = await client.from("wa_transcript").delete().gte("id", 0)
      if (error) throw error
    },

    async isQrDisabled() {
      const { data, error } = await client
        .from("wa_meta")
        .select("qr_disabled")
        .eq("id", "singleton")
        .maybeSingle()
      if (error) throw error
      return Boolean(data?.qr_disabled)
    },

    async setQrDisabled(value) {
      const { error } = await client.from("wa_meta").upsert({
        id: "singleton",
        qr_disabled: value,
      })
      if (error) throw error
    },
  }
}
