'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
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

type JoinRequest = {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    profiles: {
        id: string
        full_name: string | null
        avatar_url: string | null
    }
}

export default function UserManagementPage() {
    const [user, setUser] = useState<User | null>(null)
    const [users, setUsers] = useState<UserWithRoles[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [isCompanyAdmin, setIsCompanyAdmin] = useState(false)
    const [companyId, setCompanyId] = useState<string | null>(null)
    const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const fetchUsersAndRoles = useCallback(async (isGlobalAdmin: boolean, currentCompanyId: string | null) => {
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

        // Filter roles for Company Admins (cannot assign Super Admin roles)
        const filteredRoles = isGlobalAdmin
            ? (rolesData || [])
            : (rolesData || []).filter((r: Role) => !['super_admin', 'brand_ambassador'].includes(r.name))

        setRoles(filteredRoles)

        // Fetch users
        let query = supabase.from('profiles').select('id, full_name, company_id')

        // If only a company admin, restrict to their company
        if (!isGlobalAdmin && currentCompanyId) {
            query = query.eq('company_id', currentCompanyId)
        }

        const { data: usersData, error: usersError } = await query.order('full_name')

        if (usersError) {
            console.error('Error fetching users:', usersError)
            return
        }

        // For each user, fetch their roles and filter out platform-level users from Company Admin view
        const usersWithRoles = await Promise.all(
            (usersData || []).map(async (profile: { id: string; full_name: string | null; company_id?: string | null }) => {
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

                // ALWAYS hide platform-level users from User Management list
                // as they are managed via the platform, not individual companies.
                if (roleNames.some(rn => ['super_admin', 'brand_ambassador'].includes(rn))) {
                    return null
                }

                return {
                    id: profile.id,
                    full_name: profile.full_name,
                    email: 'N/A',
                    roles: roleNames
                }
            })
        )

        setUsers(usersWithRoles.filter((u): u is UserWithRoles => u !== null))
        setLoading(false)
    }, [supabase])

    const fetchPendingRequests = useCallback(async (currentCompanyId: string | null) => {
        if (!currentCompanyId) return

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
            .eq('company_id', currentCompanyId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching pending requests:', error)
        } else {
            setPendingRequests(data as unknown as JoinRequest[])
        }
    }, [supabase])

    useEffect(() => {
        const checkUser = async () => {
            const { data } = await supabase.auth.getUser()
            if (!data.user) {
                router.push('/login')
            } else {
                setUser(data.user)

                // Check for companyId override in search params (for Super Admins)
                const overrideCompanyId = searchParams.get('companyId')

                // Get profile to find personal company_id
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('company_id')
                    .eq('id', data.user.id)
                    .single()

                const personalCompanyId = profileData?.company_id || null

                // Fetch user's roles
                const { data: userRolesData, error: roleIdsError } = await supabase
                    .from('user_roles')
                    .select('roles(name)')
                    .eq('user_id', data.user.id)

                if (roleIdsError) {
                    console.error('Error fetching user roles:', roleIdsError)
                    router.push('/')
                    return
                }

                const roleNames = (userRolesData as unknown as { roles: { name: string } }[])
                    ?.map(ur => ur.roles?.name)
                    .filter(Boolean) || []

                const globalAdmin = roleNames.includes('super_admin') || roleNames.includes('brand_ambassador')
                const companyAdmin = roleNames.includes('company_admin')

                setIsSuperAdmin(globalAdmin)
                setIsCompanyAdmin(companyAdmin)

                // Company context restricted to personal company only
                setCompanyId(personalCompanyId)

                if (companyAdmin) {
                    if (!personalCompanyId) {
                        console.error('Company Admin has no associated company_id')
                        alert('Warning: Your account is set as a Company Admin but is not associated with any company. Please contact support.')
                        router.push('/')
                        return
                    }
                    fetchUsersAndRoles(globalAdmin, personalCompanyId)
                    fetchPendingRequests(personalCompanyId)
                } else if (globalAdmin) {
                    // Global admins should manage users via a different (to be implemented) or platform-wide UI
                    // For now, redirect them back to /admin as they shouldn't view specific company users here
                    router.push('/admin')
                } else {
                    alert('Access denied: Unauthorized access to User Management.')
                    router.push('/')
                }
            }
        }
        checkUser()
    }, [router, supabase, fetchUsersAndRoles, searchParams])

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
            fetchUsersAndRoles(isSuperAdmin, companyId)
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
            fetchUsersAndRoles(isSuperAdmin, companyId)
        }
    }

    const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
        setProcessingRequestId(requestId)
        try {
            const functionName = action === 'approve' ? 'approve_company_join_request' : 'reject_company_join_request'
            const { error } = await supabase.rpc(functionName, { request_id: requestId })

            if (error) throw error

            // Refresh data
            setPendingRequests(prev => prev.filter(r => r.id !== requestId))
            if (action === 'approve') {
                fetchUsersAndRoles(isSuperAdmin, companyId)
            }
        } catch (err: any) {
            console.error(`Error ${action}ing request:`, err)
            alert(`Error ${action}ing request: ${err.message}`)
        } finally {
            setProcessingRequestId(null)
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

            alert(`User "${userName}" has been deleted successfully.`)
            fetchUsersAndRoles(isSuperAdmin, companyId)
        } catch (error) {
            console.error('Error deleting user:', error)
            alert('An unexpected error occurred while deleting the user.')
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    if ((!isSuperAdmin && !isCompanyAdmin) || loading) {
        return (
            <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-red mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading user management...</p>
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
                            <Link href={isSuperAdmin ? "/admin" : "/dashboard"} className="text-gray-600 hover:text-gray-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <h1 className="text-2xl font-bold bg-linear-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                                User Management
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
                        <p className="text-sm text-gray-600 mt-1">Assign and manage roles for users</p>
                    </div>

                    {/* Pending Requests Section */}
                    {pendingRequests.length > 0 && (
                        <div className="p-6 bg-amber-50 border-b border-amber-100">
                            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                                Pending Join Requests ({pendingRequests.length})
                            </h3>
                            <div className="space-y-3">
                                {pendingRequests.map((request) => (
                                    <div key={request.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            {request.profiles.avatar_url ? (
                                                <img src={request.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold">
                                                    {(request.profiles.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{request.profiles.full_name || 'Unknown User'}</p>
                                                <p className="text-xs text-gray-500">Requested {new Date(request.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRequestAction(request.id, 'reject')}
                                                disabled={processingRequestId !== null}
                                                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleRequestAction(request.id, 'approve')}
                                                disabled={processingRequestId !== null}
                                                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm transition disabled:opacity-50"
                                            >
                                                {processingRequestId === request.id ? 'Processing...' : 'Approve'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
