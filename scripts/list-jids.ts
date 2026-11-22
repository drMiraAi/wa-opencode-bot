import { Browsers, makeWASocket } from "@whiskeysockets/baileys"
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
const socket = makeWASocket({
  auth,
  browser: Browsers.macOS("Desktop"),
  printQRInTerminal: true,
})

socket.ev.on("creds.update", persist)

socket.ev.on("connection.update", async ({ connection }) => {
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
  }
  if (connection === "close") {
    console.error("Koneksi WhatsApp terputus sebelum daftar grup selesai.")
    process.exit(1)
  }
})

setTimeout(() => {
  console.error("Timeout: tidak bisa terhubung dalam 2 menit.")
  process.exit(1)
}, 120_000).unref()
