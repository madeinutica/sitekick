'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

type Profile = {
  id: string
  full_name: string | null
  is_super_user: boolean
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isSuperUser, setIsSuperUser] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, is_super_user')
      .order('full_name', { ascending: true })
    
    if (error) {
      console.error(error)
    } else {
      setProfiles(data || [])
    }
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        
        // Check if current user is a super user
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_super_user')
          .eq('id', data.user.id)
          .maybeSingle()
        
        if (profile?.is_super_user) {
          setIsSuperUser(true)
          fetchProfiles()
        } else {
          alert('Access denied: Super user privileges required')
          router.push('/')
        }
      }
    }
    checkUser()
  }, [router, supabase, fetchProfiles])

  const toggleSuperUser = async (profileId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_super_user: !currentStatus })
      .eq('id', profileId)
    
    if (error) {
      console.error(error)
      alert('Error updating super user status')
    } else {
      fetchProfiles()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!isSuperUser) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Admin Panel
              </h1>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
            <p className="text-sm text-gray-600 mt-1">Manage super user access for all profiles</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Super User
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {profile.full_name || 'No name set'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 font-mono">
                        {profile.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {profile.is_super_user ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-green-800">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleSuperUser(profile.id, profile.is_super_user)}
                        disabled={profile.id === user?.id}
                        className={`${
                          profile.id === user?.id
                            ? 'text-gray-400 cursor-not-allowed'
                            : profile.is_super_user
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-red-600 hover:text-red-900'
                        } transition`}
                      >
                        {profile.id === user?.id
                          ? '(You)'
                          : profile.is_super_user
                          ? 'Revoke Access'
                          : 'Grant Access'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {profiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No profiles found</p>
          </div>
        )}
      </main>
    </div>
  )
}

