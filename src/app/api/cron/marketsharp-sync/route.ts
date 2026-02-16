import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/marketsharp/sync'

/**
 * GET /api/cron/marketsharp-sync
 * 
 * Daily cron endpoint to sync MarketSharp data.
 * Protected by CRON_SECRET to prevent unauthorized access.
 * 
 * For Vercel: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/marketsharp-sync",
 *     "schedule": "0 6 * * *"
 *   }]
 * }
 * 
 * This runs every day at 6:00 AM UTC.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check that MarketSharp credentials are configured
    if (!process.env.MARKETSHARP_COMPANY_ID || !process.env.MARKETSHARP_API_KEY || !process.env.MARKETSHARP_SECRET_KEY) {
      return NextResponse.json(
        { error: 'MarketSharp credentials not configured. Sync skipped.' },
        { status: 200 }
      )
    }

    const result = await runSync()

    return NextResponse.json({
      message: result.success ? 'Sync completed successfully' : 'Sync completed with errors',
      ...result
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
