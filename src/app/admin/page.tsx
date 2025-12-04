'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

type UserWithRoles = {
  id: string
  full_name: string | null
  email: string
  roles: string[]
}

type Role = {
  id: number
  name: string
  description: string | null
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchUsersAndRoles = useCallback(async () => {
    setLoading(true)
    
    // Fetch all roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .order('name')
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return
    }
    
    setRoles(rolesData || [])

    // Fetch all users with their roles
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name')
    
    if (usersError) {
      console.error('Error fetching users:', usersError)
      return
    }

    // For each user, fetch their roles
    const usersWithRoles = await Promise.all(
      (usersData || []).map(async (profile: { id: string; full_name: string | null }) => {
        // First get role_ids
        const { data: userRoleIds } = await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', profile.id)
        
        let roleNames: string[] = []
        if (userRoleIds && userRoleIds.length > 0) {
          const roleIds = userRoleIds.map((ur: { role_id: number }) => ur.role_id)
          const { data: rolesData } = await supabase
            .from('roles')
            .select('name')
            .in('id', roleIds)
          roleNames = rolesData?.map((r: { name: string }) => r.name).filter(Boolean) || []
        }
        
        // Get email from auth.users (this might not work due to RLS, so we'll use a placeholder)
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: 'N/A', // Email not accessible client-side
          roles: roleNames
        }
      })
    )
    
    setUsers(usersWithRoles)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        
        // Check if current user is a super admin
        // First, get the user's role_ids
        console.log('Checking user authentication:', { user: data.user, userId: data.user.id })
        
        const { data: userRoleIds, error: roleIdsError } = await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', data.user.id)
        
        console.log('User role IDs query result:', { userRoleIds, roleIdsError, userId: data.user.id })
        console.log('Error details:', JSON.stringify(roleIdsError, null, 2))
        
        if (roleIdsError) {
          console.error('Error fetching user role IDs:', roleIdsError)
          alert(`Error checking permissions: ${roleIdsError.message || 'Unknown error'}. Please try again.`)
          router.push('/')
          return
        }
        
        if (!userRoleIds || userRoleIds.length === 0) {
          console.log('No role IDs found for user')
          alert('Access denied: Super admin privileges required. Your roles: none')
          router.push('/')
          return
        }
        
        // Now get the role names for these IDs
        const roleIds = userRoleIds.map((ur: { role_id: number }) => ur.role_id)
        const { data: rolesData, error: rolesDataError } = await supabase
          .from('roles')
          .select('name')
          .in('id', roleIds)
        
        console.log('Roles data query result:', { rolesData, rolesDataError, roleIds })
        
        const roleNames = rolesData?.map((r: { name: string }) => r.name).filter(Boolean) || []
        
        console.log('Final role names:', roleNames)
        console.log('Is super admin?', roleNames.includes('super_admin'))
        
        if (roleNames.includes('super_admin')) {
          setIsSuperAdmin(true)
          fetchUsersAndRoles()
        } else {
          alert(`Access denied: Super admin privileges required. Your roles: ${roleNames.join(', ') || 'none'}`)
          router.push('/')
        }
      }
    }
    checkUser()
  }, [router, supabase, fetchUsersAndRoles])

  const assignRole = async (userId: string, roleName: string) => {
    const role = roles.find(r => r.name === roleName)
    if (!role) return

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: role.id })
      .select()
    
    if (error) {
      console.error('Error assigning role:', error)
      alert(`Error assigning role: ${error.message}`)
    } else {
      fetchUsersAndRoles()
    }
  }

  const removeRole = async (userId: string, roleName: string) => {
    const role = roles.find(r => r.name === roleName)
    if (!role) return

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', role.id)
    
    if (error) {
      console.error('Error removing role:', error)
      alert(`Error removing role: ${error.message}`)
    } else {
      fetchUsersAndRoles()
    }
  }

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone and will remove all their data.`)) {
      return
    }

    try {
      // First delete user roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
      
      if (roleError) {
        console.error('Error deleting user roles:', roleError)
        alert(`Error deleting user roles: ${roleError.message}`)
        return
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)
      
      if (profileError) {
        console.error('Error deleting user profile:', profileError)
        alert(`Error deleting user profile: ${profileError.message}`)
        return
      }

      // Note: We can't delete from auth.users directly from client-side
      // This would need to be done server-side or through Supabase Admin API
      
      alert(`User "${userName}" has been deleted successfully.`)
      fetchUsersAndRoles()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('An unexpected error occurred while deleting the user.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!isSuperAdmin || loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-red mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray">
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
              <h1 className="text-2xl font-bold bg-linear-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
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
            <h2 className="text-lg font-semibold text-gray-900">User Role Management</h2>
            <p className="text-sm text-gray-600 mt-1">Assign and manage roles for all users</p>
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
                    Current Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assign Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((userData) => (
                  <tr key={userData.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {userData.full_name || 'No name set'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 font-mono">
                        {userData.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {userData.roles.length > 0 ? (
                          userData.roles.map((roleName) => (
                            <span key={roleName} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {roleName}
                              {userData.id !== user?.id && (
                                <button
                                  onClick={() => removeRole(userData.id, roleName)}
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                  title={`Remove ${roleName} role`}
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No roles assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignRole(userData.id, e.target.value)
                            e.target.value = '' // Reset select
                          }
                        }}
                        disabled={userData.id === user?.id}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Select role...</option>
                        {roles
                          .filter(role => !userData.roles.includes(role.name))
                          .map((role) => (
                            <option key={role.id} value={role.name}>
                              {role.name} - {role.description}
                            </option>
                          ))
                        }
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {userData.id !== user?.id && (
                        <button
                          onClick={() => deleteUser(userData.id, userData.full_name || 'Unknown User')}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                          title="Delete user"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </main>
    </div>
  )
}

