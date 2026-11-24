const RELEASE_ID = 454797099

export async function uploadMediaToRelease(
  bytes: Buffer,
  fileName: string,
  token: string,
): Promise<string> {
  const safeName = fileName.replace(/[^\w.\-]/g, "_").slice(-60) || "video.mp4"
  const name = `${Date.now()}-${safeName}`
  const response = await fetch(
    `https://uploads.github.com/repos/drMiraAi/wa-opencode-bot/releases/${RELEASE_ID}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/octet-stream",
        "User-Agent": "wa-opencode-bot",
      },
      body: new Uint8Array(bytes),
    },
  )
  if (response.status !== 201) {
    throw new Error(`Gagal upload media: ${response.status}`)
  }
  const asset = (await response.json()) as { browser_download_url: string }
  return asset.browser_download_url
}
