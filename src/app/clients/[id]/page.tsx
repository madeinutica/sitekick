'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

type Client = {
  id: number
  name: string
  address: string
}

type Job = {
  id: number
  description: string
  installation_info: string
}

export default function ClientDetailPage() {
  const [user, setUser] = useState<User | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [description, setDescription] = useState('')
  const [installationInfo, setInstallationInfo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const clientId = params.id

  const fetchClient = useCallback(async () => {
    if (!clientId) return
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    if (error) {
      console.error(error)
    } else {
      setClient(data)
    }
  }, [supabase, clientId])

  const fetchJobs = useCallback(async () => {
    if (!clientId) return
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', clientId)
    if (error) {
      console.error(error)
    } else {
      setJobs(data)
    }
  }, [supabase, clientId])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        fetchClient()
        fetchJobs()
      }
    }
    checkUser()
  }, [router, supabase, fetchClient, fetchJobs])

  const handleAddJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !client) return
    const { error } = await supabase.from('jobs').insert({
      client_id: client.id,
      description,
      installation_info: installationInfo,
      user_id: user.id,
    })
    if (error) {
      console.error(error)
    } else {
      fetchJobs()
      setDescription('')
      setInstallationInfo('')
      setShowForm(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user || !client) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/clients">
                <button className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition">
                  <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
                <p className="text-sm text-slate-600">{client.address || 'No address'}</p>
              </div>
            </div>
            <button
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Jobs</h2>
            <p className="text-slate-600 text-sm mt-1">{jobs.length} total jobs</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Job</span>
          </button>
        </div>

        {/* Add Job Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">New Job</h3>
            <form onSubmit={handleAddJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Installation job"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Installation Info
                </label>
                <textarea
                  placeholder="Additional details..."
                  value={installationInfo}
                  onChange={(e) => setInstallationInfo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                  Add Job
                </button>
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Jobs List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <Link key={job.id} href={`/clients/${client.id}/jobs/${job.id}`}>
              <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900">{job.description}</h3>
                    <p className="text-slate-600 text-sm mt-1 line-clamp-2">{job.installation_info || 'No additional info'}</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {jobs.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No jobs yet</h3>
            <p className="text-slate-600 mb-4">Create your first job for this client</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Add Your First Job
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
