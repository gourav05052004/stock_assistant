import { NextResponse } from 'next/server';

export async function GET(request, context) {
  // The correct way to access params in Next.js App Router
  const { params } = context;
  const ticker = params.ticker;
  
  // For debugging
  console.log("Received request for ticker:", ticker);
  
  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker parameter is required' },
      { status: 400 }
    );
  }

  const backendUrl = 'http://localhost:8000/stock-analysis';

  try {
    console.log(`Fetching from: ${backendUrl}/${ticker}`);
    
    const response = await fetch(`${backendUrl}/${ticker}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }, // Optional: cache for 60 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error: ${response.status}`, errorText);
      
      return NextResponse.json(
        { error: `Failed to fetch data for ${ticker}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error.message);
    
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}