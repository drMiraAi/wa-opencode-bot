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
  const { app } = await startBot({ config, store, agent, holder })

  const server = app.listen(config.port, () => {
    console.log(`Bot siap pada port ${config.port}`)
  })

  const shutdown = () => {
    server.close()
    holder.socket?.end(undefined)
    void sdk.close()
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((error) => {
  console.error("Gagal menjalankan bot:", error)
  process.exitCode = 1
})
