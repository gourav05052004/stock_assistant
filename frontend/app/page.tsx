"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Brain, Activity, FileText, ChevronRight, Quote, Globe, BarChart2 } from "lucide-react"
import Link from "next/link"
import { FormEvent, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

const popularSymbols = ["ITC", "RELIANCE", "GAIL", "TCS"]

export default function Home() {
  const [symbol, setSymbol] = useState("")
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
    <div className={`min-h-screen bg-[#0f131e] text-slate-200 transition-opacity duration-700 font-sans ${isMounted ? "opacity-100" : "opacity-0"}`}>
      
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f131e]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-[#00f2ff]">StockAssist</span>
          </Link>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-300 h-full items-center">
            <Link href="#features" className="hover:text-white transition-colors border-b-2 border-[#00f2ff] text-white h-full flex items-center">Features</Link>
            <Link href="#pricing" className="hover:text-white transition-colors h-full flex items-center">Pricing</Link>
            <Link href="#about" className="hover:text-white transition-colors h-full flex items-center">About</Link>
          </nav>
          <Button className="bg-[#00f2ff] text-[#00363a] hover:bg-[#74f5ff] font-semibold rounded-md px-6 shadow-[0_0_15px_rgba(0,242,255,0.3)] transition-shadow">
            Get Started
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          {/* Subtle gradient glow in background */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00f2ff]/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="container mx-auto max-w-6xl px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Column: Text & Input */}
              <div className="space-y-8 z-10">
                <div className="inline-flex items-center rounded-full border border-[#00f2ff]/30 bg-[#00f2ff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#00f2ff]">
                  QUANT-DRIVEN INSIGHTS
                </div>
                
                <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white">
                  Master the Markets with <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#74f5ff]">Quant-Driven AI</span>
                </h1>
                
                <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                  Get fast, structured stock intelligence powered by technical indicators and AI-driven interpretation. High-performance financial intelligence at your fingertips.
                </p>

                <form onSubmit={handleSubmit} className="relative max-w-md">
                  <div className="relative flex items-center">
                    <Input
                      className="h-14 w-full rounded-lg border border-white/10 bg-[#1b1f2b] pl-4 pr-32 text-base text-white shadow-xl focus-visible:ring-1 focus-visible:ring-[#00f2ff] focus-visible:border-[#00f2ff] placeholder:text-slate-500"
                      placeholder="Enter ticker symbol (e.g. AAPL)"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="absolute right-1.5 h-11 px-6 rounded-md bg-[#00f2ff] text-[#00363a] font-bold hover:bg-[#74f5ff] transition-all"
                    >
                      {isPending ? "..." : "Analyze"}
                    </Button>
                  </div>
                </form>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 text-xs">Popular:</span>
                  <div className="flex gap-2">
                    {popularSymbols.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setSymbol(item)}
                        className="text-[#00f2ff] hover:text-white transition-colors text-xs font-semibold tracking-wide"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Chart Visual */}
              <div className="relative z-10 lg:ml-auto w-full max-w-lg">
                <div className="rounded-xl border border-white/5 bg-[#1b1f2b]/80 p-6 shadow-2xl backdrop-blur-sm">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-white font-bold text-lg">NIFTY 50</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#00f2ff]">+1.42%</span>
                        <span className="text-slate-500">Market Open</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded border border-white/10 flex items-center justify-center bg-white/5">
                        <Activity className="w-4 h-4 text-[#00f2ff]" />
                      </div>
                      <div className="w-8 h-8 rounded border border-white/10 flex items-center justify-center bg-white/5">
                        <BarChart2 className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Mock Line Chart */}
                  <div className="h-48 w-full mt-4 relative">
                    <svg viewBox="0 0 400 150" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#00f2ff" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      
                      {/* Grid Lines */}
                      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <line key={`h-${i}`} x1="0" y1={i * 30} x2="400" y2={i * 30} />
                        ))}
                        {Array.from({ length: 11 }).map((_, i) => (
                          <line key={`v-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="150" />
                        ))}
                      </g>
                      
                      {/* The Line */}
                      <path 
                        d="M 0 130 C 50 110, 80 105, 120 90 C 160 75, 190 85, 230 50 C 270 15, 310 30, 350 15 C 370 5, 385 10, 400 10" 
                        fill="none" 
                        stroke="url(#lineGrad)" 
                        strokeWidth="4" 
                        strokeLinecap="round"
                        filter="url(#glow)"
                        className="animate-pulse"
                      />
                      
                      {/* End Point Glow */}
                      <circle cx="400" cy="10" r="5" fill="#00f2ff" filter="url(#glow)" />
                    </svg>
                  </div>
                  
                  {/* X Axis labels */}
                  <div className="flex justify-between mt-4 text-[10px] text-slate-500 font-mono">
                    <span>09:30</span>
                    <span>11:30</span>
                    <span>13:30</span>
                    <span>15:30</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section className="py-8 border-y border-white/5 bg-white/[0.02]">
          <div className="container mx-auto max-w-6xl px-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-6">Trusted By Traders Worldwide</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              {['NASDAQ', 'NSE INDIA', 'BSE', 'NYSE', 'LSE', 'NASDAQ', 'NSE INDIA', 'BSE'].map((partner, i) => (
                <div key={i} className="flex items-center gap-2 text-[#00f2ff] font-bold text-sm tracking-wider">
                  <Globe className="w-4 h-4" />
                  {partner}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Engineered for Precision</h2>
              <p className="text-slate-400">Advanced financial intelligence tools designed to give you a definitive edge in the global markets.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Activity, title: "Real-time Data", desc: "Ultra-low latency data feeds from major exchanges globally, processed in milliseconds." },
                { icon: Brain, title: "AI Sentiment", desc: "Natural Language Processing to analyze news, signals and social impact on asset prices." },
                { icon: BarChart2, title: "Technical Indicators", desc: "Over 100+ automated indicators including RSI, MACD, and Fibonacci retracement levels." },
                { icon: FileText, title: "Expert Reports", desc: "On-demand intelligence reports that simplify complex market data into actionable insights." },
              ].map((feature, i) => (
                <div key={i} className="bg-[#1b1f2b]/50 border border-white/5 rounded-xl p-6 hover:border-[#00f2ff]/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-[#0f131e] border border-white/10 flex items-center justify-center mb-6 group-hover:border-[#00f2ff]/50 transition-colors">
                    <feature.icon className="w-5 h-5 text-[#00f2ff]" />
                  </div>
                  <h3 className="text-white font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-24 bg-gradient-to-b from-[#0f131e] to-[#131826]">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white">Streamlined Execution</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[1px] bg-white/10" />
              
              {[
                { step: "1", title: "Search", desc: "Input any ticker symbol to activate the AI analysis core." },
                { step: "2", title: "Analyze", desc: "AI processes indicators and quant data in real-time." },
                { step: "3", title: "Profit", desc: "Receive high-conviction insights to execute your trades." },
              ].map((item, i) => (
                <div key={i} className="relative text-center">
                  <div className="w-24 h-24 mx-auto bg-[#0f131e] border border-slate-700 rounded-xl flex items-center justify-center mb-6 relative z-10 shadow-lg">
                    <span className="text-4xl font-bold text-[#00f2ff]">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-slate-400 max-w-[250px] mx-auto">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Section */}
        <section className="py-24">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Market Pulse</h2>
                <p className="text-slate-400">Trending stocks analyzed by AI in the last 24 hours.</p>
              </div>
              <Link href="#" className="hidden md:flex items-center gap-1 text-[#00f2ff] text-sm font-semibold hover:text-[#74f5ff] transition-colors">
                View All Market <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { symbol: "TCS", name: "TCS", price: "₹3,842.10", change: "+2.1%", up: true },
                { symbol: "RELIANCE", name: "RELIANCE", price: "₹2,932.45", change: "+1.4%", up: true },
                { symbol: "INFY", name: "INFY", price: "₹1,439.25", change: "-0.8%", up: false },
              ].map((stock, i) => (
                <div key={i} className="bg-[#1b1f2b]/80 border border-white/5 rounded-xl p-6 hover:bg-[#1b1f2b] transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stock.symbol}.NSE</span>
                      <h3 className="text-lg font-bold text-white mt-1">{stock.name}</h3>
                      <div className={`text-sm font-semibold mt-1 flex items-center gap-2 ${stock.up ? 'text-[#00f2ff]' : 'text-red-400'}`}>
                        {stock.price} <span>({stock.change})</span>
                      </div>
                    </div>
                    <div className="w-24 h-12 opacity-80 group-hover:opacity-100 transition-opacity">
                      {/* Simple mock sparkline SVG */}
                      <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                        <path 
                          d={stock.up ? "M0,20 Q20,25 40,15 T80,10 T100,5" : "M0,5 Q20,10 40,20 T80,25 T100,28"} 
                          fill="none" 
                          stroke={stock.up ? "#00f2ff" : "#f87171"} 
                          strokeWidth="2" 
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-12">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { quote: "StockAssist has completely transformed my trading workflow. The AI reports provide a level of structural depth that I previously spent hours calculating manually.", author: "Marcus Thorne", role: "Hedge Fund Manager" },
                { quote: "The sentiment analysis is eerily accurate. It caught the market shift 15 minutes before the major news break. This is the command center I've been waiting for.", author: "Elena Rodriguez", role: "Independent Day Trader" },
              ].map((testimonial, i) => (
                <div key={i} className="bg-[#1b1f2b]/40 border border-white/5 rounded-xl p-8 relative">
                  <Quote className="absolute top-6 left-6 w-8 h-8 text-[#00f2ff]/20" />
                  <p className="text-slate-300 italic mb-8 relative z-10 leading-relaxed text-sm md:text-base">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-slate-700/50" />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-bold">{testimonial.author}</h4>
                      <p className="text-slate-500 text-xs">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="container mx-auto max-w-6xl px-6">
            <div className="bg-gradient-to-br from-[#1b1f2b] to-[#0f131e] border border-white/10 rounded-2xl p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[#00f2ff]/5 blur-3xl rounded-full" />
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Start Your AI-Powered <br/>Journey Today</h2>
                <p className="text-slate-400 mb-10">
                  Join 50,000+ traders leveraging quant-driven intelligence to dominate the global markets. Get started for free.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button className="h-12 px-8 bg-[#00f2ff] text-[#00363a] font-bold hover:bg-[#74f5ff] text-base rounded-md transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]">
                    Create Free Account
                  </Button>
                  <Button variant="outline" className="h-12 px-8 border-slate-600 bg-transparent text-white hover:bg-slate-800 hover:text-white font-semibold text-base rounded-md transition-all">
                    View API Documentation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16 bg-[#0a0e19]">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="inline-block mb-6">
                <span className="text-xl font-bold tracking-tight text-[#00f2ff]">StockAssist</span>
              </Link>
              <p className="text-sm text-slate-500 max-w-xs mb-6">
                © 2024 StockAssist AI. High-performance financial intelligence.
              </p>
              <div className="flex gap-4">
                <Globe className="w-5 h-5 text-slate-500 hover:text-white cursor-pointer transition-colors" />
                <Activity className="w-5 h-5 text-slate-500 hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Product</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">API Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Company</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">About Us</Link></li>
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Support</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Contact Support</Link></li>
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-[#00f2ff] transition-colors">Community</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
