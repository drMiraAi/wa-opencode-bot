import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import express, { type Express } from "express"
import QRCode from "qrcode"
import {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  makeWASocket,
  type WAMessage,
} from "@whiskeysockets/baileys"
import { createAuthState } from "./auth.js"
import { renderShort } from "./cloud-render.js"
import { dispatchPcCommand, matchPcCommand } from "./pc-commands.js"
import type { AppConfig } from "./config.js"
import type { Agent } from "./agent.js"
import { chunkText, isAuthorized, parseCommand, type IncomingMessage } from "./policy.js"
import type { Store } from "./store.js"

const senderQueues = new Map<string, Promise<void>>()

export const BOT_PREFIX = "OP.BOT "
const LEGACY_BOT_PREFIX = "🤖 "

async function handleMediaMessage(deps: {
  message: WAMessage
  config: AppConfig
  socket: SocketLike
}): Promise<boolean> {
  const { message, config, socket } = deps
  const caption =
    message.message?.videoMessage?.caption ?? message.message?.documentMessage?.caption ?? ""
  const match = matchPcCommand(caption)
  if (!match) return false

  const chatJid = message.key.remoteJid ?? ""
  const key = message.key as { participant?: string; participantPn?: string }
  const senderJid = chatJid.endsWith("@g.us")
    ? key.participantPn ?? key.participant ?? ""
    : chatJid
  if (
    chatJid !== config.allowedGroupJid ||
    !config.allowedSenderJids.includes(senderJid)
  ) {
    return false
  }

  const send = (text: string) => socket.sendMessage(chatJid, { text: `${BOT_PREFIX}${text}` })

  try {
    await send("Video diterima. Memproses di cloud...")
    const downloaded = await downloadMediaMessage(message, "buffer", {})
    const bytes = Buffer.from(downloaded as Uint8Array)
    const workDir = await mkdtemp(join(tmpdir(), "wa-render-"))
    const inputPath = join(workDir, "input.mp4")
    await writeFile(inputPath, bytes)

    const outputPath = await renderShort(inputPath, workDir, {
      ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
      whisper: process.env.WHISPER_PATH || "whisper-cli",
      model: process.env.MODEL_PATH || "ggml-base.bin",
    })
    const result = await readFile(outputPath)

    await socket.sendMessage(chatJid, {
      document: result,
      fileName: "short-output.mp4",
      mimetype: "video/mp4",
      caption: `${BOT_PREFIX}Selesai — ${match.command}`,
    })
  } catch (error) {
    console.error("Gagal memproses video di cloud:", error)
    await send("Gagal memproses video di cloud.")
  }
  return true
}

export function shouldProcess(text: string): boolean {
  return !text.startsWith(BOT_PREFIX) && !text.startsWith(LEGACY_BOT_PREFIX)
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
  if (!isAuthorized(msg, config)) {
    console.log(`Pesan diabaikan: chat=${msg.chatJid} sender=${msg.senderJid}`)
    return
  }

  const pcCommand = matchPcCommand(msg.text)
  if (pcCommand) {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      await send("GITHUB_TOKEN belum tersedia di bot.")
      return
    }
    try {
      await dispatchPcCommand(pcCommand.command, token, pcCommand.args)
      await send(`Perintah ${pcCommand.command} dikirim ke PC. Pastikan runner menyala.`)
    } catch {
      await send("Gagal mengirim perintah ke PC.")
    }
    return
  }

  const parsed = parseCommand(msg.text)
  if (parsed.kind === "command") {
    switch (parsed.name) {
      case "help":
        await send(
          "/help — daftar perintah\n" +
            "/status — status bot\n" +
            "/model — model LLM\n" +
            "/reset — hapus riwayat\n" +
            "Balasan memakai persona master dan skill teks cloud (tanpa akses PC).\n" +
            "Kirim video + caption /yt short untuk diproses di cloud\n" +
            "/yt short <path> — jalankan di PC (jika runner aktif)\n" +
            "/yt video <path> <thumb> — jalankan di PC",
        )
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

  const queueKey = config.allowedSenderJid
  const previous = senderQueues.get(queueKey) ?? Promise.resolve()
  const task = previous.catch(() => {}).then(async () => {
    const answer = await agent.prompt(parsed.text)
    for (const part of chunkText(answer)) {
      await send(part)
    }
  })
  senderQueues.set(queueKey, task)
  await task.finally(() => {
    if (senderQueues.get(queueKey) === task) senderQueues.delete(queueKey)
  })
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
  sendMessage: (
    chatJid: string,
    content: {
      text?: string
      document?: Buffer
      fileName?: string
      mimetype?: string
      caption?: string
    },
  ) => Promise<unknown>
  end: (error?: Error) => void
}

export async function startBot(deps: {
  config: AppConfig
  store: Store
  agent: Agent
  socketFactory?: () => SocketLike
  holder?: { socket?: SocketLike }
  onReady?: () => void
}): Promise<{ app: Express; socket: SocketLike }> {
  const { config, store, agent } = deps
  let currentQr: string | null = null

  const app = createHttpApp({
    config,
    store,
    qrPng: async () => (currentQr ? QRCode.toBuffer(currentQr) : null),
  })

  const { auth, persist } = await createAuthState(store)

  const socket: SocketLike = deps.socketFactory
    ? deps.socketFactory()
    : (makeWASocket({
        auth,
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: false,
      }) as unknown as SocketLike)

  if (deps.holder) deps.holder.socket = socket

  socket.ev.on("creds.update", persist)

  socket.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      const handledMedia = await handleMediaMessage({ message, config, socket })
      if (handledMedia) continue
      const incoming = extractIncoming(message)
      if (!incoming) continue
      console.log(
        `INCOMING chat=${incoming.chatJid} sender=${incoming.senderJid} fromMe=${message.key.fromMe} text=${incoming.text.slice(0, 40)}`,
      )
      if (!shouldProcess(incoming.text)) continue
      void routeMessage({
        msg: incoming,
        config,
        agent,
        send: async (text) => {
          await socket.sendMessage(incoming.chatJid, { text: BOT_PREFIX + text })
          console.log(`OUTGOING chat=${incoming.chatJid} text=${text.slice(0, 40)}`)
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
      deps.onReady?.()
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
