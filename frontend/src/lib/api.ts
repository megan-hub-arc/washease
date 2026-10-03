// Next.js embeds this public URL at build time. Rebuild after changing it.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
