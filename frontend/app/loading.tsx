export default function Loading() {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <p className="ml-4 text-muted-foreground">Loading...</p>
      </div>
    )
  }
  
  