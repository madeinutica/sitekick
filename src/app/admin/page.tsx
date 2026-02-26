'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

type Stats = {
  totalUsers: number
  newUsersWeek: number
  totalCompanies: number
}

type RecentActivity = {
  id: string
  type: 'user' | 'job' | 'request'
  title: string
  description: string
  company?: string
  timestamp: string
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    newUsersWeek: 0,
    totalCompanies: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const router = useRouter()
  const supabase = createClient()

  const fetchStats = useCallback(async () => {
    try {
      // 1. Total Users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // 2. New Users this week
      const aWeekAgo = new Date()
      aWeekAgo.setDate(aWeekAgo.getDate() - 7)
      const { count: newUserCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('updated_at', aWeekAgo.toISOString())

      // 3. Total Companies
      const { count: companyCount } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalUsers: userCount || 0,
        newUsersWeek: newUserCount || 0,
        totalCompanies: companyCount || 0,
      })

      // Fetch Recent Activity
      const { data: latestProfiles } = await supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          updated_at,
          company:companies(name)
        `)
        .order('updated_at', { ascending: false })
        .limit(5)

      const activity: RecentActivity[] = [
        ...(latestProfiles?.map((p: any) => ({
          id: p.id,
          type: 'user' as const,
          title: 'Profile Updated',
          description: `${p.full_name || 'A user'} updated their profile.`,
          company: p.company?.name,
          timestamp: p.updated_at,
        })) || []),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setRecentActivity(activity.slice(0, 5))

    } catch (err) {
      console.error('Error fetching admin stats:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }

      // Verify roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', data.user.id)

      const roles = (rolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []

      // Redirect Company Admins to the User Management page
      if (roles.includes('company_admin') && !roles.includes('super_admin') && !roles.includes('brand_ambassador')) {
        router.push('/dashboard/user-management')
        return
      }

      // Strictly only platform-level admins past this point
      if (!roles.includes('super_admin') && !roles.includes('brand_ambassador')) {
        router.push('/')
        return
      }

      setUser(data.user)
      fetchStats()
    }
    checkUser()
  }, [router, supabase, fetchStats])

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
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-manrope">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">Global platform overview and system controls.</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-medium text-green-700">System Live</span>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2"></div>

            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-slate-600 hover:text-primary-red transition px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            subtitle={`${stats.newUsersWeek} new this week`}
            icon={<UserIcon />}
            color="blue"
          />
          <StatCard
            title="Companies"
            value={stats.totalCompanies}
            subtitle="Registered entities"
            icon={<CompanyIcon />}
            color="emerald"
          />
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Recent Activity Feed */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recent User Activity
            </h2>
            <div className="space-y-6">
              {recentActivity.length > 0 ? (
                recentActivity.map((act) => (
                  <div key={act.id} className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                      <SmallUserIcon />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{act.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {act.description}
                        {act.company && <span className="ml-1 text-primary-red font-medium">({act.company})</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
                        {new Date(act.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-10">No recent activity found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle, icon, color, highlight }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600'
  }

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border ${highlight ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        {highlight && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
            ATTENTION
          </span>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

function NavTile({ href, title, description, icon, badge }: any) {
  return (
    <Link
      href={href}
      className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-primary-red hover:shadow-xl hover:shadow-primary-red/5 transition-all duration-300 relative"
    >
      <div className="w-12 h-12 rounded-xl bg-slate-50 group-hover:bg-primary-red/10 flex items-center justify-center text-slate-600 group-hover:text-primary-red mb-4 transition-colors">
        {icon}
      </div>
      <h3 className="font-bold text-slate-900 group-hover:text-primary-red transition-colors">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
      {badge && (
        <span className="absolute top-4 right-4 bg-primary-red text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  )
}

// Icons
const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

const JobIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const CompanyIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const RequestIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
)

const UserManageIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
)

const SmallUserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const SmallJobIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)
