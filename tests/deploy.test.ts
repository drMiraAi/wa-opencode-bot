import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

describe("deploy assets", () => {
  it("Dockerfile memakai Node 22", () => {
    expect(readFileSync("Dockerfile", "utf8")).toContain("node:22")
  })

  it("README mencantumkan semua env var wajib", () => {
    const readme = readFileSync("README.md", "utf8")
    for (const name of [
      "ALLOWED_GROUP_JID",
      "ALLOWED_JID",
      "BOOTSTRAP_TOKEN",
      "SUPABASE_URL",
      "SUPABASE_KEY",
      "OPENROUTER_API_KEY",
    ]) {
      expect(readme).toContain(name)
    }
  })
})
