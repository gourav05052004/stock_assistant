"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, TrendingUp } from "lucide-react"
import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const [symbol, setSymbol] = useState("")
  const router = useRouter()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (symbol.trim()) {
      router.push(`/results?symbol=${encodeURIComponent(symbol.trim())}`)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">StockAssist</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
            <Button size="sm">Get Started</Button>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="container max-w-md mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tighter mb-3">Stock Analysis Assistant</h1>
            <p className="text-muted-foreground">Enter a stock symbol to get detailed analysis and insights</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                className="pl-10 py-6 text-lg"
                placeholder="Enter stock symbol (e.g., AAPL, MSFT)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full py-6 text-lg">
              Generate Stock Report
            </Button>
          </form>
          <div className="text-sm text-muted-foreground text-center mt-4">
            Popular searches: AAPL, MSFT, TSLA, AMZN, GOOGL
          </div>
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

