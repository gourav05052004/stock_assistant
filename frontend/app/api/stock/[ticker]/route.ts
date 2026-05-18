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

  const configuredBackendBaseUrl =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    'http://127.0.0.1:8000';
  const backendBaseUrl = configuredBackendBaseUrl.replace(/\/$/, '');
  const backendUrl = `${backendBaseUrl}/api/stock`;
  const requestedRange = request.nextUrl.searchParams.get('range');
  const normalizedTicker = ticker.trim().toUpperCase();
  const hasExchangeSuffix = /\.(NS|BO)$/i.test(normalizedTicker);
  const tickerCandidates = hasExchangeSuffix
    ? [normalizedTicker]
    : [`${normalizedTicker}.NS`, `${normalizedTicker}.BO`];

  try {
    let lastErrorText = '';
    let lastStatus = 404;

    for (const candidate of tickerCandidates) {
      const targetUrl = requestedRange
        ? `${backendUrl}/${encodeURIComponent(candidate)}?range=${encodeURIComponent(requestedRange)}`
        : `${backendUrl}/${encodeURIComponent(candidate)}`;

      console.log(`Fetching from: ${targetUrl}`);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }

      lastStatus = response.status;
      lastErrorText = await response.text();
      console.error(`Backend error for ${candidate}: ${response.status}`, lastErrorText);
    }

    return NextResponse.json(
      {
        error: `Failed to fetch data for ${normalizedTicker}. Tried ${tickerCandidates.join(', ')}. ${lastErrorText}`,
      },
      { status: lastStatus }
    );
  } catch (error) {
    console.error('API Route Error:', error instanceof Error ? error.message : String(error));

    return NextResponse.json(
      { error: `Unable to reach backend service at ${backendBaseUrl}.` },
      { status: 503 }
    );
  }
}
