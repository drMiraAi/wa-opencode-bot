import { writeFile } from "node:fs/promises"
import QRCode from "qrcode"
import { Browsers, DisconnectReason, makeWASocket } from "@whiskeysockets/baileys"
import { createAuthState } from "../src/auth.js"
import { createSupabaseStore } from "../src/store.js"
import type { AppConfig } from "../src/config.js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL dan SUPABASE_KEY wajib diisi.")
  process.exit(1)
}

const store = createSupabaseStore({ supabaseUrl, supabaseKey } as AppConfig)
const { auth, persist, flush } = await createAuthState(store)

async function connect() {
  const socket = makeWASocket({
    auth,
    browser: Browsers.macOS("Desktop"),
  })

  socket.ev.on("creds.update", () => {
    persist()
    void flush()
  })

  socket.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      const png = await QRCode.toBuffer(qr)
      await writeFile("wa-qr.png", png)
      console.log("QR tersedia: wa-qr.png")
    }

    if (connection === "open") {
      await flush()
      const groups = await socket.groupFetchAllParticipating()
      for (const group of Object.values(groups)) {
        console.log(`\n${group.subject}\nGROUP: ${group.id}`)
        for (const participant of group.participants ?? []) {
          console.log(`  ${participant.id}`)
        }
      }
      socket.end(undefined)
      process.exit(0)
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode
      if (reason === DisconnectReason.loggedOut) {
        console.error("Sesi WhatsApp logout.")
        process.exit(1)
      }
      console.log("Koneksi restart, mencoba lagi...")
      void connect()
    }
  })
}

void connect()

setTimeout(() => {
  console.error("Timeout: tidak bisa terhubung dalam 3 menit.")
  process.exit(1)
}, 180_000).unref()
