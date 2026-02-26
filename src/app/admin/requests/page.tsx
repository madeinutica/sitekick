'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type JoinRequest = {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    profiles: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email: string | null
    }
}

export default function AdminRequestsPage() {
    const [requests, setRequests] = useState<JoinRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Get user's company
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single()

            if (!profile?.company_id) {
                setError('You are not associated with a company.')
                return
            }

            // Fetch pending requests
            const { data, error } = await supabase
                .from('company_join_requests')
                .select(`
          id,
          status,
          created_at,
          profiles (
            id,
            full_name,
            avatar_url
          )
        `)
                .eq('company_id', profile.company_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            setRequests(data as unknown as JoinRequest[])
        } catch (err: any) {
            console.error('Error fetching requests:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [supabase, router])

    useEffect(() => {
        fetchRequests()
    }, [fetchRequests])

    const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
        setProcessingId(requestId)
        setError(null)

        try {
            const functionName = action === 'approve' ? 'approve_company_join_request' : 'reject_company_join_request'
            const { data, error } = await supabase.rpc(functionName, { request_id: requestId })

            if (error) throw error

            setRequests(prev => prev.filter(r => r.id !== requestId))
        } catch (err: any) {
            console.error(`Error ${action}ing request:`, err)
            setError(err.message)
        } finally {
            setProcessingId(null)
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
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-manrope">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard">
                            <Image
                                src="/images/sitekick-logo-web.png"
                                alt="Sitekick Logo"
                                width={48}
                                height={48}
                                className="rounded-lg shadow-sm"
                            />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Join Requests</h1>
                            <p className="text-sm text-slate-500">Manage users requesting to join your company</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/dashboard"
                        className="text-sm font-medium text-slate-600 hover:text-primary-red transition"
                    >
                        &larr; Back to Dashboard
                    </Link>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {requests.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">No pending requests</h3>
                            <p className="text-slate-500">When people request to join your company, they'll appear here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {requests.map((request) => (
                                <div key={request.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                                    <div className="flex items-center space-x-4">
                                        {request.profiles.avatar_url ? (
                                            <Image
                                                src={request.profiles.avatar_url}
                                                alt={request.profiles.full_name || 'User'}
                                                width={48}
                                                height={48}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-primary-red-light rounded-full flex items-center justify-center font-bold text-primary-red">
                                                {(request.profiles.full_name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-semibold text-slate-900">{request.profiles.full_name || 'New User'}</h4>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider">
                                                Requested {new Date(request.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleAction(request.id, 'reject')}
                                            disabled={processingId !== null}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleAction(request.id, 'approve')}
                                            disabled={processingId !== null}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                                        >
                                            {processingId === request.id ? 'Processing...' : 'Approve'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
