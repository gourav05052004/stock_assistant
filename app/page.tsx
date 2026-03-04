"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ChevronDown, ChevronUp, Info, Search, TrendingUp } from "lucide-react"
import Link from "next/link"
import { FormEvent, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

const popularSymbols = ["ITC", "BPCL", "EICHERMOT", "IRCTC", "ETERNAL", "GAIL", "RELIANCE"]

export default function Home() {
  const [symbol, setSymbol] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const navigateToResults = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    startTransition(() => {
      router.push(`/results?symbol=${encodeURIComponent(trimmed)}`)
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigateToResults(symbol)
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white transition-all duration-700 ${
        isMounted ? "opacity-100" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.12),transparent_45%)]" />

      <header className="relative z-10 w-full border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-semibold tracking-tight">StockAssist</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 py-20">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="inline-flex items-center rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-blue-200">
                Quant-Driven Insights
              </div>
              <div>
                <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
                  Stock Analysis Assistant
                </h1>
                <p className="mt-4 max-w-xl text-base text-slate-300 md:text-lg">
                  Get fast, structured stock intelligence powered by technical indicators and AI-driven interpretation.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="h-14 rounded-2xl border border-white/20 bg-white/95 pl-12 pr-4 text-base text-slate-900 shadow-xl shadow-black/20 transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
                    placeholder="Enter stock ticker (e.g., TCS, RELIANCE, GAIL)"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-base font-semibold text-white shadow-xl shadow-blue-900/30 transition-all duration-200 hover:scale-[1.01] hover:from-blue-400 hover:to-indigo-500"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      Generating Report...
                    </span>
                  ) : (
                    "Generate Stock Report"
                  )}
                </Button>
              </form>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {popularSymbols.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSymbol(item)
                        navigateToResults(item)
                      }}
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-slate-200 transition hover:border-blue-300/50 hover:bg-blue-500/20 hover:text-white"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* <div className="max-w-2xl rounded-2xl border border-amber-300/30 bg-amber-100/90 p-4 text-slate-800 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowDisclaimer((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Info className="h-4 w-4 text-amber-700" />
                    Information Disclaimer
                  </span>
                  {showDisclaimer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showDisclaimer && (
                  <p className="mt-2 text-sm text-slate-700">
                    This analysis is generated for informational purposes only and does not constitute financial or
                    investment advice. Always conduct your own research before making investment decisions.
                  </p>
                )}
              </div> */}
            </div>

            <div className="hidden lg:block">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
                <svg viewBox="0 0 560 360" className="h-auto w-full">
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="560" height="360" rx="18" fill="rgba(15,23,42,0.55)" />
                  <g stroke="rgba(148,163,184,0.25)">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <line key={`h-${i}`} x1="30" y1={40 + i * 35} x2="530" y2={40 + i * 35} />
                    ))}
                    {Array.from({ length: 10 }).map((_, i) => (
                      <line key={`v-${i}`} x1={40 + i * 50} y1="30" x2={40 + i * 50} y2="330" />
                    ))}
                  </g>
                  <path
                    d="M40 280 C95 230, 120 260, 170 220 C220 180, 250 200, 300 150 C350 95, 380 115, 430 90 C470 72, 500 85, 520 60"
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                  <circle cx="520" cy="60" r="8" fill="#22d3ee" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6">
        <div className="container text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} StockAssist. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

