import { describe, it, expect, vi, afterEach } from "vitest"
import { publishReel } from "../src/ig-publish.js"

describe("publishReel", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("membuat container, menunggu FINISHED, lalu publish", async () => {
    vi.useFakeTimers()
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.includes("media_publish")) {
        return { json: async () => ({ id: "reel_1" }) } as Response
      }
      if (url.includes("/media?")) {
        return { json: async () => ({ id: "creation_1" }) } as Response
      }
      return { json: async () => ({ status_code: "FINISHED" }) } as Response
    })
    vi.stubGlobal("fetch", fetchMock)

    const pending = publishReel({
      videoUrl: "https://example.com/video.mp4",
      caption: "Halo", 
      token: "token",
      igUserId: "ig_1",
    })
    await vi.runAllTimersAsync()
    const id = await pending

    expect(id).toBe("reel_1")
    expect(calls[0].url).toContain("media_type=REELS")
    expect(calls[0].url).toContain("video_url=https%3A%2F%2Fexample.com%2Fvideo.mp4")
    expect(calls.at(-1)?.url).toContain("creation_id=creation_1")
  })
})
