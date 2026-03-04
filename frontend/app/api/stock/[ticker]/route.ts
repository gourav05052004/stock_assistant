import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const params = await context.params;
  const ticker = params.ticker;

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker parameter is required' },
      { status: 400 }
    );
  }

  const backendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
  const backendUrl = `${backendBaseUrl}/api/stock`;
  const requestedRange = request.nextUrl.searchParams.get('range');

  try {
    const targetUrl = requestedRange
      ? `${backendUrl}/${ticker}?range=${encodeURIComponent(requestedRange)}`
      : `${backendUrl}/${ticker}`;

    console.log(`Fetching from: ${targetUrl}`);

    const response = await fetch(targetUrl, {
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
      { error: `Unable to reach backend service at ${backendBaseUrl}.` },
      { status: 503 }
    );
  }
}
