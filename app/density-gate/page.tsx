"use client"

import { useState, useEffect } from "react"
import DensityGateV2, { type DensityGateTargets, type DensityGateResult } from "./DensityGate_v2" // place your file next to this page
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import JSZip from "jszip"

/**
 * DensityGate – Bulk Draft Uploader & Auto‑Fix Page (Standalone)
 * ---------------------------------------------------------------
 * Paste / upload 1–20 drafts (txt/markdown/html). Each draft is evaluated by DensityGateV2.
 * Drafts are bucketed into Passed / Needs Fixes. You can:
 *  - Save all passed drafts (zip)
 *  - Auto‑fix failing drafts via LLM (OpenAI or xAI Grok) using the audit hints as strict guidelines
 *  - Re‑run the gate until all pass, then save as a new set
 *
 * Notes
 *  - This page uses shadcn/ui for basic components. If you don't have shadcn installed,
 *    replace with your own UI or simple HTML elements.
 *  - Place your existing DensityGate_v2.tsx beside this file and update the import path above.
 */

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

// ---------- LLM client (replace with your infra) ----------
export type Provider = "openai" | "xai" // chatgpt / grok

async function callLLMWithRetry(
  provider: Provider,
  apiKey: string,
  system: string,
  user: string,
  maxRetries = 3,
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callLLM(provider, apiKey, system, user)
    } catch (error: any) {
      lastError = error

      // Check if it's a rate limit error (429)
      if (error.message?.includes("429") || error.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // Cap at 30 seconds
        console.log(`[v0] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // For non-rate-limit errors, throw immediately
      throw error
    }
  }

  throw lastError || new Error("Max retries exceeded")
}

async function callLLM(provider: Provider, apiKey: string, system: string, user: string): Promise<string> {
  if (!apiKey) throw new Error("Missing API key")
  if (provider === "openai") {
    // Example for OpenAI Responses API (JS fetch). Adjust model + base as needed.
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", // or other
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    })

    if (!r.ok) {
      const errorText = await r.text()
      throw new Error(`HTTP ${r.status}: ${errorText}`)
    }

    const j = await r.json()
    const content = j?.choices?.[0]?.message?.content ?? ""
    return content
  }
  if (provider === "xai") {
    // Example for xAI Grok chat endpoint; adjust base/model per latest docs
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

    if (!r.ok) {
      const errorText = await r.text()
      throw new Error(`HTTP ${r.status}: ${errorText}`)
    }

    const j = await r.json()
    const content = j?.choices?.[0]?.message?.content ?? ""
    return content
  }
  throw new Error("Unsupported provider")
}

async function processQueue<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency = 3,
  onProgress?: (completed: number, total: number, current?: T) => void,
): Promise<void> {
  const queue = [...items]
  const inProgress = new Set<Promise<void>>()
  let completed = 0

  while (queue.length > 0 || inProgress.size > 0) {
    // Start new tasks up to concurrency limit
    while (queue.length > 0 && inProgress.size < concurrency) {
      const item = queue.shift()!
      const task = processor(item)
        .then(() => {
          completed++
          onProgress?.(completed, items.length)
        })
        .catch((error) => {
          console.error(`[v0] Error processing item:`, error)
          completed++
          onProgress?.(completed, items.length)
        })
        .finally(() => {
          inProgress.delete(task)
        })

      inProgress.add(task)
      onProgress?.(completed, items.length, item)
    }

    // Wait for at least one task to complete
    if (inProgress.size > 0) {
      await Promise.race(inProgress)
    }
  }
}

// ---------- Main Page ----------
export default function DensityGateStandalonePage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [provider, setProvider] = useState<Provider>("openai")
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

  useEffect(() => {
    setMounted(true)

    if (typeof window !== "undefined") {
      const savedProvider = localStorage.getItem("dg_provider") as Provider
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
    const html = await callLLMWithRetry(provider, apiKey, system, user)
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

        // Process drafts with concurrency control
        await processQueue(
          needFix,
          async (d) => {
            try {
              await fixOne(d)
            } catch (error) {
              console.error(`[v0] Failed to fix draft ${d.name}:`, error)
              // Continue processing other drafts even if one fails
            }
          },
          concurrency,
          (completed, total, current) => {
            setQueueProgress({
              completed,
              total,
              current: current?.name,
            })
          },
        )

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
            onChange={(e) => setProvider(e.target.value as Provider)}
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
                      targets={targets}
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
                    targets={targets}
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
                    targets={targets}
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
