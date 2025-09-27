import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Zap, BarChart3, Shield } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">DensityGate Bulk Draft Uploader</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Analyze, optimize, and auto-fix your content drafts with AI-powered SEO analysis. Process up to 20 drafts at
            once with advanced guardrails and rate limiting.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle className="text-lg">Bulk Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Upload or paste up to 20 drafts at once. Supports text, markdown, and HTML formats.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle className="text-lg">SEO Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Comprehensive analysis of keyword density, word count, readability scores, and more.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 text-yellow-600 mb-2" />
              <CardTitle className="text-lg">AI Auto-Fix</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatically improve failing drafts using OpenAI or xAI Grok with intelligent prompting.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle className="text-lg">Advanced Guardrails</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Brand token enforcement, link hallucination prevention, and rate limiting protection.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link href="/density-gate">
            <Button size="lg" className="text-lg px-8 py-3">
              Launch Bulk Draft Uploader
            </Button>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div>
              <h3 className="font-semibold text-lg mb-2">Smart Concurrency Control</h3>
              <p className="text-gray-600">
                Process drafts with configurable concurrency (1-10 simultaneous) and exponential backoff for rate
                limits.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Brand Compliance</h3>
              <p className="text-gray-600">
                Enforce required brand tokens and prevent AI hallucination with domain allowlists.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Export & Save</h3>
              <p className="text-gray-600">
                Export passing drafts as ZIP files or save audit results as JSON for further analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
