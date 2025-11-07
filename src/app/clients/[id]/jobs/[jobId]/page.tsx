'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

type Job = {
  id: number
  description: string
  installation_info: string
  client_id: number
}

type JobPhoto = {
  id: number
  image_url: string
  caption?: string
  photo_type?: string
  created_at?: string
  latitude?: number
  longitude?: number
  location_accuracy?: number
}

export default function JobDetailPage() {
  const [user, setUser] = useState<User | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [photoType, setPhotoType] = useState<string>('progress')
  const [caption, setCaption] = useState('')
  const [showCaptionForm, setShowCaptionForm] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const { id: clientId, jobId } = params
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredPhotos = filterType === 'all' 
    ? photos 
    : photos.filter(photo => photo.photo_type === filterType)

  const fetchJob = useCallback(async () => {
    if (!jobId) return
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    if (error) {
      console.error(error)
    } else {
      setJob(data)
    }
  }, [supabase, jobId])

  const fetchPhotos = useCallback(async () => {
    if (!jobId) return
    const { data, error } = await supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
    if (error) {
      console.error(error)
    } else {
      setPhotos(data)
    }
  }, [supabase, jobId])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        fetchJob()
        fetchPhotos()
      }
    }
    checkUser()
  }, [router, supabase, fetchJob, fetchPhotos])

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user || !job) {
      return
    }

    setUploading(true)
    const file = event.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${job.id}/${Date.now()}.${fileExt}`
    
    // Get geolocation
    let latitude: number | null = null
    let longitude: number | null = null
    let accuracy: number | null = null

    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          })
        })
        latitude = position.coords.latitude
        longitude = position.coords.longitude
        accuracy = position.coords.accuracy
      }
    } catch (error) {
      console.log('Location not available:', error)
      // Continue without location
    }

    const { error: uploadError } = await supabase.storage
      .from('job_photos')
      .upload(fileName, file)

    if (uploadError) {
      console.error(uploadError)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('job_photos').getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('job_photos').insert({
      job_id: job.id,
      image_url: publicUrl,
      user_id: user.id,
      photo_type: photoType,
      caption: caption || null,
      latitude: latitude,
      longitude: longitude,
      location_accuracy: accuracy,
    })

    if (insertError) {
      console.error(insertError)
    } else {
      fetchPhotos()
      setCaption('')
      setShowCaptionForm(false)
    }
    setUploading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user || !job) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href={`/clients/${clientId}`}>
                <button className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition">
                  <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{job.description}</h1>
                <p className="text-sm text-slate-600">Job Details</p>
              </div>
            </div>
            <button
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Job Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Installation Information</h2>
          <p className="text-slate-600">{job.installation_info || 'No additional information provided'}</p>
        </div>

        {/* Photos Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
              <p className="text-slate-600 text-sm mt-1">{photos.length} photos uploaded</p>
            </div>
            <button
              onClick={() => setShowCaptionForm(!showCaptionForm)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Add Photo</span>
            </button>
          </div>

          {/* Photo Upload Form */}
          {showCaptionForm && (
            <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Photo Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Photo Type
                  </label>
                  <select
                    value={photoType}
                    onChange={(e) => setPhotoType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="before">Before</option>
                    <option value="after">After</option>
                    <option value="progress">Progress</option>
                    <option value="issue">Issue</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Caption (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Add a description..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Take Photo'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCaptionForm(false)
                      setCaption('')
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
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
                    className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <Image 
                      src={photo.image_url} 
                      alt={photo.caption || "Job site"} 
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
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
                      {photo.latitude && photo.longitude && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          GPS
                        </span>
                      )}
                    </div>
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
              <h3 className="text-lg font-medium text-slate-900 mb-2">No photos yet</h3>
              <p className="text-slate-600 mb-4">Start documenting this job site</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
              >
                Take Your First Photo
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
