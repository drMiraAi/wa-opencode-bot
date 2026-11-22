import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { createHttpApp, extractIncoming, routeMessage, shouldProcess, startBot, type SocketLike } from "../src/transport.js"
import { createMemoryStore } from "../src/store.js"
import type { AppConfig } from "../src/config.js"
import type { Agent } from "../src/agent.js"

const config = {
  allowedGroupJid: "1203630@g.us",
  allowedSenderJid: "62812@s.whatsapp.net",
  bootstrapToken: "rahasia",
  port: 3000,
} as AppConfig

describe("startBot", () => {
  it("mengganti socket saat koneksi terputus", async () => {
    const sockets: Array<{
      handlers: Record<string, (payload: unknown) => void>
      end: ReturnType<typeof vi.fn>
    }> = []
    const socketFactory = () => {
      const handlers: Record<string, (payload: unknown) => void> = {}
      const socket = {
        handlers,
        ev: {
          on: (event: string, handler: (payload: unknown) => void) => {
            handlers[event] = handler
          },
        },
        sendMessage: vi.fn(async () => {}),
        end: vi.fn(),
      }
      sockets.push(socket)
      return socket
    }
    const holder: { socket?: SocketLike } = {}

    await startBot({
      config,
      store: createMemoryStore(),
      agent: {} as Agent,
      socketFactory: socketFactory as never,
      holder,
    })
    expect(holder.socket).toBe(sockets[0])

    sockets[0].handlers["connection.update"]({
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 500 } } },
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(holder.socket).toBe(sockets[1])
  })

  it("memanggil onReady saat koneksi terbuka", async () => {
    const handlers: Record<string, (payload: unknown) => void> = {}
    const socketFactory = () => ({
      handlers,
      ev: {
        on: (event: string, handler: (payload: unknown) => void) => {
          handlers[event] = handler
        },
      },
      sendMessage: vi.fn(async () => {}),
      end: vi.fn(),
    })
    const onReady = vi.fn()

    await startBot({
      config,
      store: createMemoryStore(),
      agent: {} as Agent,
      socketFactory: socketFactory as never,
      onReady,
    })
    handlers["connection.update"]({ connection: "open" })
    expect(onReady).toHaveBeenCalledTimes(1)
  })
})

describe("extractIncoming", () => {
  it("memakai participantPn bila participant berbentuk LID", () => {
    const message = {
      key: {
        remoteJid: "1203630@g.us",
        participant: "62812@s.whatsapp.net_lid",
        participantPn: "62812@s.whatsapp.net",
      },
      message: { conversation: "/status" },
    } as never
    expect(extractIncoming(message)?.senderJid).toBe("62812@s.whatsapp.net")
  })
})

describe("shouldProcess", () => {
  it("menerima perintah master", () => {
    expect(shouldProcess("/status")).toBe(true)
  })

  it("menolak balasan bot sendiri", () => {
    expect(shouldProcess("🤖 jawaban")).toBe(false)
  })
})

describe("http", () => {
  it("menolak /qr tanpa token", async () => {
    const app = createHttpApp({ config, store: createMemoryStore(), qrPng: async () => Buffer.from("qr") })
    expect((await request(app).get("/qr")).status).toBe(404)
  })

  it("mengembalikan 200 untuk /health", async () => {
    const app = createHttpApp({ config, store: createMemoryStore(), qrPng: async () => Buffer.from("qr") })
    expect((await request(app).get("/health")).status).toBe(200)
  })
})

describe("routeMessage", () => {
  it("mengabaikan pesan dari orang lain", async () => {
    const send = vi.fn(async () => {})
    const agent = { prompt: vi.fn(async () => "jawaban") } as unknown as Agent
    await routeMessage({
      msg: { chatJid: "1203630@g.us", senderJid: "62813@s.whatsapp.net", text: "halo" },
      config,
      agent,
      send,
    })
    expect(send).not.toHaveBeenCalled()
  })

  it("mengirim balasan yang dipecah per 3000 karakter", async () => {
    const send = vi.fn(async () => {})
    const agent = { prompt: vi.fn(async () => "x".repeat(7000)) } as unknown as Agent
    await routeMessage({
      msg: { chatJid: "1203630@g.us", senderJid: "62812@s.whatsapp.net", text: "halo" },
      config,
      agent,
      send,
    })
    expect(send).toHaveBeenCalledTimes(3)
  })
})
