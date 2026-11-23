import { readFile } from "node:fs/promises"
import type { Server } from "node:http"
import { OpenCode } from "@opencode/sdk"
import { loadConfig } from "./config.js"
import { createSupabaseStore } from "./store.js"
import { createAgent, formatStatusReport } from "./agent.js"
import { startBot, type SocketLike } from "./transport.js"

async function main() {
  const config = loadConfig(process.env)
  process.env.OPENROUTER_API_KEY = config.openrouterApiKey

  const store = createSupabaseStore(config)
  const sdk = await OpenCode.create()
  const agent = await createAgent({ sdk: sdk as never, store, config })
  const holder: { socket?: SocketLike } = {}

  const report = process.env.REPORT_TEXT
  const reportFile = process.env.REPORT_FILE
  const notifyOnly = process.env.NOTIFY_ONLY === "true"
  let server: Server | undefined
  let statusTimer: ReturnType<typeof setInterval> | undefined
  const reportIntervalMs = process.env.REPORT_INTERVAL_MS
    ? Number(process.env.REPORT_INTERVAL_MS)
    : 300_000
  let closed = false

  const shutdown = () => {
    if (closed) return
    closed = true
    if (statusTimer) clearInterval(statusTimer)
    server?.close()
    holder.socket?.end(undefined)
    void sdk.close()
    if (notifyOnly) process.exit(0)
  }

  const { app } = await startBot({
    config,
    store,
    agent,
    holder,
    onReady: () => {
      if (reportIntervalMs > 0 && !notifyOnly) {
        statusTimer = setInterval(() => {
          void agent
            .status()
            .then((status) =>
              holder.socket?.sendMessage(config.allowedGroupJid, {
                text: `🤖 ${formatStatusReport(status)}`,
              }),
            )
            .catch((error) => console.error("Gagal kirim laporan berkala:", error))
        }, reportIntervalMs)
        statusTimer.unref()
      }

      if (!report && !reportFile) return
      const caption = `🤖 ${report ?? "File proyek"}`

      const send = async () => {
        if (!holder.socket) return
        if (reportFile) {
          const bytes = await readFile(reportFile)
          await holder.socket.sendMessage(config.allowedGroupJid, {
            document: bytes,
            fileName: "wa-opencode-bot-session.zip",
            mimetype: "application/zip",
            caption,
          })
        } else {
          await holder.socket.sendMessage(config.allowedGroupJid, { text: caption })
        }
      }

      void send()
        .then(() => console.log("Laporan terkirim ke grup."))
        .catch((error) => console.error("Gagal mengirim laporan:", error))
        .finally(() => {
          if (notifyOnly) setTimeout(shutdown, 500)
        })
    },
  })

  server = app.listen(config.port, () => {
    console.log(`Bot siap pada port ${config.port}`)
  })

  const diagnoseMs = process.env.DIAGNOSE_MS ? Number(process.env.DIAGNOSE_MS) : 0
  if (diagnoseMs > 0) {
    setTimeout(() => {
      shutdown()
      process.exit(0)
    }, diagnoseMs)
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((error) => {
  console.error("Gagal menjalankan bot:", error)
  process.exitCode = 1
})
