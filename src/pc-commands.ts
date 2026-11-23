export type PcCommand = "yt_short" | "yt_video" | "ig_reels"

const aliases: Record<string, PcCommand> = {
  "/yt short": "yt_short",
  "/ytshort": "yt_short",
  "/yt video": "yt_video",
  "/ytvideo": "yt_video",
  "/ig reels": "ig_reels",
  "/igreels": "ig_reels",
}

export function matchPcCommand(text: string): PcCommand | null {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ")
  return aliases[normalized] ?? null
}

export async function dispatchPcCommand(command: PcCommand, token: string): Promise<void> {
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
      body: JSON.stringify({ ref: "feat/wa-opencode-bot", inputs: { command } }),
    },
  )
  if (response.status !== 204 && response.status !== 201) {
    throw new Error(`Gagal dispatch: ${response.status}`)
  }
}
