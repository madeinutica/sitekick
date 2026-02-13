'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

// Clean job name by removing "Job-1", "Job1", "Job 1" etc. suffixes
function cleanJobName(name: string): string {
  return name
    .replace(/\s*[-–]\s*Job[-\s]?\d+\s*$/i, '')
    .replace(/\s*Job[-\s]?\d+\s*$/i, '')
    .trim() || name
}

type Job = {
  id: number
  job_name: string
  installation_info: string
  address: string
  category: string
  created_at: string
  user_id: string
  status?: string
  customer_name?: string
  contract_balance_due?: number
  profiles?: { full_name: string | null; avatar_url: string | null }
  assignedUsers?: { id: string; full_name: string | null; avatar_url: string | null }[]
}

export default function JobsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobName, setJobName] = useState('')
  const [installationInfo, setInstallationInfo] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState('Windows')
  const [showForm, setShowForm] = useState(false)
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)
  const [isSuperUser, setIsSuperUser] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string; avatar_url: string | null }[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filter jobs based on selected category, status, and search query
  const filteredJobs = jobs.filter(job => {
    const matchesCategory = categoryFilter === 'all' || job.category === categoryFilter
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'completed' && ['installed', 'completed', 'closed'].includes(job.status?.toLowerCase() || '')) ||
      (statusFilter === 'active' && job.status && !['installed', 'completed', 'closed'].includes(job.status.toLowerCase())) ||
      (statusFilter === 'no-status' && !job.status)
    const matchesSearch = searchQuery === '' ||
      job.job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesStatus && matchesSearch
  })

  const fetchJobs = useCallback(async (userId: string) => {
    // Get user roles first
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)

    const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
    const isSuperUser = roles.includes('super_admin')

    setLoading(true)

    let query = supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    // If not a super user, filter by user_id or job_assignments
    if (!isSuperUser) {
      // First get the job IDs the user is assigned to
      const { data: assignedJobIds } = await supabase
        .from('job_assignments')
        .select('job_id')
        .eq('user_id', userId)

      const assignedJobIdList = (assignedJobIds as { job_id: number }[] | null)?.map((a: { job_id: number }) => a.job_id) || []

      // Filter jobs where user is owner OR assigned
      const orConditions = [`user_id.eq.${userId}`]
      if (assignedJobIdList.length > 0) {
        orConditions.push(`id.in.(${assignedJobIdList.join(',')})`)
      }
      query = query.or(orConditions.join(','))
    }

    const { data, error } = await query

    if (error) {
      console.error('Jobs fetch error:', error)
    } else {
      if (data && data.length > 0) {
        // Batch fetch: get all unique user_ids and job_ids
        const jobIds = data.map((j: { id: number }) => j.id)
        const ownerIds = [...new Set(data.map((j: { user_id: string | null }) => j.user_id).filter(Boolean))] as string[]

        // Batch fetch owner profiles
        let ownerProfiles: { id: string; full_name: string | null; avatar_url: string | null }[] = []
        if (ownerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', ownerIds)
          ownerProfiles = profiles || []
        }

        // Batch fetch all assignments for these jobs
        const { data: allAssignments } = await supabase
          .from('job_assignments')
          .select('job_id, user_id')
          .in('job_id', jobIds)

        // Get unique assigned user IDs and batch fetch their profiles
        const assignedUserIds = [...new Set((allAssignments || []).map((a: { user_id: string }) => a.user_id))] as string[]
        let assignedProfiles: { id: string; full_name: string | null; avatar_url: string | null }[] = []
        if (assignedUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', assignedUserIds)
          assignedProfiles = profiles || []
        }

        // Assemble jobs with profiles and assigned users
        const jobsWithProfiles = data.map((job: { id: number; user_id: string | null }) => {
          const ownerProfile = ownerIds.length > 0
            ? ownerProfiles.find(p => p.id === job.user_id) || null
            : null

          const jobAssignments = (allAssignments || []).filter((a: { job_id: number }) => a.job_id === job.id)
          const assignedUsers = jobAssignments.map((a: { user_id: string }) => {
            const profile = assignedProfiles.find(p => p.id === a.user_id)
            return {
              id: a.user_id,
              full_name: profile?.full_name || null,
              avatar_url: profile?.avatar_url || null,
            }
          })

          return { ...job, profiles: ownerProfile, assignedUsers }
        })

        setJobs(jobsWithProfiles)
      } else {
        setJobs([])
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        fetchJobs(data.user.id)

        // Get profile data and check if super user
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, is_super_user')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profileData) {
          setProfile(profileData)

          // Get user roles
          const { data: userRolesData } = await supabase
            .from('user_roles')
            .select('roles(name)')
            .eq('user_id', data.user.id)

          const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
          setIsSuperUser(roles.includes('super_admin'))

          // If super user, fetch all users for assignment
          if (roles.includes('super_admin')) {
            const { data: usersData } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .order('full_name')
            if (usersData) {
              setUsers(usersData.map((profile: { id: string; full_name: string | null; avatar_url: string | null }) => ({
                id: profile.id,
                full_name: profile.full_name,
                email: '', // Email not accessible client-side
                avatar_url: profile.avatar_url
              })))
            }
          }
        }
      }
    }
    checkUser()
  }, [router, supabase, fetchJobs])

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && showAccountDropdown) {
        setShowAccountDropdown(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showAccountDropdown])

  const handleAddJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return

    // Create the job first
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        job_name: jobName,
        installation_info: installationInfo,
        address: address,
        category: category,
        user_id: user.id // Keep the creator as user_id
      })
      .select()
      .single()

    if (jobError) {
      console.error(jobError)
      return
    }

    // If super user and users selected, assign them to the job
    if (isSuperUser && selectedUserIds.length > 0) {
      const assignments = selectedUserIds.map(userId => ({
        job_id: jobData.id,
        user_id: userId,
        assigned_by: user.id
      }))

      console.log('Creating assignments:', assignments)
      const { error: assignmentError } = await supabase
        .from('job_assignments')
        .insert(assignments)

      if (assignmentError) {
        console.error('Error assigning users:', assignmentError)
        // Still continue since job was created
      } else {
        console.log('Assignments created successfully')
      }
    }

    fetchJobs(user.id)
    setJobName('')
    setInstallationInfo('')
    setAddress('')
    setCategory('Windows')
    setSelectedUserIds([])
    setShowForm(false)
  }

  const handleDeleteJob = async (jobId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this job? This will also delete all associated photos.')) {
      return
    }

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (error) {
      console.error(error)
      alert('Failed to delete job')
    } else if (user) {
      fetchJobs(user.id)
    }
  }

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
              <Link href="/dashboard">
                <div className="w-10 h-10 bg-primary-red-light rounded-lg flex items-center justify-center cursor-pointer">
                  <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
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
                    <Link href="/profile" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Profile
                    </Link>
                    <Link href="/settings" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Settings
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAccountDropdown(false)
                        handleSignOut()
                      }}
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
                    <Link href="/profile" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Profile
                    </Link>
                    <Link href="/settings" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Settings
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAccountDropdown(false)
                        handleSignOut()
                      }}
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

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Your Jobs</h2>
                  <p className="text-slate-600 text-sm mt-1">
                    {filteredJobs.length} of {jobs.length} total jobs
                    {categoryFilter !== 'all' && (
                      <span className="ml-2 text-primary-red">
                        (filtered by {categoryFilter})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Filter Bar - Only for Super Users */}
              {isSuperUser && (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search by job name, customer, or address..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns and Add Button */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Category Filter */}
                    <div className="relative">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      >
                        <option value="all">All Categories ({jobs.length})</option>
                        <option value="Windows">Windows ({jobs.filter(job => job.category === 'Windows').length})</option>
                        <option value="Bathrooms">Bathrooms ({jobs.filter(job => job.category === 'Bathrooms').length})</option>
                        <option value="Siding">Siding ({jobs.filter(job => job.category === 'Siding').length})</option>
                        <option value="Doors">Doors ({jobs.filter(job => job.category === 'Doors').length})</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active Jobs</option>
                        <option value="completed">Completed Jobs</option>
                        <option value="no-status">No Status</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Add Job Button */}
                    <button
                      onClick={() => setShowForm(!showForm)}
                      className="ml-auto px-4 py-2 bg-gradient-to-r from-primary-red to-red-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Job</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add Job Form */}
            {showForm && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">New Job</h3>
                <form onSubmit={handleAddJob} className="space-y-4">
                  <div>
                    <label className="block text-sm font-normal text-slate-700 mb-2">
                      Job Name
                    </label>
                    <input
                      type="text"
                      placeholder="Kitchen Renovation - Smith Residence"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-slate-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      placeholder="123 Main St, City, State"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-slate-700 mb-2">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      required
                    >
                      <option value="Windows">Windows</option>
                      <option value="Bathrooms">Bathrooms</option>
                      <option value="Siding">Siding</option>
                      <option value="Doors">Doors</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-normal text-slate-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      placeholder="Additional details..."
                      value={installationInfo}
                      onChange={(e) => setInstallationInfo(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      rows={3}
                    />
                  </div>
                  {isSuperUser && (
                    <div>
                      <label className="block text-sm font-normal text-slate-700 mb-2">
                        Assign to Users
                      </label>
                      <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-3">
                        {users.map((u) => (
                          <label key={u.id} className="flex items-center space-x-3 py-2 hover:bg-slate-50 rounded px-2">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds([...selectedUserIds, u.id])
                                } else {
                                  setSelectedUserIds(selectedUserIds.filter(id => id !== u.id))
                                }
                              }}
                              className="w-4 h-4 text-primary-red border-slate-300 rounded focus:ring-primary-red"
                            />
                            <div className="flex items-center space-x-3">
                              {u.avatar_url ? (
                                <Image
                                  src={u.avatar_url}
                                  alt={u.full_name || 'User'}
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-primary-red-light rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm font-medium text-slate-900">
                                {u.full_name || u.email || 'Unnamed User'}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                      {selectedUserIds.length > 0 && (
                        <p className="text-xs text-slate-500 mt-2">
                          {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-primary-red text-white rounded-lg font-medium hover:bg-primary-red-dark transition"
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
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-primary-red border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 mt-4 font-medium italic">Loading your jobs...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="relative group">
                    <Link href={`/jobs/${job.id}`}>
                      <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer relative">
                        <div className="flex items-start space-x-4">
                          {/* Assigned Users Avatars or Default Icon */}
                          <div className="w-12 h-12 shrink-0">
                            {job.assignedUsers && job.assignedUsers.length > 0 ? (
                              <div className="flex -space-x-1">
                                {job.assignedUsers.slice(0, 3).map((assignedUser) => (
                                  <div key={assignedUser.id} className="relative">
                                    {assignedUser.avatar_url ? (
                                      <Image
                                        src={assignedUser.avatar_url}
                                        alt={assignedUser.full_name || 'User'}
                                        width={32}
                                        height={32}
                                        className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 bg-primary-red-light rounded-full border-2 border-white flex items-center justify-center">
                                        <svg className="w-4 h-4 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {job.assignedUsers.length > 3 && (
                                  <div className="w-8 h-8 bg-slate-200 rounded-full border-2 border-white flex items-center justify-center">
                                    <span className="text-xs font-medium text-slate-600">+{job.assignedUsers.length - 3}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-primary-red-light rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-lg font-semibold text-slate-900 truncate">{cleanJobName(job.job_name)}</h3>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-red-light text-primary-red">
                                {job.category}
                              </span>
                              {job.status && (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${['installed', 'completed', 'closed'].includes(job.status.toLowerCase())
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {job.status}
                                </span>
                              )}
                            </div>
                            <div className="mt-1">
                              {job.assignedUsers && job.assignedUsers.length > 0 ? (
                                <p className="text-slate-500 text-xs">Assigned to {job.assignedUsers.length} user{job.assignedUsers.length !== 1 ? 's' : ''}</p>
                              ) : (
                                <p className="text-slate-500 text-xs">Created by: {job.profiles?.full_name || 'Unknown'}</p>
                              )}
                            </div>
                            {job.address && (
                              <p className="text-slate-600 text-sm mt-1 truncate">{job.address}</p>
                            )}
                            {job.installation_info && (
                              <p className="text-slate-500 text-xs mt-2 line-clamp-2">{job.installation_info}</p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                    {isSuperUser && (
                      <button
                        onClick={(e) => handleDeleteJob(job.id, e)}
                        className="absolute top-2 right-2 w-8 h-8 bg-primary-red text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-primary-red-dark"
                        title="Delete job"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!loading && filteredJobs.length === 0 && !showForm && isSuperUser && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No jobs yet</h3>
                <p className="text-slate-600 mb-4">Get started by adding your first job</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-primary-red text-white rounded-lg font-medium hover:bg-primary-red-dark transition"
                >
                  Add Your First Job
                </button>
              </div>
            )}

            {!loading && filteredJobs.length === 0 && !showForm && !isSuperUser && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No jobs available</h3>
                <p className="text-slate-600 mb-4">Contact your administrator to create jobs</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

