import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/marketsharp/sync'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/**
 * GET /api/cron/marketsharp-sync
 * 
 * Hourly cron endpoint to sync MarketSharp data for all companies.
 * Protected by CRON_SECRET to prevent unauthorized access.
 * 
 * For Vercel: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/marketsharp-sync",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all companies with MarketSharp config
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, marketsharp_config')
      .not('marketsharp_config', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'No companies with MarketSharp configuration found.' })
    }

    const results: Record<string, any> = {}
    const errors: string[] = []

    // Sync each company
    for (const company of companies) {
      try {
        const config = company.marketsharp_config as any
        if (config.companyId && config.apiKey && config.secretKey) {
          results[company.name || company.id] = await runSync(company.id, config)
        }
      } catch (err) {
        errors.push(`Error syncing ${company.name || company.id}: ${err instanceof Error ? err.message : err}`)
      }
    }

    return NextResponse.json({
      message: errors.length === 0 ? 'Multi-tenant sync completed successfully' : 'Multi-tenant sync completed with some errors',
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
