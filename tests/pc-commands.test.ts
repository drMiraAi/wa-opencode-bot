import { describe, it, expect, vi, afterEach } from "vitest"
import { matchPcCommand, dispatchPcCommand } from "../src/pc-commands.js"

describe("matchPcCommand", () => {
  it("mengenali tiga alias perintah", () => {
    expect(matchPcCommand("/yt short")?.command).toBe("yt_short")
    expect(matchPcCommand("/ytvideo")?.command).toBe("yt_video")
    expect(matchPcCommand("/ig reels")).toBeNull()
  })

  it("mengambil argumen setelah perintah", () => {
    expect(matchPcCommand('/yt short "C:\\video.mp4"')).toEqual({
      command: "yt_short",
      args: '"C:\\video.mp4"',
    })
  })

  it("mengabaikan perintah lain", () => {
    expect(matchPcCommand("/help")).toBeNull()
  })
})

describe("dispatchPcCommand", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("mengirim workflow_dispatch dengan command dan args", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: { body?: string }) => ({ status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    await dispatchPcCommand("yt_short", "token", '"C:\\video.mp4"')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as { body: string }
    expect(JSON.parse(init.body)).toEqual({
      ref: "feat/wa-opencode-bot",
      inputs: { command: "yt_short", args: '"C:\\video.mp4"', video_url: "" },
    })
  })
})
