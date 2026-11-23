const GRAPH = process.env.IG_GRAPH_VERSION || "v23.0"

type CreationResponse = { id?: string; error?: { message?: string } }
type StatusResponse = { status_code?: string; error?: { message?: string } }
type PublishResponse = { id?: string; error?: { message?: string } }

function apiUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`https://graph.facebook.com/${GRAPH}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

async function waitForMedia(creationId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(
      apiUrl(creationId, { fields: "status_code", access_token: token }),
      { signal: AbortSignal.timeout(20_000) },
    )
    const data = (await response.json()) as StatusResponse
    if (data.error) throw new Error(data.error.message ?? "Gagal cek status media")
    if (data.status_code === "FINISHED") return
    if (data.status_code === "ERROR") throw new Error("Status media ERROR")
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
  throw new Error("Timeout menunggu media Instagram")
}

export async function publishReel(deps: {
  videoUrl: string
  caption: string
  token: string
  igUserId: string
}): Promise<string> {
  const { videoUrl, caption, token, igUserId } = deps

  const createRes = await fetch(
    apiUrl(`${igUserId}/media`, {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: token,
    }),
    { method: "POST", signal: AbortSignal.timeout(60_000) },
  )
  const created = (await createRes.json()) as CreationResponse
  if (!created.id) throw new Error(created.error?.message ?? "Gagal membuat media container")

  await waitForMedia(created.id, token)

  const publishRes = await fetch(
    apiUrl(`${igUserId}/media_publish`, {
      creation_id: created.id,
      access_token: token,
    }),
    { method: "POST", signal: AbortSignal.timeout(60_000) },
  )
  const published = (await publishRes.json()) as PublishResponse
  if (!published.id) throw new Error(published.error?.message ?? "Gagal publish reel")
  return published.id
}
