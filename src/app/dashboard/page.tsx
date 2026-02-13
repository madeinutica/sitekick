'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

type Job = {
  id: number
  job_name: string
  address: string
  customer_name?: string
  status?: string
  category?: string
  latitude?: number
  longitude?: number
}

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
  const [jobs, setJobs] = useState<Job[]>([])
  const [geocodedJobs, setGeocodedJobs] = useState<(Job & { latitude: number; longitude: number })[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [mapLoading, setMapLoading] = useState(true)

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

  const fetchJobs = useCallback(async (userId: string) => {
    setMapLoading(true)

    // Get user roles and company_id
    const { data: profileData } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single()

    const companyId = profileData?.company_id

    // Get user roles first to check if super user
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId)

    const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
    const isSuperUserRole = roles.includes('super_admin')

    let query = supabase
      .from('jobs')
      .select('id, job_name, address, customer_name, status, category')
      .order('created_at', { ascending: false })
      .limit(50)

    // If not a super user, filter by company_id
    if (!isSuperUserRole) {
      if (companyId) {
        query = query.eq('company_id', companyId)
      } else {
        // Fallback for users without a company_id linked yet
        query = query.eq('user_id', userId)
      }
    }

    const { data: jobsData, error: jobsError } = await query

    if (jobsError) {
      console.error('Jobs error:', jobsError)
    } else if (jobsData) {
      setJobs(jobsData)
      // Geocode jobs that have addresses
      const jobsWithCoords: (Job & { latitude: number; longitude: number })[] = []

      for (const job of jobsData) {
        if (!job.address) continue

        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(job.address)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}&limit=1`
          )
          const data = await response.json()

          if (data.features && data.features.length > 0) {
            const [longitude, latitude] = data.features[0].center
            jobsWithCoords.push({ ...job, latitude, longitude })
          }
        } catch (error) {
          console.error(`Geocoding error for job ${job.id}:`, error)
        }
      }
      setGeocodedJobs(jobsWithCoords)
    }
    setMapLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        fetchProfileData(data.user.id)
        fetchJobs(data.user.id)
      }
    }
    checkUser()
  }, [router, supabase, fetchProfileData])

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
                    <Link href="/profile" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Profile
                    </Link>
                    <Link href="/settings" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Settings
                    </Link>
                    <button
                      onClick={() => {
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
                    <Link href="/profile" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Profile
                    </Link>
                    <Link href="/settings" onClick={() => setShowAccountDropdown(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Settings
                    </Link>
                    <button
                      onClick={() => {
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
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
              </h2>
              <p className="text-slate-600">{user.email}</p>
            </div>

            {/* Dashboard Map Overview */}
            <div className="mb-8">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Job Locations Overview
                  </h3>
                  <span className="text-xs text-slate-500">
                    Displaying {geocodedJobs.length} locations
                  </span>
                </div>
                <div className="h-[400px] relative">
                  {mapLoading ? (
                    <div className="absolute inset-0 bg-slate-50 flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-primary-red border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-slate-500">Loading map data...</span>
                      </div>
                    </div>
                  ) : geocodedJobs.length > 0 ? (
                    <Map
                      initialViewState={{
                        latitude: geocodedJobs[0].latitude,
                        longitude: geocodedJobs[0].longitude,
                        zoom: 9
                      }}
                      style={{ width: '100%', height: '100%' }}
                      mapStyle="mapbox://styles/mapbox/streets-v11"
                      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
                    >
                      {geocodedJobs.map((job) => (
                        <Marker
                          key={job.id}
                          latitude={job.latitude}
                          longitude={job.longitude}
                          anchor="bottom"
                          onClick={(e) => {
                            e.originalEvent.stopPropagation()
                            setSelectedJob(job)
                          }}
                        >
                          <button className="transform transition hover:scale-110 active:scale-95">
                            <div className="w-8 h-8 bg-primary-red rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </button>
                        </Marker>
                      ))}
                    </Map>
                  ) : (
                    <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
                      <p className="text-slate-500">No job locations found to display on map.</p>
                    </div>
                  )}
                </div>
              </div>
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

              {isSuperUser && (
                <Link href="/admin/marketsharp">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">MarketSharp</h3>
                        <p className="text-slate-600 text-sm">CRM sync & customer data</p>
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

      {/* Job Info Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-32 bg-gradient-to-r from-primary-red to-red-600 p-6">
              <button
                onClick={() => setSelectedJob(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">Job Details</h3>
                  <p className="text-white/80 text-sm">Site Information</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Job Name</label>
                  <p className="text-lg font-bold text-slate-900 leading-tight">{selectedJob.job_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Customer</label>
                    <p className="text-sm font-medium text-slate-700">{selectedJob.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                    <p className="text-sm font-medium text-slate-700">{selectedJob.category || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${['installed', 'completed', 'closed'].includes(selectedJob.status?.toLowerCase() || '')
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                    }`}>
                    {selectedJob.status || 'No Status'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Address</label>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedJob.address}</p>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href={`/jobs/${selectedJob.id}`}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition shadow-lg shadow-slate-200"
                >
                  View Full Details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
