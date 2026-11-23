import { describe, it, expect } from "vitest"
import { buildCropArgs, buildWhisperArgs, toSrt } from "../src/cloud-render.js"

describe("buildCropArgs", () => {
  it("memotong ke 1080x1920", () => {
    const args = buildCropArgs("in.mp4", "out.mp4")
    expect(args).toContain("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1")
    expect(args.at(-1)).toBe("out.mp4")
  })
})

describe("buildWhisperArgs", () => {
  it("memakai bahasa Indonesia dan output JSON", () => {
    const args = buildWhisperArgs("audio.wav", "model.bin", "sub.srt")
    expect(args).toEqual(["-f", "audio.wav", "-m", "model.bin", "-l", "id", "-oj", "-of", "sub"])
  })
})

describe("toSrt", () => {
  it("membuat blok SRT dengan nomor urut", () => {
    const srt = toSrt([{ from: "00:00:00,000", to: "00:00:01,000", text: "halo" }])
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:01,000\nhalo\n")
  })
})
