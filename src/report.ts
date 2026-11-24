import { basename } from "node:path"

export type DocumentMessage = {
  document: Buffer
  fileName: string
  mimetype: string
  caption: string
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
}

export function buildDocumentMessage(
  filePath: string,
  bytes: Buffer,
  caption: string,
): DocumentMessage {
  const fileName = basename(filePath)
  const dot = fileName.lastIndexOf(".")
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : ""
  return {
    document: bytes,
    fileName,
    mimetype: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
    caption,
  }
}
