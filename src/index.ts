import type { Server } from "node:http"
import { OpenCode } from "@opencode/sdk"
import { loadConfig } from "./config.js"
import { createSupabaseStore } from "./store.js"
import { createAgent } from "./agent.js"
import { startBot, type SocketLike } from "./transport.js"

async function main() {
  const config = loadConfig(process.env)
  process.env.OPENROUTER_API_KEY = config.openrouterApiKey

  const store = createSupabaseStore(config)
  const sdk = await OpenCode.create()
  const agent = await createAgent({ sdk: sdk as never, store, config })
  const holder: { socket?: SocketLike } = {}

  const report = process.env.REPORT_TEXT
  const notifyOnly = process.env.NOTIFY_ONLY === "true"
  let server: Server | undefined
  let closed = false

  const shutdown = () => {
    if (closed) return
    closed = true
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
      if (!report) return
      void holder.socket
        ?.sendMessage(config.allowedGroupJid, { text: `🤖 ${report}` })
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

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((error) => {
  console.error("Gagal menjalankan bot:", error)
  process.exitCode = 1
})
