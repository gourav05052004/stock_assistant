import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: { ticker: string } }
) {
  // Await the params object before accessing its properties
  const params = await context.params;
  const ticker = params.ticker; // Now it's safe to access

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker parameter is required' },
      { status: 400 }
    );
  }

  const backendUrl = 'http://localhost:8000/api/stock';

  try {
    console.log(`Fetching from: ${backendUrl}/${ticker}`);

    const response = await fetch(`${backendUrl}/${ticker}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for real-time data
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
    console.error('API Route Error:', error instanceof Error ? error.message : String(error));

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
