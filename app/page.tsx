import { Header } from "@/components/ui/header"
import { Footer } from "@/components/ui/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BarChart3, ChevronRight, LineChart, Search, Zap } from "lucide-react"
import Image from "next/image"


export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Make smarter investment decisions
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Get real-time stock analysis, market insights, and personalized recommendations to help you invest
                    with confidence.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" className="h-12 bg-black">
                    Start Free Trial
                  </Button>
                  <Button size="lg" variant="outline" className="h-12">
                    Learn More
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-full max-w-[500px] space-y-4 rounded-lg border bg-background p-6 shadow-lg">
                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-bold">Search for a Stock</h2>
                    <p className="text-sm text-muted-foreground">
                      Enter a stock symbol or company name to get detailed analysis
                    </p>
                  </div>
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="AAPL, MSFT, TSLA, or company name" type="search" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-black">
                      Generate Stock Report
                    </Button>
                  </form>
                  <div className="text-xs text-muted-foreground text-center">
                    Popular searches: AAPL, MSFT, TSLA, AMZN, GOOGL
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-black px-3 py-1 text-sm text-primary-foreground">
                  Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                  Everything you need for smarter investing
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our platform provides comprehensive tools and insights to help you make informed investment decisions.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 ">
              <div className="grid gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-primary-foreground">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Real-time Analysis</h3>
                  <p className="text-muted-foreground">
                    Get up-to-the-minute stock analysis and market data to make timely decisions.
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-primary-foreground">
                  <LineChart className="h-6 w-6 bg" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Technical Indicators</h3>
                  <p className="text-muted-foreground">
                    Access advanced technical indicators and chart patterns to identify trends.
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black text-primary-foreground">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">AI Recommendations</h3>
                  <p className="text-muted-foreground">
                    Receive personalized stock recommendations based on your investment goals.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 px-10 md:gap-16 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="inline-block rounded-lg bg-background px-3 py-1 text-sm">Why Choose Us</div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                  Make data-driven investment decisions
                </h2>
                <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed">
                  Our platform combines advanced analytics with an intuitive interface to help you navigate the complex
                  world of investing.
                </p>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button className="h-10 bg-black">
                    Get Started
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-center">
                <Image
                  src="/placeholder.svg?height=400&width=600"
                  width={600}
                  height={400}
                  alt="Stock analysis dashboard"
                  className="rounded-lg object-cover"
                />
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Ready to transform your investment strategy?
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed">
                Join thousands of investors who are making smarter decisions with StockAssist.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2 ">
              <form className="flex space-x-2">
                <Input className="max-w-lg flex-1 " placeholder="Enter your email" type="email" />
                <Button type="submit" className="bg-black">Sign Up</Button>
              </form>
              <p className="text-xs text-muted-foreground">Start your 14-day free trial. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  )
}

