'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

type RawJobPhoto = {
  id: number
  user_id: string
  image_url: string
  caption?: string
  photo_type?: string
  created_at?: string
  latitude?: number
  longitude?: number
  job_id: number
  jobs?: { job_name: string }
  profiles?: { avatar_url?: string }
}

type JobPhoto = RawJobPhoto & {
  job_name?: string
  uploader_avatar?: string
}

export default function GalleryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [userRoles, setUserRoles] = useState<string[]>([])

  const router = useRouter()
  const supabase = createClient()

  const filteredPhotos = filterType === 'all'
    ? photos
    : photos.filter(photo => photo.photo_type === filterType)

  const fetchAllPhotos = useCallback(async () => {
    if (!user) return

    // Fetch all photos from accessible jobs (RLS policy handles access control)
    const { data: photosData, error: photosError } = await supabase
      .from('job_photos')
      .select(`
        *,
        jobs(job_name)
      `)
      .order('created_at', { ascending: false })

    if (photosError) {
      console.error('Error fetching photos:', photosError)
      return
    }

    // Fetch uploader profiles separately
    const photosWithProfiles = await Promise.all(
      (photosData || []).map(async (photo: RawJobPhoto & { jobs?: { job_name: string } }) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', photo.user_id)
          .single()

        return {
          ...photo,
          job_name: photo.jobs?.job_name,
          uploader_avatar: profileData?.avatar_url
        }
      })
    )

    setPhotos(photosWithProfiles)
  }, [supabase, user])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }

      setUser(data.user)

      // Get user roles
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', data.user.id)
      
      const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
      setUserRoles(roles)

      await fetchAllPhotos()
      setLoading(false)
    }

    checkUser()
  }, [router, supabase, fetchAllPhotos])

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading gallery...</p>
        </div>
      </div>
    )
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
                <button className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition">
                  <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Photo Gallery</h1>
                <p className="text-slate-600 text-sm">
                  {userRoles.includes('brand_ambassador') || userRoles.includes('super_admin')
                    ? 'All photos from every job'
                    : 'All photos from your accessible jobs'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-500">
                {photos.length} total photos
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filterType === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({photos.length})
            </button>
            {['before', 'after', 'progress', 'issue', 'completed'].map(type => {
              const count = photos.filter(p => p.photo_type === type).length
              if (count === 0) return null
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg font-semibold transition capitalize ${
                    filterType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {type} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Photos Grid */}
        {filteredPhotos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredPhotos.map((photo) => (
              <div key={photo.id} className="relative group cursor-pointer" onClick={() => {
                setSelectedPhoto(photo)
                setShowPhotoModal(true)
              }}>
                <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 hover:shadow-lg transition-shadow">
                  <Image
                    src={photo.image_url}
                    alt={photo.caption || "Job site"}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                    unoptimized
                    onError={(e) => {
                      console.error('Image failed to load:', photo.image_url)
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EError%3C/text%3E%3C/svg%3E'
                    }}
                  />
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {photo.photo_type && (
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        photo.photo_type === 'before' ? 'bg-blue-500 text-white' :
                        photo.photo_type === 'after' ? 'bg-green-500 text-white' :
                        photo.photo_type === 'issue' ? 'bg-red-500 text-white' :
                        photo.photo_type === 'completed' ? 'bg-purple-500 text-white' :
                        'bg-slate-500 text-white'
                      }`}>
                        {photo.photo_type}
                      </span>
                    )}
                    {photo.job_name && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-500 text-white">
                        {photo.job_name}
                      </span>
                    )}
                  </div>
                  {photo.uploader_avatar && (
                    <div className="absolute bottom-2 left-2">
                      <Image
                        src={photo.uploader_avatar}
                        alt="Uploader avatar"
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                        unoptimized
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"%3E%3C/path%3E%3Ccircle cx="12" cy="7" r="4"%3E%3C/circle%3E%3C/svg%3E'
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  {photo.caption && (
                    <p className="text-sm text-slate-600 line-clamp-2">{photo.caption}</p>
                  )}
                  {photo.latitude && photo.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      View on map
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No photos found</h3>
            <p className="text-slate-600 mb-4">Photos will appear here once jobs are created and documented</p>
          </div>
        )}
      </main>

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowPhotoModal(false)}>
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Navigation buttons */}
            {(() => {
              const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id)
              const hasPrev = currentIndex > 0
              const hasNext = currentIndex < filteredPhotos.length - 1

              return (
                <>
                  {hasPrev && (
                    <button
                      onClick={() => setSelectedPhoto(filteredPhotos[currentIndex - 1])}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {hasNext && (
                    <button
                      onClick={() => setSelectedPhoto(filteredPhotos[currentIndex + 1])}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )
            })()}

            {/* Image */}
            <div className="relative w-full h-auto max-h-[80vh]">
              <Image
                src={selectedPhoto.image_url}
                alt={selectedPhoto.caption || "Job site"}
                width={1200}
                height={1200}
                className="w-full h-auto object-contain"
                unoptimized
                onError={(e) => {
                  console.error('Image failed to load:', selectedPhoto.image_url)
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="24"%3EError%3C/text%3E%3C/svg%3E'
                }}
              />
            </div>

            {/* Photo info */}
            <div className="p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {selectedPhoto.photo_type && (
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      selectedPhoto.photo_type === 'before' ? 'bg-blue-500 text-white' :
                      selectedPhoto.photo_type === 'after' ? 'bg-green-500 text-white' :
                      selectedPhoto.photo_type === 'issue' ? 'bg-red-500 text-white' :
                      selectedPhoto.photo_type === 'completed' ? 'bg-purple-500 text-white' :
                      'bg-slate-500 text-white'
                    }`}>
                      {selectedPhoto.photo_type}
                    </span>
                  )}
                  {selectedPhoto.job_name && (
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-indigo-500 text-white">
                      {selectedPhoto.job_name}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {(() => {
                    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPhoto.id)
                    return `${currentIndex + 1} of ${filteredPhotos.length}`
                  })()}
                </div>
              </div>

              {selectedPhoto.caption && (
                <p className="text-slate-700 mb-4">{selectedPhoto.caption}</p>
              )}

              {selectedPhoto.latitude && selectedPhoto.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${selectedPhoto.latitude},${selectedPhoto.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  View on Map
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}