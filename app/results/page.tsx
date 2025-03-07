/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism"

export default function ResultsPage() {
  const searchParams = useSearchParams()
  const symbol = searchParams.get("symbol")
  const [loading, setLoading] = useState(true)
  const [stockData, setStockData] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!symbol) {
      setError("No stock symbol provided")
      setLoading(false)
      return
    }

    async function fetchStockData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/stock/${symbol}`)

        if (!response.ok) {
          throw new Error(`Error fetching stock data: ${response.statusText}`)
        }

        const data = await response.json()

        if (data && data.stock_analysis) {
          setStockData(data.stock_analysis)
        } else {
          throw new Error("Invalid data format received from API")
        }
      } catch (err) {
        console.error("Error fetching stock data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch stock data")
      } finally {
        setLoading(false)
      }
    }

    fetchStockData()
  }, [symbol])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">StockAssist</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Search
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-muted-foreground">Generating stock analysis for {symbol}...</p>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 rounded-lg p-6 text-center">
              <h2 className="text-xl font-bold text-destructive mb-2">Error</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button className="mt-4" asChild>
                <Link href="/">Try Another Search</Link>
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
              <div className="prose prose-blue max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "")
                      return !inline && match ? (
                        <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" {...props}>
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    },
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200" {...props} />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th
                        className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        {...props}
                      />
                    ),
                    td: ({ node, ...props }) => <td className="px-6 py-4 whitespace-nowrap text-sm" {...props} />,
                    tr: ({ node, ...props }) => <tr className="bg-white even:bg-gray-50" {...props} />,
                  }}
                >
                  {stockData}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} StockAssist. All rights reserved.</p>
          <p className="mt-1 text-xs">
            The information provided is for general informational purposes only and should not be considered as
            investment advice.
          </p>
        </div>
      </footer>
    </div>
  )
}

