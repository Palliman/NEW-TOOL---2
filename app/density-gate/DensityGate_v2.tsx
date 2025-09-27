"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"

// Types
export interface DensityGateTargets {
  primaryMin?: number // e.g., 0.01 for 1%
  primaryMax?: number // e.g., 0.018 for 1.8%
  wordCountMin?: number
  fleschMin?: number
  secondaryMin?: number
  secondaryMax?: number
}

export interface DensityGateCheck {
  label: string
  pass: boolean
  value?: number
  target?: string
  hint?: string
}

export interface DensityGateResult {
  pass: boolean
  score: number
  checks: DensityGateCheck[]
  auditJson?: any
  stats: {
    wordCount: number
    primaryDensity: number
    secondaryDensities: { [key: string]: number }
    fleschScore?: number
  }
}

interface DensityGateV2Props {
  draftHtml: string
  primary: string
  secondaries: string[]
  title?: string
  metaDescription?: string
  h1?: string
  targets: Partial<DensityGateTargets>
  onEvaluate: (result: DensityGateResult) => void
}

// Helper functions
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length
}

function calculateDensity(text: string, keyword: string): number {
  if (!keyword.trim()) return 0
  const words = text.toLowerCase().split(/\s+/)
  const keywordWords = keyword.toLowerCase().split(/\s+/)
  const keywordLength = keywordWords.length

  let matches = 0
  for (let i = 0; i <= words.length - keywordLength; i++) {
    const phrase = words.slice(i, i + keywordLength).join(" ")
    if (phrase === keyword.toLowerCase()) {
      matches++
    }
  }

  return words.length > 0 ? matches / words.length : 0
}

function calculateFleschScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
  const words = countWords(text)
  const syllables = text.split(/[aeiouAEIOU]/).length - 1 // Rough approximation

  if (sentences === 0 || words === 0) return 0

  const avgWordsPerSentence = words / sentences
  const avgSyllablesPerWord = syllables / words

  return 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
}

