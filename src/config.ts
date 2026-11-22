export interface AppConfig {
  port: number
  allowedGroupJid: string
  allowedSenderJid: string
  bootstrapToken: string
  supabaseUrl: string
  supabaseKey: string
  openrouterApiKey: string
  model: string
  workDir: string
}

const required = [
  "ALLOWED_GROUP_JID",
  "ALLOWED_JID",
  "BOOTSTRAP_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "OPENROUTER_API_KEY",
] as const

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  for (const name of required) {
    if (!env[name]) {
      throw new Error(`${name} wajib diisi`)
    }
  }

  const port = env.PORT ? Number(env.PORT) : 3000
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT harus bilangan bulat positif")
  }

  return {
    port,
    allowedGroupJid: env.ALLOWED_GROUP_JID!,
    allowedSenderJid: env.ALLOWED_JID!,
    bootstrapToken: env.BOOTSTRAP_TOKEN!,
    supabaseUrl: env.SUPABASE_URL!,
    supabaseKey: env.SUPABASE_KEY!,
    openrouterApiKey: env.OPENROUTER_API_KEY!,
    model: env.MODEL || "openrouter/free-router",
    workDir: env.WORK_DIR || "work",
  }
}
