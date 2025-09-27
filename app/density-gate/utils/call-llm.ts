async function callLLM(
  provider: "openai" | "xai",
  apiKey: string,
  system: string,
  user: string,
  attempt = 0,
): Promise<string> {
  if (!apiKey) throw new Error("Missing API key")
  const maxAttempts = 5
  const baseDelay = 800 // ms

  const doFetch = async () => {
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
        }),
      })
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status })
      const j = await r.json()
      return j?.choices?.[0]?.message?.content ?? ""
    } else {
      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-2-latest",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
        }),
      })
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status })
      const j = await r.json()
      return j?.choices?.[0]?.message?.content ?? ""
    }
  }

  try {
    return await doFetch()
  } catch (e: any) {
    const status = e?.status || 0
    if (attempt < maxAttempts - 1 && (status === 429 || status >= 500)) {
      const jitter = Math.random() * 200
      const delay = Math.min(8000, baseDelay * Math.pow(2, attempt)) + jitter
      await new Promise((r) => setTimeout(r, delay))
      return callLLM(provider, apiKey, system, user, attempt + 1)
    }
    throw e
  }
}
