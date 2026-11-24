export type PcCommand = "yt_short" | "yt_video"

export type PcCommandMatch = {
  command: PcCommand
  args: string
}

const aliases: Record<string, PcCommand> = {
  "/yt short": "yt_short",
  "/ytshort": "yt_short",
  "/yt video": "yt_video",
  "/ytvideo": "yt_video",
}

export function matchPcCommand(text: string): PcCommandMatch | null {
  const normalized = text.trim().replace(/\s+/g, " ")
  const lower = normalized.toLowerCase()

  for (const [alias, command] of Object.entries(aliases)) {
    if (lower === alias) return { command, args: "" }
    if (lower.startsWith(`${alias} `)) {
      return { command, args: normalized.slice(alias.length).trim() }
    }
  }
  return null
}

export async function dispatchPcCommand(
  command: PcCommand,
  token: string,
  args = "",
  videoUrl = "",
): Promise<void> {
  const response = await fetch(
    "https://api.github.com/repos/drMiraAi/wa-opencode-bot/actions/workflows/pc-commands.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "wa-opencode-bot",
      },
      body: JSON.stringify({
        ref: "feat/wa-opencode-bot",
        inputs: { command, args, video_url: videoUrl },
      }),
    },
  )
  if (response.status !== 204 && response.status !== 201) {
    throw new Error(`Gagal dispatch: ${response.status}`)
  }
}
