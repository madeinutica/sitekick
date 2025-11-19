'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isSuperUser, setIsSuperUser] = useState(false)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  const fetchProfileData = useCallback(async (userId: string) => {
    // Get profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    
    if (profileError) {
      console.error('Profile error:', profileError)
    } else if (profileData) {
      setProfile(profileData)
    }

    // Get user roles
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)
    
    const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
    setUserRoles(roles)
    setIsSuperUser(roles.includes('super_admin'))
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        fetchProfileData(data.user.id)
      }
    }
    checkUser()
  }, [router, supabase, fetchProfileData])

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray">
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
              {/* Desktop Account Dropdown */}
              <div className="hidden md:block relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-3 py-2 transition"
                >
                  {profile?.avatar_url ? (
                    <Image 
                      src={profile.avatar_url} 
                      alt="Profile" 
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary-red-light rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {profile?.full_name || 'Name'}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAccountDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <Link href="/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Profile
                    </Link>
                    <Link href="/settings" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Account Dropdown */}
              <div className="md:hidden relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-3 py-2 transition"
                >
                  {profile?.avatar_url ? (
                    <Image 
                      src={profile.avatar_url} 
                      alt="Profile" 
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary-red-light rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {profile?.full_name || 'Name'}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAccountDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <Link href="/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Profile
                    </Link>
                    <Link href="/settings" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Main Content Area */}
          <div className="flex-1">
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
                <div className="w-12 h-12 bg-primary-red-light rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {!userRoles.includes('installer') && !userRoles.includes('measure_tech') && (
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
          )}

          {isSuperUser && (
            <Link href="/admin">
              <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-red-light rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">User Management</h3>
                    <p className="text-slate-600 text-sm">Manage user roles and permissions</p>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Notes Section */}
          {/* Notes Section removed */}
          </div>
        </div>
      </main>
    </div>
  )
}
