"use client"

import { useState, useEffect } from "react"
import DensityGateV2, { type DensityGateTargets, type DensityGateResult } from "./DensityGate_v2"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import JSZip from "jszip"
import { DOMParser } from "xmldom"

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

function extractUrls(html: string): Set<string> {
  const set = new Set<string>()
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.querySelectorAll("a[href]").forEach((a) => {
    try {
      set.add(new URL((a as HTMLAnchorElement).href).href)
    } catch {}
  })
  return set
}

function stripNewUrls(originalHtml: string, newHtml: string, allowDomains: string[]): string {
  const before = extractUrls(originalHtml)
  const doc = new DOMParser().parseFromString(newHtml, "text/html")
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = (a as HTMLAnchorElement).href
    let ok = before.has(href)
    if (!ok) {
      try {
        const u = new URL(href)
        ok = allowDomains.some((dom) => u.hostname === dom || u.hostname.endsWith(`.${dom}`))
      } catch {}
    }
    if (!ok) {
      const span = doc.createTextNode((a as HTMLAnchorElement).textContent || "")
      a.replaceWith(span) // unwrap link, keep text
    }
  })
  return doc.body.innerHTML
}

async function semaphore<T>(pool: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = []
  let i = 0
  const workers = Array(Math.max(1, pool))
    .fill(0)
    .map(async () => {
      while (i < tasks.length) {
        const cur = i++
        results[cur] = await tasks[cur]()
      }
    })
  await Promise.all(workers)
  return results
}

// ---------- Types ----------
export type Draft = {
  id: string
  name: string // filename or label
  raw: string // original user input
  html: string // normalized HTML sent to gate
  meta: {
    title?: string
    description?: string
    h1?: string
    primary: string
    secondaries: string[]
  }
  gate?: DensityGateResult // last evaluation result
  fixedHtml?: string // most recent fixed version
  history: { step: "upload" | "eval" | "fix"; at: number; notes?: string }[]
}

// ---------- Helpers ----------
const id = () => Math.random().toString(36).slice(2)

function normalizeToHtml(input: string): string {
  // Basic heuristic: if it looks like HTML already, trust it; otherwise wrap in <p>
  const maybeHtml = /<\w+[^>]*>/.test(input)
  if (maybeHtml) return input
  // Convert simple line breaks to paragraphs
  const paras = input
    .split(/\n{2,}/g)
    .map((x) => `<p>${x.replace(/\n/g, "<br/>")}</p>`) // preserve single line breaks
    .join("\n")
  return paras || `<p>${input}</p>`
}

