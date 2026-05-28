import Langfuse from 'langfuse'

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
  baseUrl: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
  flushAt: 1,
  flushInterval: 0,
})

export function isLangfuseEnabled(): boolean {
  return !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)
}
