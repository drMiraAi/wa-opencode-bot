import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { createHttpApp, routeMessage, shouldProcess } from "../src/transport.js"
import { createMemoryStore } from "../src/store.js"
import type { AppConfig } from "../src/config.js"
import type { Agent } from "../src/agent.js"

const config = {
  allowedGroupJid: "1203630@g.us",
  allowedSenderJid: "62812@s.whatsapp.net",
  bootstrapToken: "rahasia",
  port: 3000,
} as AppConfig

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
