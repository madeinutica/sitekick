'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SyncLog = {
  id: number
  started_at: string
  completed_at: string | null
  contacts_synced: number
  jobs_synced: number
  errors: string[] | null
  status: string
  created_at: string
}

type MSContact = {
  id: number
  marketsharp_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  business_name: string | null
  source: string | null
  is_active: boolean
  last_synced_at: string
}

type MSJob = {
  id: number
  marketsharp_id: string
  marketsharp_contact_id: string | null
  job_name: string
  description: string | null
  job_type: string | null
  status: string | null
  address: string | null
  category: string | null
  start_date: string | null
  completed_date: string | null
  is_active: boolean
  last_synced_at: string
  customer_name?: string
}

export default function MarketSharpPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'jobs' | 'logs'>('overview')
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [contacts, setContacts] = useState<MSContact[]>([])
  const [jobs, setJobs] = useState<MSJob[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactCount, setContactCount] = useState(0)
  const [jobCount, setJobCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  const fetchSyncLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/marketsharp/sync', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSyncLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Failed to fetch sync logs:', err)
    }
  }, [])

  const fetchContacts = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/marketsharp/contacts?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts || [])
        setContactCount(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err)
    }
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const { data, count, error } = await supabase
        .from('ms_jobs')
        .select('*', { count: 'exact' })
        .order('last_synced_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        // Look up customer names from ms_contacts
        const contactIds = [...new Set(data.map((j: MSJob) => j.marketsharp_contact_id).filter(Boolean))] as string[]
        let contactMap: Record<string, string> = {}
        if (contactIds.length > 0) {
          const { data: contacts } = await supabase
            .from('ms_contacts')
            .select('marketsharp_id, last_name, first_name')
            .in('marketsharp_id', contactIds)
          if (contacts) {
            contactMap = Object.fromEntries(
              contacts.map((c: { marketsharp_id: string; last_name: string; first_name: string }) => [
                c.marketsharp_id,
                [c.last_name, c.first_name].filter(Boolean).join(', ')
              ])
            )
          }
        }
        const jobsWithNames = data.map((job: MSJob) => ({
          ...job,
          customer_name: job.marketsharp_contact_id ? contactMap[job.marketsharp_contact_id] || null : null,
        }))
        setJobs(jobsWithNames)
        setJobCount(count || 0)
      } else {
        setJobs([])
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    }
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }
      setUser(data.user)

      const { data: userRoleIds } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', data.user.id)

      if (!userRoleIds || userRoleIds.length === 0) {
        router.push('/')
        return
      }

      const roleIds = userRoleIds.map((ur: { role_id: number }) => ur.role_id)
      const { data: rolesData } = await supabase
        .from('roles')
        .select('name')
        .in('id', roleIds)

      const roleNames = rolesData?.map((r: { name: string }) => r.name) || []
      if (roleNames.includes('super_admin')) {
        setIsSuperAdmin(true)
        fetchSyncLogs()
      } else {
        router.push('/')
      }
      setLoading(false)
    }
    checkUser()
  }, [router, supabase, fetchSyncLogs])

  useEffect(() => {
    if (!isSuperAdmin) return
    if (activeTab === 'contacts') fetchContacts(contactSearch)
    if (activeTab === 'jobs') fetchJobs()
    if (activeTab === 'logs') fetchSyncLogs()
  }, [activeTab, isSuperAdmin, fetchContacts, fetchJobs, fetchSyncLogs, contactSearch])

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/marketsharp/test', { credentials: 'include' })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Failed to connect to API' })
    }
    setTesting(false)
  }

  const handleSync = async () => {
    if (!confirm('Start a MarketSharp sync? This will pull all contacts and jobs from MarketSharp.')) return
    setSyncing(true)
    try {
      const res = await fetch('/api/marketsharp/sync', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        alert(`Sync complete! ${data.contactsSynced} contacts and ${data.jobsSynced} jobs synced.`)
      } else {
        alert(`Sync completed with ${data.errors?.length || 0} errors. ${data.contactsSynced} contacts and ${data.jobsSynced} jobs synced.`)
      }
      fetchSyncLogs()
      fetchContacts()
      fetchJobs()
    } catch {
      alert('Sync failed. Check the console for details.')
    }
    setSyncing(false)
  }

  if (loading || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-red mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading MarketSharp integration...</p>
        </div>
      </div>
    )
  }

  const lastSync = syncLogs.length > 0 ? syncLogs[0] : null

  return (
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  MarketSharp Integration
                </h1>
                <p className="text-sm text-gray-500">Sync customers & jobs from MarketSharp CRM</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Test Connection Result */}
      {testResult && (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4`}>
          <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="font-medium">{testResult.message}</span>
              <button onClick={() => setTestResult(null)} className="ml-auto text-sm underline">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {(['overview', 'contacts', 'jobs', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 text-sm font-medium capitalize transition ${activeTab === tab
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Last Sync Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Sync</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lastSync
                      ? new Date(lastSync.completed_at || lastSync.started_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contacts Count */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Synced Contacts</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lastSync?.contacts_synced || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Jobs Count */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Synced Jobs</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lastSync?.jobs_synced || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Sync Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lastSync?.status === 'success' ? 'bg-green-100' :
                    lastSync?.status === 'partial' ? 'bg-yellow-100' :
                      lastSync?.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                  {lastSync?.status === 'success' ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">
                    {lastSync?.status || 'Not synced'}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="col-span-full bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-2">How MarketSharp Sync Works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Automatic daily sync</strong> runs at 6:00 AM UTC via Vercel Cron</li>
                <li>• Pulls all <strong>customers, contacts, and jobs</strong> from your MarketSharp account</li>
                <li>• New MarketSharp jobs are automatically created in Sitekick</li>
                <li>• Existing linked jobs are updated with latest MarketSharp data</li>
                <li>• Use <strong>Sync Now</strong> button above to trigger an immediate sync</li>
                <li>• Use <strong>Test Connection</strong> to verify your MarketSharp API credentials</li>
              </ul>
            </div>
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div>
            <div className="mb-4 flex items-center gap-4">
              <input
                type="text"
                placeholder="Search contacts by name, email, or phone..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-500">{contactCount} total contacts</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{contact.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{contact.email || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{contact.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{contact.address || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{contact.source || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(contact.last_synced_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {contacts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                          No contacts synced yet. Click "Sync Now" to pull data from MarketSharp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">{jobCount} total MarketSharp jobs</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {job.customer_name
                            ? `${job.customer_name} - ${job.job_type || job.job_name}`
                            : job.job_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{job.job_type || '—'}</td>
                        <td className="px-4 py-3">
                          {job.category && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${job.category === 'Windows' ? 'bg-blue-100 text-blue-800' :
                                job.category === 'Bathrooms' ? 'bg-green-100 text-green-800' :
                                  job.category === 'Siding' ? 'bg-yellow-100 text-yellow-800' :
                                    job.category === 'Doors' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                              {job.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{job.status || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{job.address || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {job.start_date ? new Date(job.start_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(job.last_synced_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {jobs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                          No jobs synced yet. Click "Sync Now" to pull data from MarketSharp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            {syncLogs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
                No sync history yet. Run your first sync using the "Sync Now" button above.
              </div>
            ) : (
              syncLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.status === 'success' ? 'bg-green-100 text-green-800' :
                          log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            log.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {log.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                    </div>
                    {log.completed_at && (
                      <span className="text-xs text-gray-400">
                        Duration: {Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="text-gray-600">
                      <span className="font-medium text-green-600">{log.contacts_synced}</span> contacts
                    </span>
                    <span className="text-gray-600">
                      <span className="font-medium text-purple-600">{log.jobs_synced}</span> jobs
                    </span>
                    {log.errors && log.errors.length > 0 && (
                      <span className="text-gray-600">
                        <span className="font-medium text-red-600">{log.errors.length}</span> errors
                      </span>
                    )}
                  </div>
                  {log.errors && log.errors.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                        View errors ({log.errors.length})
                      </summary>
                      <div className="mt-2 p-3 bg-red-50 rounded-lg text-xs text-red-700 max-h-40 overflow-y-auto space-y-1">
                        {log.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
