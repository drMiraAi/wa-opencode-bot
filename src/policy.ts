import type { AppConfig } from "./config.js"

export type IncomingMessage = {
  chatJid: string
  senderJid: string
  text: string
}

export function isAuthorized(
  msg: { chatJid: string; senderJid: string },
  config: AppConfig,
): boolean {
  return msg.chatJid === config.allowedGroupJid && msg.senderJid === config.allowedSenderJid
}

export function parseCommand(
  text: string,
): { kind: "command"; name: string } | { kind: "message"; text: string } {
  const trimmed = text.trim()
  if (trimmed.startsWith("/") && trimmed.length > 1) {
    return { kind: "command", name: trimmed.slice(1).split(/\s+/)[0].toLowerCase() }
  }
  return { kind: "message", text: text.trim() }
}

export function chunkText(text: string, max = 3000): string[] {
  if (text.length === 0) return [""]
  const parts: string[] = []
  for (let i = 0; i < text.length; i += max) {
    parts.push(text.slice(i, i + max))
  }
  return parts
}
