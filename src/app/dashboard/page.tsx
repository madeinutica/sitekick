'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isSuperUser, setIsSuperUser] = useState(false)
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)
  const [photoStats, setPhotoStats] = useState<{
    dailyUploads: { date: string; count: number }[]
    totalThisWeek: number
    weeklyGoal: number
    streak: number
  } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchProfileData = useCallback(async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_super_user, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    
    if (profileError) {
      console.error('Profile error:', profileError)
    } else if (profileData) {
      console.log('Home page - Profile loaded:', profileData)
      setIsSuperUser(profileData.is_super_user || false)
      setProfile(profileData)
    }
  }, [supabase])

  const fetchPhotoStats = useCallback(async (userId: string) => {
    // Get photos from the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: photos, error } = await supabase
      .from('job_photos')
      .select('created_at, user_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching photo stats:', error)
      return
    }

    // Process data for the last 7 days
    const dailyUploads = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const count = photos?.filter((photo: any) => {
        const photoDate = new Date(photo.created_at).toISOString().split('T')[0]
        return photoDate === dateStr && photo.user_id === userId
      }).length || 0
      
      dailyUploads.push({ date: dateStr, count })
    }

    // Calculate total this week
    const totalThisWeek = dailyUploads.reduce((sum, day) => sum + day.count, 0)
    
    // Calculate streak (consecutive days with at least 1 photo)
    let streak = 0
    for (let i = dailyUploads.length - 1; i >= 0; i--) {
      if (dailyUploads[i].count > 0) {
        streak++
      } else {
        break
      }
    }

    setPhotoStats({
      dailyUploads,
      totalThisWeek,
      weeklyGoal: 20, // Set a reasonable weekly goal
      streak
    })
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        fetchProfileData(data.user.id)
        fetchPhotoStats(data.user.id)
      }
    }
    checkUser()
  }, [router, supabase, fetchProfileData, fetchPhotoStats])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image
                src="/images/sitekick-logo-web.png"
                alt="Sitekick Logo"
                width={160}
                height={40}
                className="h-12 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-3 py-2 transition">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700">
                  {profile?.full_name || user?.email?.split('@')[0] || 'Profile'}
                </span>
              </Link>
              <button
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
          </h2>
          <p className="text-slate-600">{user.email}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/jobs">
            <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Jobs</h3>
                  <p className="text-slate-600 text-sm">Manage your jobs</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/gallery">
            <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Gallery</h3>
                  <p className="text-slate-600 text-sm">View all your photos</p>
                </div>
              </div>
            </div>
          </Link>

          <div className="bg-white rounded-xl border border-slate-200 p-6 opacity-50">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reports</h3>
                <p className="text-slate-600 text-sm">Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Photo Upload Progress Chart */}
        {photoStats && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Photo Upload Progress</h2>
                <p className="text-slate-600 text-sm mt-1">Your activity over the last 7 days</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">{photoStats.totalThisWeek}</div>
                <div className="text-sm text-slate-500">photos this week</div>
              </div>
            </div>

            {/* Progress towards goal */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Weekly Goal Progress</span>
                <span className="text-sm text-slate-500">{photoStats.totalThisWeek}/{photoStats.weeklyGoal}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div 
                  className="bg-linear-to-r from-red-500 to-orange-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((photoStats.totalThisWeek / photoStats.weeklyGoal) * 100, 100)}%` }}
                ></div>
              </div>
              {photoStats.totalThisWeek >= photoStats.weeklyGoal && (
                <div className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Goal achieved! 🎉
                </div>
              )}
            </div>

            {/* Streak indicator */}
            {photoStats.streak > 0 && (
              <div className="mb-6 p-4 bg-linear-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{photoStats.streak} Day Streak!</div>
                    <div className="text-sm text-slate-600">Keep it up! 🔥</div>
                  </div>
                </div>
              </div>
            )}

            {/* Motivational message */}
            <div className="mt-6 p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-900 mb-1">Upload More Photos!</div>
                  <div className="text-sm text-slate-600">
                    {photoStats.totalThisWeek < photoStats.weeklyGoal 
                      ? `You're ${photoStats.weeklyGoal - photoStats.totalThisWeek} photos away from your weekly goal. Every photo helps document your work better!`
                      : `Amazing work! You've exceeded your weekly goal. Keep up the great documentation!`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Panel Link for Super Users */}
        {isSuperUser && (
          <div className="mt-8">
            <Link href="/admin">
              <div className="bg-linear-to-r from-red-500 to-red-600 rounded-xl p-6 hover:shadow-lg transition cursor-pointer">
                <div className="flex items-center space-x-4 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Admin Panel</h3>
                    <p className="text-white/80 text-sm">Manage super user access</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Notes Section */}
          {/* Notes Section removed */}
      </main>
    </div>
  )
}
