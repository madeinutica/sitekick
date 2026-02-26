'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const checkUser = async () => {
            const { data } = await supabase.auth.getUser()
            if (!data.user) {
                router.push('/login')
                return
            }

            // Check roles
            const { data: rolesData } = await supabase
                .from('user_roles')
                .select('roles(name)')
                .eq('user_id', data.user.id)

            const roles = (rolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []

            // Super Admins shouldn't have access to this page as per user request
            if (roles.includes('super_admin') || roles.includes('brand_ambassador')) {
                router.push('/admin')
                return
            }

            setUser(data.user)

            // Fetch profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', data.user.id)
                .maybeSingle()

            setProfile(profileData)
            setLoading(false)
        }
        checkUser()
    }, [router, supabase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-red"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex flex-col">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500 hover:text-slate-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <h1 className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                User Settings
                            </h1>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="text-sm font-semibold text-slate-600 hover:text-primary-red transition py-2 px-4 rounded-xl hover:bg-slate-100"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Navigation Sidebar */}
                    <aside className="md:col-span-1 space-y-2 text-sm">
                        <nav className="space-y-1">
                            <button className="w-full text-left px-4 py-3 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-900 font-bold flex items-center gap-3">
                                <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Account Profile
                            </button>
                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/50 text-slate-600 font-semibold flex items-center gap-3 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                Notifications
                            </button>
                            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/50 text-slate-600 font-semibold flex items-center gap-3 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Security
                            </button>
                        </nav>
                    </aside>

                    {/* Content Area */}
                    <div className="md:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Profile Section */}
                        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="relative group">
                                    {profile?.avatar_url ? (
                                        <Image
                                            src={profile.avatar_url}
                                            alt="Avatar"
                                            width={80}
                                            height={80}
                                            className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-50 transition group-hover:ring-primary-red/10"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-20 h-20 bg-primary-red rounded-2xl flex items-center justify-center ring-4 ring-slate-50">
                                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}
                                    <button className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-slate-100 text-slate-600 hover:text-primary-red transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">{profile?.full_name || 'Set your name'}</h2>
                                    <p className="text-slate-500 text-sm">{user.email}</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                                    <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                        Profile settings and notification preferences for your company account are coming soon.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Notification Placeholder */}
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-6">Device Notifications</h3>
                            <div className="flex items-center justify-between py-4 border-b border-slate-50">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">New Job Assignments</p>
                                    <p className="text-xs text-slate-500">Get notified when you are added to a project site.</p>
                                </div>
                                <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-not-allowed">
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Job Completion Alerts</p>
                                    <p className="text-xs text-slate-500">Receive alerts when a job you're assigned to is finished.</p>
                                </div>
                                <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-not-allowed">
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 bg-slate-50 border-t border-slate-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sitekick Platform Settings v1.0</p>
                </div>
            </footer>
        </div>
    )
}
