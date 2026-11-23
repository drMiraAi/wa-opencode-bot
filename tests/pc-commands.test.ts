import { describe, it, expect, vi, afterEach } from "vitest"
import { matchPcCommand, dispatchPcCommand } from "../src/pc-commands.js"

describe("matchPcCommand", () => {
  it("mengenali tiga alias perintah", () => {
    expect(matchPcCommand("/yt short")).toBe("yt_short")
    expect(matchPcCommand("/ytvideo")).toBe("yt_video")
    expect(matchPcCommand("/IG REELS")).toBe("ig_reels")
  })

  it("mengabaikan perintah lain", () => {
    expect(matchPcCommand("/help")).toBeNull()
  })
})

describe("dispatchPcCommand", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("mengirim workflow_dispatch dengan command yang benar", async () => {
    const fetchMock = vi.fn(async () => ({ status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    await dispatchPcCommand("yt_short", "token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as { body: string }
    expect(JSON.parse(init.body)).toEqual({
      ref: "feat/wa-opencode-bot",
      inputs: { command: "yt_short" },
    })
  })
})
