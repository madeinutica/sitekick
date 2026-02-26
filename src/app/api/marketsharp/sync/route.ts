import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runSync, type SyncResult } from '@/lib/marketsharp/sync'
import { MarketSharpConfig } from '@/lib/marketsharp/client'

/**
 * POST /api/marketsharp/sync
 * Trigger a MarketSharp sync.
 * - Super Admin: Syncs all companies with valid config.
 * - Company Admin: Syncs only their company.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user roles and company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)

    const roles = (rolesData as unknown as { roles: { name: string } }[])?.map(r => r.roles?.name) || []
    const isSuperAdmin = roles.includes('super_admin')
    const isCompanyAdmin = roles.includes('company_admin')

    // Super Admins no longer have global sync capability.
    // They must act as Company Admins if they want to sync a specific company.
    if (!isCompanyAdmin) {
      return NextResponse.json({ error: 'Access restricted to Company Administrators.' }, { status: 403 })
    }

    const results: Record<string, SyncResult> = {}

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'No company assigned to this admin.' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()

    if (error || !company) throw new Error('Company not found.')

    if (!company.marketsharp_config) {
      return NextResponse.json({ error: 'MarketSharp not configured for this company.' }, { status: 400 })
    }

    const config = company.marketsharp_config as unknown as MarketSharpConfig
    if (config.companyId && config.apiKey && config.secretKey) {
      results[company.name || company.id] = await runSync(company.id, config, user.id)
    } else {
      return NextResponse.json({ error: 'Invalid MarketSharp configuration.' }, { status: 400 })
    }


    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/marketsharp/sync
 * Get sync history. 
 * - Super admin: All logs.
 * - Company admin: Company logs.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS Policies on 'ms_sync_log' should handle the filtering automatically,
    // assuming the user is authenticated and RLS is enabled/correct.
    // My migration script set up policies for Company Admin to see their own logs.

    const { data: syncLogs, error } = await supabase
      .from('ms_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: syncLogs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