function downloadFile(name: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function downloadZip(files: { path: string; content: string }[], zipName = "passed_articles.zip") {
  const zip = new JSZip()
  files.forEach((f) => zip.file(f.path, f.content))
  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = zipName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// Build a strict, provider-agnostic system prompt from gate failures
function buildFixPrompt(d: Draft): { system: string; user: string } {
  const g = d.gate!
  const failing = (g.checks || []).filter((c) => !c.pass)
  const hints = failing.map((c) => `- ${c.label}${c.hint ? ` (hint: ${c.hint})` : ""}`).join("\n")
  const system =
    `You are an SEO editor that must EXACTLY satisfy the following guardrails.\n` +
    `Return ONLY valid HTML for the article body. Do not add scripts or external links except where specified.\n` +
    `Preserve meaning. Improve clarity. Obey every requirement.`
  const user =
    `Fix this article so it PASSES all checks.\n` +
    `PRIMARY: "${d.meta.primary}"\n` +
    `SECONDARIES: ${d.meta.secondaries.map((s) => `"${s}"`).join(", ")}\n` +
    `TITLE: ${d.meta.title ?? "(none)"}\n` +
    `META DESCRIPTION: ${d.meta.description ?? "(none)"}\n` +
    `H1: ${d.meta.h1 ?? "(none)"}\n\n` +
    `FAILURES TO FIX:\n${hints || "(none – but you requested a fix anyway)"}\n\n` +
    `ARTICLE HTML:\n${d.html}`
  return { system, user }
}

// ---------- Main Page ----------
export default function DensityGateStandalonePage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [provider, setProvider] = useState<"openai" | "xai">("openai")
  const [apiKey, setApiKey] = useState<string>("")
  const [targets, setTargets] = useState<Partial<DensityGateTargets>>({})
  const [busy, setBusy] = useState(false)
  const [autoLoop, setAutoLoop] = useState(true)
  const [maxPasses, setMaxPasses] = useState(3)
  const [queueProgress, setQueueProgress] = useState<{ completed: number; total: number; current?: string } | null>(
    null,
  )
  const [concurrency, setConcurrency] = useState(3)
  const [mounted, setMounted] = useState(false)

  const [brandTokens, setBrandTokens] = useState<string>("PacketDrip, BitCans, Drip Demons")
  const [allowDomains, setAllowDomains] = useState<string>("yourdomain.com")

  useEffect(() => {
    setMounted(true)

    if (typeof window !== "undefined") {
      const savedProvider = localStorage.getItem("dg_provider") as "openai" | "xai"
      const savedApiKey = localStorage.getItem("dg_apiKey")

      if (savedProvider) {
        setProvider(savedProvider)
      }
      if (savedApiKey) {
        setApiKey(savedApiKey)
      }
    }
  }, [])

  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("dg_provider", provider)
    }
  }, [provider, mounted])

  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("dg_apiKey", apiKey)
    }
  }, [apiKey, mounted])

  if (!mounted) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  // Upload handlers
  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).slice(0, 20)
    const texts = await Promise.all(arr.map((f) => f.text()))
    const newDrafts: Draft[] = texts.map((raw, i) => ({
      id: id(),
      name: arr[i].name || `Draft_${i + 1}.txt`,
      raw,
      html: normalizeToHtml(raw),
      meta: { primary: "", secondaries: [] },
      history: [{ step: "upload", at: Date.now() }],
    }))
    setDrafts((d) => [...d, ...newDrafts])
  }

  const onPasteBulk = (bulk: string) => {
    const chunks = bulk
      .split(/\n\n-----+\n\n|\n\n\n+/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
    const newDrafts: Draft[] = chunks.map((raw, i) => ({
      id: id(),
      name: `Pasted_${drafts.length + i + 1}.txt`,
      raw,
      html: normalizeToHtml(raw),
      meta: { primary: "", secondaries: [] },
      history: [{ step: "upload", at: Date.now() }],
    }))
    setDrafts((d) => [...d, ...newDrafts])
  }

  const updateDraftMeta = (id: string, meta: Partial<Draft["meta"]>) => {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, meta: { ...d.meta, ...meta } } : d)))
  }

  const onEvaluate = (id: string, gate: DensityGateResult) => {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, gate } : d)))
  }

  const allPassed = drafts.filter((d) => d.gate?.pass)
  const failing = drafts.filter((d) => d.gate && !d.gate.pass)

  // Fix a single draft via provider
  const fixOne = async (d: Draft) => {
    const { system, user } = buildFixPrompt(d)
    let html = await callLLM(provider, apiKey, system, user)
    const allow = allowDomains
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    html = stripNewUrls(d.html, html, allow)

    setDrafts((list) =>
      list.map((x) =>
        x.id === d.id ? { ...x, fixedHtml: html, html, history: [...x.history, { step: "fix", at: Date.now() }] } : x,
      ),
    )
  }

  const fixAll = async () => {
    setBusy(true)
    setQueueProgress({ completed: 0, total: 0 })

    try {
      for (let pass = 1; pass <= maxPasses; pass++) {
        const needFix = drafts.filter((d) => d.gate && !d.gate.pass)
        if (needFix.length === 0) break

        console.log(`[v0] Starting pass ${pass}/${maxPasses} with ${needFix.length} drafts`)

        const tasks = needFix.map(
          (d) => () =>
            fixOne(d).catch((error) => {
              console.error(`[v0] Failed to fix draft ${d.name}:`, error)
              // Continue processing other drafts even if one fails
            }),
        )

        setQueueProgress({ completed: 0, total: needFix.length })

        // Process with semaphore
        await semaphore(concurrency, tasks)

        setQueueProgress({ completed: needFix.length, total: needFix.length })

        if (!autoLoop) break // stop after one pass if toggled off

        // Give React a tick to re-evaluate gates before next pass
        await new Promise((r) => setTimeout(r, 100))
      }
    } finally {
      setBusy(false)
      setQueueProgress(null)
    }
  }

  // Save utilities
  const savePassedAsZip = async () => {
    const files = allPassed.map((d) => ({ path: d.name.replace(/\.[^.]+$/, "") + "_PASSED.html", content: d.html }))
    await downloadZip(files)
  }

  const saveAllAudits = async () => {
    const payload = drafts.map((d) => ({
      id: d.id,
      name: d.name,
      passed: !!d.gate?.pass,
      audit: d.gate?.auditJson ?? null,
    }))
    downloadFile("density_audits.json", JSON.stringify(payload, null, 2), "application/json")
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">DensityGate – Bulk Draft Uploader</h1>
        <div className="flex items-center gap-3">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "openai" | "xai")}
            className="border rounded px-2 py-1 bg-background"
          >
            <option value="openai">OpenAI</option>
            <option value="xai">xAI Grok</option>
          </select>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key (stored locally)"
            className="w-72"
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Upload drafts (1–20)</Label>
              <Input type="file" accept=".txt,.md,.html" multiple onChange={(e) => onFiles(e.target.files)} />
              <p className="text-xs opacity-70 mt-1">Accepted: .txt, .md, .html</p>
            </div>
            <div>
              <Label>Or paste drafts (separate with a blank line or a line of dashes)</Label>
              <Textarea
                rows={6}
                placeholder={"Draft A...\n\n-----\n\nDraft B..."}
                onBlur={(e) => e.target.value.trim() && onPasteBulk(e.target.value)}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Primary density min/max (%)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.0"
                  onChange={(e) => setTargets((t) => ({ ...t, primaryMin: (+e.target.value || 0) / 100 }))}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.8"
                  onChange={(e) => setTargets((t) => ({ ...t, primaryMax: (+e.target.value || 0) / 100 }))}
                />
              </div>
            </div>
            <div>
              <Label>Word count min</Label>
              <Input
                type="number"
                placeholder="1200"
                onChange={(e) => setTargets((t) => ({ ...t, wordCountMin: +e.target.value || undefined }))}
              />
            </div>
            <div>
              <Label>Flesch min</Label>
              <Input
                type="number"
                placeholder="55"
                onChange={(e) => setTargets((t) => ({ ...t, fleschMin: +e.target.value || undefined }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Brand Tokens (required in content)</Label>
              <Input
                value={brandTokens}
                onChange={(e) => setBrandTokens(e.target.value)}
                placeholder="PacketDrip, BitCans, Drip Demons"
              />
              <p className="text-xs opacity-70 mt-1">Comma-separated brand terms that must appear</p>
            </div>
            <div>
              <Label>Allowed Domains (for links)</Label>
              <Input
                value={allowDomains}
                onChange={(e) => setAllowDomains(e.target.value)}
                placeholder="yourdomain.com, example.com"
              />
              <p className="text-xs opacity-70 mt-1">AI-added links to other domains will be stripped</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoLoop} onCheckedChange={setAutoLoop} id="autoloop" />
              <Label htmlFor="autoloop">Auto‑loop fix → re‑gate</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label>Max passes</Label>
              <Input
                type="number"
                className="w-20"
                value={maxPasses}
                onChange={(e) => setMaxPasses(Math.max(1, +e.target.value || 1))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Concurrency</Label>
              <Input
                type="number"
                className="w-20"
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, Math.min(10, +e.target.value || 3)))}
                min="1"
                max="10"
              />
            </div>
            <Button variant="secondary" onClick={saveAllAudits}>
              Export audits JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {queueProgress && (
        <Card className="border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Processing Queue</span>
              <span className="text-sm text-muted-foreground">
                {queueProgress.completed}/{queueProgress.total}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(queueProgress.completed / queueProgress.total) * 100}%` }}
              />
            </div>
            {queueProgress.current && (
              <p className="text-sm text-muted-foreground">Currently processing: {queueProgress.current}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Needs Fixes */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Needs Fixes</h2>
            <Button disabled={busy || failing.length === 0 || !apiKey} onClick={fixAll}>
              {busy ? `Fixing... (${concurrency} at a time)` : `Auto‑fix ${failing.length || 0}`}
            </Button>
          </div>
          <div className="space-y-4">
            {drafts
              .filter((d) => d.gate && !d.gate.pass)
              .map((d) => (
                <Card key={d.id} className="border-red-500/30">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{d.name}</div>
                      <div className="flex gap-2 items-center">
                        <Badge variant="destructive">FAIL</Badge>
                        <Button size="sm" variant="outline" onClick={() => fixOne(d)} disabled={busy || !apiKey}>
                          Fix this
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            downloadFile(d.name.replace(/\.[^.]+$/, "") + "_CURRENT.html", d.html, "text/html")
                          }
                        >
                          Save current
                        </Button>
                      </div>
                    </div>

                    {/* Meta controls */}
                    <div className="grid md:grid-cols-4 gap-2">
                      <Input
                        placeholder="Primary keyword (exact phrase)"
                        value={d.meta.primary}
                        onChange={(e) => updateDraftMeta(d.id, { primary: e.target.value })}
                      />
                      <Input
                        placeholder="Secondaries (comma‑sep)"
                        value={d.meta.secondaries.join(", ")}
                        onChange={(e) =>
                          updateDraftMeta(d.id, {
                            secondaries: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                      <Input
                        placeholder="Title (optional)"
                        value={d.meta.title || ""}
                        onChange={(e) => updateDraftMeta(d.id, { title: e.target.value })}
                      />
                      <Input
                        placeholder="Meta description (optional)"
                        value={d.meta.description || ""}
                        onChange={(e) => updateDraftMeta(d.id, { description: e.target.value })}
                      />
                    </div>

                    <DensityGateV2
                      draftHtml={d.html}
                      primary={d.meta.primary}
                      secondaries={d.meta.secondaries}
                      title={d.meta.title}
                      metaDescription={d.meta.description}
                      h1={d.meta.h1}
                      targets={{
                        ...targets,
                        brandTokens: brandTokens
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }}
                      onEvaluate={(res) => onEvaluate(d.id, res)}
                    />

                    <details>
                      <summary className="cursor-pointer text-sm opacity-80">Preview</summary>
                      <div className="prose prose-sm max-w-none mt-2" dangerouslySetInnerHTML={{ __html: d.html }} />
                    </details>
                  </CardContent>
                </Card>
              ))}
            {drafts.filter((d) => d.gate && !d.gate.pass).length === 0 && (
              <p className="text-sm opacity-70">No failing drafts.</p>
            )}
          </div>
        </section>

        {/* Passed */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Passed</h2>
            <Button variant="outline" onClick={savePassedAsZip} disabled={allPassed.length === 0}>
              Save all passed (.zip)
            </Button>
          </div>
          <div className="space-y-4">
            {allPassed.map((d) => (
              <Card key={d.id} className="border-emerald-500/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.name.replace(/\.[^.]+$/, "") + "_PASSED.html"}</div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="success" className="bg-emerald-600">
                        PASS
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadFile(d.name.replace(/\.[^.]+$/, "") + "_PASSED.html", d.html, "text/html")
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <DensityGateV2
                    draftHtml={d.html}
                    primary={d.meta.primary}
                    secondaries={d.meta.secondaries}
                    title={d.meta.title}
                    metaDescription={d.meta.description}
                    h1={d.meta.h1}
                    targets={{
                      ...targets,
                      brandTokens: brandTokens
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }}
                    onEvaluate={(res) => onEvaluate(d.id, res)}
                  />
                </CardContent>
              </Card>
            ))}
            {allPassed.length === 0 && <p className="text-sm opacity-70">No passed drafts yet.</p>}
          </div>
        </section>
      </div>

      {/* Un‑evaluated drafts */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Un‑evaluated</h2>
        <div className="grid gap-4">
          {drafts
            .filter((d) => !d.gate)
            .map((d) => (
              <Card key={d.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.name}</div>
                    <div className="flex gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDrafts((list) =>
                            list.map((x) => (x.id === d.id ? { ...x, html: normalizeToHtml(x.raw) } : x)),
                          )
                        }
                      >
                        Normalize
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          setDrafts((list) => list.map((x) => (x.id === d.id ? { ...x, gate: { ...x.gate! } } : x)))
                        }
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-2">
                    <Input
                      placeholder="Primary keyword (exact phrase)"
                      value={d.meta.primary}
                      onChange={(e) => updateDraftMeta(d.id, { primary: e.target.value })}
                    />
                    <Input
                      placeholder="Secondaries (comma‑sep)"
                      value={d.meta.secondaries.join(", ")}
                      onChange={(e) =>
                        updateDraftMeta(d.id, {
                          secondaries: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                    <Input
                      placeholder="Title (optional)"
                      value={d.meta.title || ""}
                      onChange={(e) => updateDraftMeta(d.id, { title: e.target.value })}
                    />
                    <Input
                      placeholder="Meta description (optional)"
                      value={d.meta.description || ""}
                      onChange={(e) => updateDraftMeta(d.id, { description: e.target.value })}
                    />
                  </div>

                  <DensityGateV2
                    draftHtml={d.html}
                    primary={d.meta.primary}
                    secondaries={d.meta.secondaries}
                    title={d.meta.title}
                    metaDescription={d.meta.description}
                    h1={d.meta.h1}
                    targets={{
                      ...targets,
                      brandTokens: brandTokens
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }}
                    onEvaluate={(res) => onEvaluate(d.id, res)}
                  />
                </CardContent>
              </Card>
            ))}
          {drafts.filter((d) => !d.gate).length === 0 && (
            <p className="text-sm opacity-70">All drafts have been evaluated.</p>
          )}
        </div>
      </section>

      {/* Footer actions */}
      <div className="flex items-center justify-between py-4">
        <p className="text-xs opacity-70">
          Nothing is uploaded to a server by default. Keys are stored in localStorage on this browser.
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem("dg_apiKey")
              setApiKey("")
            }}
          >
            Clear key
          </Button>
          <Button variant="destructive" onClick={() => setDrafts([])}>
            Reset session
          </Button>
        </div>
      </div>
    </div>
  )
}
