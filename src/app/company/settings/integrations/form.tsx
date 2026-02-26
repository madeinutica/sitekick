'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveMarketSharpConfig, testMarketSharpConnection, triggerMarketSharpSync } from '@/app/actions/company-settings'
import { MarketSharpConfig } from '@/lib/marketsharp/client'

interface IntegrationsFormProps {
    initialConfig?: MarketSharpConfig | null
}

export function IntegrationsForm({ initialConfig }: IntegrationsFormProps) {
    const [formData, setFormData] = useState({
        companyId: initialConfig?.companyId || '',
        apiKey: initialConfig?.apiKey || '',
        secretKey: initialConfig?.secretKey || '',
        baseUrl: initialConfig?.baseUrl || 'https://api4.marketsharpm.com/WcfDataService.svc',
    })
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const router = useRouter()

    const handleTest = async () => {
        setTesting(true)
        setTestResult(null)
        const form = new FormData()
        form.append('companyId', formData.companyId)
        form.append('apiKey', formData.apiKey)
        form.append('secretKey', formData.secretKey)
        form.append('baseUrl', formData.baseUrl)

        const result = await testMarketSharpConnection(form)
        setTesting(false)

        if ('error' in result) {
            setTestResult({ success: false, message: result.error as string })
        } else if (result.success) {
            setTestResult({ success: true, message: result.message || 'Connection successful!' })
        } else {
            setTestResult({ success: false, message: result.message || 'Connection failed' })
        }
    }

    const handleSync = async () => {
        setSyncing(true)
        setTestResult(null)
        try {
            const result = await triggerMarketSharpSync()
            if (result.success) {
                setTestResult({ success: true, message: `Sync completed: ${result.contactsSynced} contacts, ${result.jobsSynced} jobs.` })
                router.refresh()
            } else {
                setTestResult({ success: false, message: result.errors?.[0] || 'Sync failed' })
            }
        } catch (err) {
            setTestResult({ success: false, message: err instanceof Error ? err.message : 'Sync failed' })
        } finally {
            setSyncing(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const form = new FormData()
        form.append('companyId', formData.companyId)
        form.append('apiKey', formData.apiKey)
        form.append('secretKey', formData.secretKey)
        form.append('baseUrl', formData.baseUrl)

        const result = await saveMarketSharpConfig(form)
        setLoading(false)

        if (result.error) {
            alert(`Error: ${result.error}`)
        } else {
            alert('Configuration saved successfully!')
            setTestResult({ success: true, message: 'Configuration saved. You can now test the connection or sync.' })
            router.refresh()
        }
    }

    return (
        <form onSubmit={handleSave} className="space-y-6 max-w-lg">
            <div>
                <label className="block text-sm font-medium text-gray-700">Company ID</label>
                <input
                    type="text"
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">API Key</label>
                <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Secret Key</label>
                <input
                    type="password"
                    value={formData.secretKey}
                    onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">API URL (Pod)</label>
                <input
                    type="text"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
                    required
                />
                <p className="mt-1 text-xs text-slate-500 italic">
                    Example: https://api4.marketsharpm.com/WcfDataService.svc
                </p>
            </div>

            {testResult && (
                <div className={`p-4 rounded-md flex items-start gap-3 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.success ? (
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                    <span className="text-sm font-medium">{testResult.message}</span>
                </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100">
                <button
                    type="submit"
                    disabled={loading || testing || syncing}
                    className="flex-1 min-w-[140px] py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition"
                >
                    {loading ? 'Saving...' : 'Save Configuration'}
                </button>

                <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || loading || syncing || !formData.companyId}
                    className="flex-1 min-w-[140px] py-2.5 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition"
                >
                    {testing ? 'Testing...' : 'Test Connection'}
                </button>

                {initialConfig && (
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={syncing || loading || testing}
                        className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white bg-primary-red hover:bg-primary-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-red disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                        {syncing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Synchronizing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Sync Contacts & Jobs Now
                            </>
                        )}
                    </button>
                )}
            </div>
        </form>

    )
}
