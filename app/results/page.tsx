"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
// import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
// import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism"

export default function ResultsPage() {
  const searchParams = useSearchParams()
  const symbol = searchParams.get("symbol")
  const [loading, setLoading] = useState(true)
  const [stockData, setStockData] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!symbol) {
      setError("No stock symbol provided.")
      setLoading(false)
      return
    }

    async function fetchStockData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/stock/${symbol}`)
        const data = await response.json()

        console.log("API Response:", data) // ✅ Debugging

        if (data.stock_analysis) {
          setStockData(data.stock_analysis)
        } else {
          throw new Error(data.error || "Invalid API response")
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
      <header className="w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-black" />
            <span className="text-xl font-bold">StockAssist</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="container max-w-4xl mx-auto px-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Link>
          </Button>

          {loading ? (
            <p className="mt-4 text-muted-foreground">Generating stock analysis for {symbol}...</p>
          ) : error ? (
            <div className="bg-red-100 text-red-600 p-4 rounded">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{stockData}</ReactMarkdown>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} StockAssist. All rights reserved.</p>
        <p className="text-red-600 font-bold">This is for informational purposes only, not investment advice.</p>
      </footer>
    </div>
  )
}
