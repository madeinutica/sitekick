import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketSharpConfig } from '@/lib/marketsharp/client'
import { IntegrationsForm } from './form'
import Link from 'next/link'
import Image from 'next/image'
import { SyncHistory } from './SyncHistory'

export default async function IntegrationsPage(props: { searchParams: Promise<{ companyId?: string }> }) {
    const searchParams = await props.searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check personal role
    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)

    const roleNames = (roles as unknown as { roles: { name: string } }[])?.map(r => r.roles?.name) || []
    const isGlobalAdmin = roleNames.includes('super_admin') || roleNames.includes('brand_ambassador')
    const isCompanyAdmin = roleNames.includes('company_admin')

    if (!isGlobalAdmin && !isCompanyAdmin) {
        redirect('/dashboard')
    }

    // Get user profile to find personal company_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

    // Determine effective company ID
    const effectiveCompanyId = (isGlobalAdmin && searchParams.companyId)
        ? searchParams.companyId
        : profile?.company_id

    if (!effectiveCompanyId) {
        return <div>No company context available for this operation.</div>
    }

    // Fetch company config
    const { data: company } = await supabase
        .from('companies')
        .select('marketsharp_config')
        .eq('id', effectiveCompanyId)
        .single()

    // Fetch recent sync logs
    const { data: logs } = await supabase
        .from('ms_sync_log')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('started_at', { ascending: false })
        .limit(10)

    const config = company?.marketsharp_config as unknown as MarketSharpConfig | null

    return (
        <div className="min-h-screen bg-slate-50/50">
            <div className="container mx-auto py-10 px-4 max-w-5xl">
                <div className="mb-6">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-red transition-colors group"
                    >
                        <svg
                            className="w-5 h-5 transform transition-transform group-hover:-translate-x-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        <span className="font-bold text-sm">Back to Dashboard</span>
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-primary-red-light rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Integrations</h1>
                        </div>
                        <p className="text-slate-500 font-medium">Connect and manage your third-party business tools.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="p-1 bg-gradient-to-r from-primary-red/10 via-transparent to-transparent"></div>
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">MarketSharp CRM</h2>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Synchronize your contacts, jobs, and contracts.
                                    </p>
                                </div>
                                <div className="h-10 w-10 flex items-center justify-center">
                                    <Image
                                        src="/images/sitekick-icon.png"
                                        alt="MarketSharp"
                                        width={32}
                                        height={32}
                                        className="opacity-50 grayscale hover:grayscale-0 transition cursor-help"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                <IntegrationsForm initialConfig={config} />
                            </div>
                        </div>
                    </div>

                    <SyncHistory logs={logs || []} />
                </div>
            </div>
        </div>
    )
}

