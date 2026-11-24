import { describe, it, expect } from "vitest"
import { isAuthorized, parseCommand, chunkText } from "../src/policy.js"
import type { AppConfig } from "../src/config.js"

const config = {
  allowedGroupJid: "1203630@g.us",
  allowedSenderJid: "62812@s.whatsapp.net",
  allowedSenderJids: ["62812@s.whatsapp.net", "243090988204144@lid"],
} as AppConfig

describe("policy", () => {
  it("menerima grup dan pengirim yang benar", () => {
    expect(isAuthorized({ chatJid: "1203630@g.us", senderJid: "62812@s.whatsapp.net" }, config)).toBe(true)
  })

  it("menerima pengirim dalam bentuk LID", () => {
    expect(isAuthorized({ chatJid: "1203630@g.us", senderJid: "243090988204144@lid" }, config)).toBe(true)
  })

  it("menolak pengirim lain di grup yang sama", () => {
    expect(isAuthorized({ chatJid: "1203630@g.us", senderJid: "62813@s.whatsapp.net" }, config)).toBe(false)
  })

  it("menolak grup lain", () => {
    expect(isAuthorized({ chatJid: "999@g.us", senderJid: "62812@s.whatsapp.net" }, config)).toBe(false)
  })

  it("memisahkan perintah slash dari pesan biasa", () => {
    expect(parseCommand("/reset")).toEqual({ kind: "command", name: "reset" })
    expect(parseCommand("halo bot")).toEqual({ kind: "message", text: "halo bot" })
  })

  it("memecah dan menyatukan kembali teks panjang", () => {
    const text = "a".repeat(7500)
    const parts = chunkText(text)
    expect(parts).toHaveLength(3)
    expect(parts.join("")).toBe(text)
    expect(parts.every((p) => p.length <= 3000)).toBe(true)
  })
})
