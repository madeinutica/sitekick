'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Company = {
    id: string
    name: string
}

type JoinRequest = {
    id: string
    company_id: string
    status: 'pending' | 'approved' | 'rejected'
    companies: { name: string }
}

export default function JoinCompanyPage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [searching, setSearching] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [foundCompany, setFoundCompany] = useState<Company | null>(null)
    const [request, setRequest] = useState<JoinRequest | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)

            // Fetch profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*, companies(name)')
                .eq('id', user.id)
                .single()

            setProfile(profileData)

            // Fetch existing pending/rejected requests
            const { data: requestData } = await supabase
                .from('company_join_requests')
                .select('*, companies(name)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            setRequest(requestData)
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }, [supabase, router])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchTerm.trim()) return

        setSearching(true)
        setError(null)
        setFoundCompany(null)

        try {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name')
                .eq('name', searchTerm.trim())
                .maybeSingle()

            if (error) throw error

            if (data) {
                setFoundCompany(data)
            } else {
                setError('No company found with that exact name. Please check for spelling or contact your admin.')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSearching(false)
        }
    }

    const submitRequest = async () => {
        if (!foundCompany || !user) return

        setSubmitting(true)
        setError(null)

        try {
            const { data, error } = await supabase
                .from('company_join_requests')
                .insert({
                    user_id: user.id,
                    company_id: foundCompany.id,
                    status: 'pending'
                })
                .select('*, companies(name)')
                .single()

            if (error) {
                if (error.code === '23505') {
                    throw new Error('You already have a pending request for this company.')
                }
                throw error
            }

            setRequest(data)
            setSuccess('Your request has been submitted! An admin will need to approve it.')
            setFoundCompany(null)
            setSearchTerm('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-red"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-10">
                    <Link href="/dashboard">
                        <Image
                            src="/images/sitekick-logo-web.png"
                            alt="Sitekick Logo"
                            width={80}
                            height={80}
                            className="mx-auto mb-6 hover:opacity-80 transition"
                        />
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Join a Company</h1>
                    <p className="mt-2 text-slate-600">
                        Request access to your team's job sites and photos
                    </p>
                </div>

                {profile?.companies && (
                    <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 mb-8">
                        <div className="flex items-center space-x-3 text-emerald-700 mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold">Current Company</span>
                        </div>
                        <p className="text-slate-900 font-medium text-lg">{profile.companies.name}</p>
                        <p className="text-sm text-slate-500 mt-1">You can request to switch companies below.</p>
                    </div>
                )}

                {request && request.status === 'pending' && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 mb-8 text-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-amber-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-amber-900 font-semibold mb-1">Request Pending</h3>
                        <p className="text-amber-800 text-sm">
                            Waiting for approval from <span className="font-bold">{request.companies.name}</span>
                        </p>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="p-8">
                        {success && (
                            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
                                {success}
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        {!foundCompany ? (
                            <form onSubmit={handleSearch} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Company Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Enter exact company name"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-red focus:border-transparent transition"
                                            required
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 italic">
                                        For security, you must enter the name exactly as it's registered.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="w-full flex justify-center py-3 px-4 rounded-xl shadow-lg text-sm font-semibold text-white bg-primary-red hover:bg-primary-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all disabled:opacity-50"
                                >
                                    {searching ? (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        'Find Company'
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                    <p className="text-sm text-slate-500 mb-1">Match Found!</p>
                                    <h3 className="text-xl font-bold text-slate-900">{foundCompany.name}</h3>
                                </div>

                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => setFoundCompany(null)}
                                        disabled={submitting}
                                        className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitRequest}
                                        disabled={submitting}
                                        className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary-red hover:bg-primary-red-dark transition shadow-lg shadow-primary-red-lighter"
                                    >
                                        {submitting ? 'Submitting...' : 'Request Access'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
                        <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-primary-red transition">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
