import express, { type Express } from "express"
import QRCode from "qrcode"
import {
  Browsers,
  DisconnectReason,
  initAuthCreds,
  makeWASocket,
  type AuthenticationState,
  type WAMessage,
} from "@whiskeysockets/baileys"
import type { AppConfig } from "./config.js"
import type { Agent } from "./agent.js"
import { chunkText, isAuthorized, parseCommand, type IncomingMessage } from "./policy.js"
import type { Store } from "./store.js"

const activeSenders = new Set<string>()

export const BOT_PREFIX = "🤖 "

export function shouldProcess(text: string): boolean {
  return !text.startsWith(BOT_PREFIX)
}

export function createHttpApp(deps: {
  config: AppConfig
  store: Store
  qrPng: () => Promise<Buffer | null>
}): Express {
  const { config, store, qrPng } = deps
  const app = express()

  app.get("/health", (_req, res) => {
    res.json({ ok: true })
  })

  app.get("/qr", async (req, res) => {
    if (req.query.token !== config.bootstrapToken) {
      res.status(404).send("Not found")
      return
    }
    if (await store.isQrDisabled()) {
      res.status(404).send("Not found")
      return
    }
    const png = await qrPng()
    if (!png) {
      res.status(404).send("QR belum tersedia")
      return
    }
    res.type("png").send(png)
  })

  return app
}

export async function routeMessage(deps: {
  msg: IncomingMessage
  config: AppConfig
  agent: Agent
  send: (text: string) => Promise<void>
}): Promise<void> {
  const { msg, config, agent, send } = deps
  if (!isAuthorized(msg, config)) return

  const parsed = parseCommand(msg.text)
  if (parsed.kind === "command") {
    switch (parsed.name) {
      case "help":
        await send("/help — daftar perintah\n/status — status bot\n/model — model LLM\n/reset — hapus riwayat")
        return
      case "status": {
        const status = await agent.status()
        await send(`session: ${status.sessionId ?? "belum ada"}\nmodel: ${status.model}`)
        return
      }
      case "model":
        await send(config.model)
        return
      case "reset":
        await agent.reset()
        await send("Riwayat percakapan dihapus.")
        return
      default:
        await send("Perintah tidak dikenal. Kirim /help.")
        return
    }
  }

  if (activeSenders.has(config.allowedSenderJid)) {
    await send("Masih memproses pesan sebelumnya.")
    return
  }
  activeSenders.add(config.allowedSenderJid)
  try {
    const answer = await agent.prompt(parsed.text)
    for (const part of chunkText(answer)) {
      await send(part)
    }
  } finally {
    activeSenders.delete(config.allowedSenderJid)
  }
}

export function extractIncoming(message: WAMessage): IncomingMessage | null {
  const chatJid = message.key.remoteJid
  const text =
    message.message?.conversation ?? message.message?.extendedTextMessage?.text ?? null
  if (!chatJid || !text) return null

  const key = message.key as { participant?: string; participantPn?: string }
  const senderJid = chatJid.endsWith("@g.us")
    ? key.participantPn ?? key.participant ?? ""
    : chatJid

  return { chatJid, senderJid, text }
}

export type SocketLike = {
  ev: { on: (event: string, handler: (payload: any) => void) => void }
  sendMessage: (chatJid: string, content: { text: string }) => Promise<unknown>
  end: (error?: Error) => void
}

export async function startBot(deps: {
  config: AppConfig
  store: Store
  agent: Agent
  socketFactory?: () => SocketLike
  holder?: { socket?: SocketLike }
}): Promise<{ app: Express; socket: SocketLike }> {
  const { config, store, agent } = deps
  let currentQr: string | null = null

  const app = createHttpApp({
    config,
    store,
    qrPng: async () => (currentQr ? QRCode.toBuffer(currentQr) : null),
  })

  const saved = await store.loadAuthState()
  const creds = { ...(initAuthCreds() as object), ...(saved?.creds ?? {}) }
  const keys: Record<string, Record<string, unknown>> = { ...(saved?.keys ?? {}) }
  let timer: ReturnType<typeof setTimeout> | undefined

  const persist = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void store.saveAuthState({ creds, keys })
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

  const auth: AuthenticationState = { creds: creds as AuthenticationState["creds"], keys: keyStore as never }

  const socket: SocketLike = deps.socketFactory
    ? deps.socketFactory()
    : (makeWASocket({
        auth,
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: false,
      }) as unknown as SocketLike)

  if (deps.holder) deps.holder.socket = socket

  socket.ev.on("creds.update", persist)

  socket.ev.on("messages.upsert", ({ messages }) => {
    for (const message of messages) {
      const incoming = extractIncoming(message)
      if (!incoming || !shouldProcess(incoming.text)) continue
      void routeMessage({
        msg: incoming,
        config,
        agent,
        send: async (text) => {
          await socket.sendMessage(incoming.chatJid, { text: BOT_PREFIX + text })
        },
      }).catch((error) => {
        console.error("routeMessage gagal:", error)
      })
    }
  })

  socket.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) currentQr = qr
    if (connection === "open") {
      void store.setQrDisabled(true)
    }
    if (connection === "close") {
      const reason = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        void startBot(deps)
      }
    }
  })

  return { app, socket }
}
