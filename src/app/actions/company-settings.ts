'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveMarketSharpConfig(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Verify company admin role
    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)

    const roleNames = (roles as unknown as { roles: { name: string } }[])?.map(r => r.roles?.name) || []
    if (!roleNames.includes('company_admin') && !roleNames.includes('super_admin')) {
        return { error: 'Forbidden' }
    }

    // Get company_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

    if (!profile?.company_id) {
        return { error: 'No company assigned' }
    }

    const companyId = formData.get('companyId') as string
    const apiKey = formData.get('apiKey') as string
    const secretKey = formData.get('secretKey') as string
    const baseUrl = formData.get('baseUrl') as string

    if (!companyId || !apiKey || !secretKey) {
        return { error: 'Missing required configuration fields' }
    }

    const config = {
        companyId,
        apiKey,
        secretKey,
        baseUrl
    }

    const { error } = await supabase
        .from('companies')
        .update({ marketsharp_config: config })
        .eq('id', profile.company_id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/company/settings/integrations')
    return { success: true }
}

import { testConnection } from '@/lib/marketsharp/client'
import { runSync } from '@/lib/marketsharp/sync'

export async function testMarketSharpConnection(formData: FormData) {
    const companyId = formData.get('companyId') as string
    const apiKey = formData.get('apiKey') as string
    const secretKey = formData.get('secretKey') as string
    const baseUrl = formData.get('baseUrl') as string

    if (!companyId || !apiKey || !secretKey) {
        return { error: 'Missing required configuration fields' }
    }

    const result = await testConnection({ companyId, apiKey, secretKey, baseUrl })
    return result
}

export async function triggerMarketSharpSync() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    // Get company and config
    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

    if (!profile?.company_id) {
        throw new Error('No company assigned')
    }

    const { data: company } = await supabase
        .from('companies')
        .select('marketsharp_config')
        .eq('id', profile.company_id)
        .single()

    if (!company?.marketsharp_config) {
        throw new Error('MarketSharp not configured')
    }

    const config = company.marketsharp_config as any
    const result = await runSync(profile.company_id, config, user.id)

    revalidatePath('/company/settings/integrations')
    return result
}

