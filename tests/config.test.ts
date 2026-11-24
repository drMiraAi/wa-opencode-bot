import { describe, it, expect } from "vitest"
import { loadConfig } from "../src/config.js"

const base = {
  ALLOWED_GROUP_JID: "1203630@g.us",
  ALLOWED_JID: "62812@s.whatsapp.net",
  BOOTSTRAP_TOKEN: "rahasia",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_KEY: "key",
  OPENROUTER_API_KEY: "sk-or-x",
}

describe("loadConfig", () => {
  it("mengisi default port dan model", () => {
    const c = loadConfig(base)
    expect(c.port).toBe(3000)
    expect(c.model).toBe("openrouter/free-router")
    expect(c.workDir).toBe("work")
  })

  it("memecah daftar ALLOWED_JID yang dipisah koma", () => {
    const c = loadConfig({ ...base, ALLOWED_JID: "62812@s.whatsapp.net, 243090988204144@lid" })
    expect(c.allowedSenderJids).toEqual(["62812@s.whatsapp.net", "243090988204144@lid"])
  })

  it("menolak env var yang hilang", () => {
    expect(() => loadConfig({ ...base, SUPABASE_KEY: "" })).toThrow("SUPABASE_KEY")
  })
})
