import { Button } from "@/components/ui/button"
import { Search, TrendingUp } from "lucide-react"
import Link from "next/link"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6  text-black" />
          <span className="text-xl font-bold">StockAssist</span>
        </div>
        <nav className="hidden md:flex gap-6">
          <Link href="#" className="text-sm font-medium hover:text-primary">
            Home
          </Link>
          <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary">
            Markets
          </Link>
          <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary">
            Watchlist
          </Link>
          <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary">
            News
          </Link>
          <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary">
            About
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="hidden md:flex">
            Sign In
          </Button>
          <Button size="sm" className="hidden md:flex bg-black">
            Get Started
          </Button>
          <Button variant="outline" size="icon" className="md:hidden">
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
        </div>
      </div>
    </header>
  )
}