import { NextRequest, NextResponse } from 'next/server'

/**
 * WMS Proxy API Route
 *
 * Proxies WMS requests to external servers to avoid CORS issues.
 * Used primarily for RIVM Atlas Leefomgeving and other government WMS services.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const baseUrl = searchParams.get('url')

    if (!baseUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Build the WMS URL with all passed parameters
    const wmsParams = new URLSearchParams()
    searchParams.forEach((value, key) => {
      if (key !== 'url') {
        wmsParams.append(key, value)
      }
    })

    const fullUrl = `${baseUrl}?${wmsParams.toString()}`

    // Allowlist of trusted WMS servers
    const trustedHosts = [
      'data.rivm.nl',
      'geodata.rivm.nl',
      'service.pdok.nl',
      'geo.leefbaarometer.nl',
      'nationaalgeoregister.nl'
    ]

    const url = new URL(baseUrl)
    if (!trustedHosts.some(host => url.hostname.endsWith(host))) {
      return NextResponse.json({ error: 'Untrusted WMS host' }, { status: 403 })
    }

    // Fetch from WMS server
    const response = await fetch(fullUrl, {
      headers: {
        'Accept': 'image/png, image/jpeg, */*',
      },
    })

    if (!response.ok) {
      console.error(`WMS proxy error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: `WMS server returned ${response.status}` },
        { status: response.status }
      )
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()

    // Return with appropriate headers
    const contentType = response.headers.get('content-type') || 'image/png'

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('WMS proxy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to proxy WMS request' },
      { status: 500 }
    )
  }
}
