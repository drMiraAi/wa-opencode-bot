import { describe, it, expect } from "vitest"
import { buildDocumentMessage } from "../src/report.js"

const bytes = Buffer.from("isi file")

describe("buildDocumentMessage", () => {
  it("memakai nama file asli, bukan nama hardcoded", () => {
    const msg = buildDocumentMessage(
      "C:/parts/OpenCode-Portable.zip.part009",
      bytes,
      "🤖 OpenCode Portable 9/17",
    )
    expect(msg.fileName).toBe("OpenCode-Portable.zip.part009")
    expect(msg.document).toBe(bytes)
    expect(msg.caption).toBe("🤖 OpenCode Portable 9/17")
  })

  it("memilih mimetype sesuai ekstensi", () => {
    expect(buildDocumentMessage("a/PETUNJUK.txt", bytes, "petunjuk").mimetype).toBe("text/plain")
    expect(buildDocumentMessage("a/arsip.zip", bytes, "arsip").mimetype).toBe("application/zip")
    expect(buildDocumentMessage("a/data.part001", bytes, "bagian").mimetype).toBe("application/octet-stream")
  })
})
