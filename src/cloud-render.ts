import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

export function buildCropArgs(input: string, output: string): string[] {
  return [
    "-y",
    "-i",
    input,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    output,
  ]
}

export function buildWhisperArgs(audio: string, model: string, srt: string): string[] {
  return ["-f", audio, "-m", model, "-l", "id", "-oj", "-of", srt.replace(/\.srt$/, "")]
}

export function toSrt(segments: Array<{ from: string; to: string; text: string }>): string {
  return segments
    .map(
      (seg, i) =>
        `${i + 1}\n${seg.from} --> ${seg.to}\n${seg.text.trim()}\n`,
    )
    .join("\n")
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} gagal (${code}): ${stderr.slice(-500)}`))
    })
  })
}

export async function renderShort(
  inputPath: string,
  workDir: string,
  settings: { ffmpeg: string; whisper: string; model: string },
): Promise<string> {
  const cropped = join(workDir, "cropped.mp4")
  const audio = join(workDir, "audio.wav")
  const output = join(workDir, "output.mp4")
  const srt = join(workDir, "subtitle.srt")

  await run(settings.ffmpeg, buildCropArgs(inputPath, cropped))
  await run(settings.ffmpeg, ["-y", "-i", cropped, "-vn", "-ac", "1", "-ar", "16000", audio])
  await run(settings.whisper, buildWhisperArgs(audio, settings.model, srt))
  const srtFile = join(workDir, "subtitle.json")
  const raw = await import("node:fs/promises").then((fs) => fs.readFile(srtFile, "utf8")).catch(() => "[]")
  let segments: Array<{ from: string; to: string; text: string }> = []
  try {
    const parsed = JSON.parse(raw) as Array<{
      offsets: { from: string; to: string }
      text: string
    }>
    segments = parsed.map((p) => ({ from: p.offsets.from, to: p.offsets.to, text: p.text }))
  } catch {
    segments = []
  }
  if (segments.length === 0) {
    await run(settings.ffmpeg, ["-y", "-i", cropped, "-c", "copy", output])
    return output
  }

  await writeFile(srt, toSrt(segments))

  await run(settings.ffmpeg, [
    "-y",
    "-i",
    cropped,
    "-vf",
    `subtitles=filename=${srt}:force_style='FontSize=28,Alignment=2,MarginV=80'`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "copy",
    output,
  ])

  return output
}