export default function DensityGateV2({
  draftHtml,
  primary,
  secondaries,
  title,
  metaDescription,
  h1,
  targets,
  onEvaluate,
}: DensityGateV2Props) {
  const [result, setResult] = useState<DensityGateResult | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  const evaluate = async () => {
    if (!draftHtml.trim()) return

    setIsEvaluating(true)

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500))

    const plainText = stripHtml(draftHtml)
    const wordCount = countWords(plainText)
    const primaryDensity = calculateDensity(plainText, primary)
    const fleschScore = calculateFleschScore(plainText)

    const secondaryDensities: { [key: string]: number } = {}
    secondaries.forEach((secondary) => {
      if (secondary.trim()) {
        secondaryDensities[secondary] = calculateDensity(plainText, secondary)
      }
    })

    const checks: DensityGateCheck[] = []

    // Word count check
    if (targets.wordCountMin) {
      checks.push({
        label: "Word Count",
        pass: wordCount >= targets.wordCountMin,
        value: wordCount,
        target: `≥${targets.wordCountMin}`,
        hint: wordCount < targets.wordCountMin ? "Add more content to reach minimum word count" : undefined,
      })
    }

    // Primary keyword density check
    if (primary.trim()) {
      const primaryMin = targets.primaryMin || 0.01
      const primaryMax = targets.primaryMax || 0.018
      const primaryPass = primaryDensity >= primaryMin && primaryDensity <= primaryMax

      checks.push({
        label: "Primary Keyword Density",
        pass: primaryPass,
        value: primaryDensity * 100,
        target: `${(primaryMin * 100).toFixed(1)}%-${(primaryMax * 100).toFixed(1)}%`,
        hint: !primaryPass
          ? primaryDensity < primaryMin
            ? "Increase primary keyword usage"
            : "Reduce primary keyword usage to avoid over-optimization"
          : undefined,
      })
    }

    // Secondary keyword density checks
    secondaries.forEach((secondary) => {
      if (secondary.trim()) {
        const density = secondaryDensities[secondary]
        const secondaryMin = targets.secondaryMin || 0.005
        const secondaryMax = targets.secondaryMax || 0.01
        const pass = density >= secondaryMin && density <= secondaryMax

        checks.push({
          label: `Secondary: "${secondary}"`,
          pass,
          value: density * 100,
          target: `${(secondaryMin * 100).toFixed(1)}%-${(secondaryMax * 100).toFixed(1)}%`,
          hint: !pass
            ? density < secondaryMin
              ? "Increase usage of this secondary keyword"
              : "Reduce usage of this secondary keyword"
            : undefined,
        })
      }
    })

    // Flesch readability check
    if (targets.fleschMin) {
      checks.push({
        label: "Flesch Readability",
        pass: fleschScore >= targets.fleschMin,
        value: fleschScore,
        target: `≥${targets.fleschMin}`,
        hint:
          fleschScore < targets.fleschMin ? "Improve readability with shorter sentences and simpler words" : undefined,
      })
    }

    // Title check
    if (title && primary) {
      const titleContainsPrimary = title.toLowerCase().includes(primary.toLowerCase())
      checks.push({
        label: "Title Contains Primary",
        pass: titleContainsPrimary,
        target: "Required",
        hint: !titleContainsPrimary ? "Include primary keyword in title" : undefined,
      })
    }

    // Meta description check
    if (metaDescription && primary) {
      const metaContainsPrimary = metaDescription.toLowerCase().includes(primary.toLowerCase())
      checks.push({
        label: "Meta Description Contains Primary",
        pass: metaContainsPrimary,
        target: "Required",
        hint: !metaContainsPrimary ? "Include primary keyword in meta description" : undefined,
      })
    }

    // H1 check
    if (h1 && primary) {
      const h1ContainsPrimary = h1.toLowerCase().includes(primary.toLowerCase())
      checks.push({
        label: "H1 Contains Primary",
        pass: h1ContainsPrimary,
        target: "Required",
        hint: !h1ContainsPrimary ? "Include primary keyword in H1 tag" : undefined,
      })
    }

    const passedChecks = checks.filter((c) => c.pass).length
    const totalChecks = checks.length
    const pass = totalChecks > 0 ? passedChecks === totalChecks : false
    const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0

    const evaluationResult: DensityGateResult = {
      pass,
      score,
      checks,
      stats: {
        wordCount,
        primaryDensity,
        secondaryDensities,
        fleschScore,
      },
      auditJson: {
        timestamp: Date.now(),
        targets,
        stats: { wordCount, primaryDensity, secondaryDensities, fleschScore },
        checks,
      },
    }

    setResult(evaluationResult)
    onEvaluate(evaluationResult)
    setIsEvaluating(false)
  }

  useEffect(() => {
    if (draftHtml && primary) {
      evaluate()
    }
  }, [draftHtml, primary, secondaries, title, metaDescription, h1, targets])

  if (!result && !isEvaluating) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Button onClick={evaluate} disabled={!draftHtml.trim() || !primary.trim()}>
            Evaluate Content
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isEvaluating) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">Evaluating content...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={result.pass ? "success" : "destructive"} className={result.pass ? "bg-emerald-600" : ""}>
              {result.pass ? "PASS" : "FAIL"}
            </Badge>
            <span className="text-sm font-medium">Score: {result.score.toFixed(1)}%</span>
          </div>
          <Button size="sm" variant="outline" onClick={evaluate}>
            Re-evaluate
          </Button>
        </div>

        <Progress value={result.score} className="w-full" />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Content Stats:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>Words: {result.stats.wordCount}</div>
            <div>Primary: {(result.stats.primaryDensity * 100).toFixed(2)}%</div>
            {result.stats.fleschScore && <div>Flesch: {result.stats.fleschScore.toFixed(1)}</div>}
            <div>
              Checks: {result.checks.filter((c) => c.pass).length}/{result.checks.length}
            </div>
          </div>
        </div>

        {result.checks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Detailed Checks:</h4>
            <div className="space-y-1">
              {result.checks.map((check, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={check.pass ? "success" : "destructive"}
                      className={`text-xs ${check.pass ? "bg-emerald-600" : ""}`}
                    >
                      {check.pass ? "✓" : "✗"}
                    </Badge>
                    <span>{check.label}</span>
                  </div>
                  <div className="text-right">
                    {check.value !== undefined && (
                      <span>
                        {check.value.toFixed(1)}
                        {check.label.includes("Density") ? "%" : ""}
                      </span>
                    )}
                    {check.target && <span className="text-muted-foreground ml-1">({check.target})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.checks.some((c) => !c.pass && c.hint) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600">Improvement Hints:</h4>
            <ul className="text-xs space-y-1 text-red-600">
              {result.checks
                .filter((c) => !c.pass && c.hint)
                .map((check, i) => (
                  <li key={i}>• {check.hint}</li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
