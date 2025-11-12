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
  job_name: string
  installation_info: string
  address: string
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
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)
  
  // Edit mode states
  const [editingJobName, setEditingJobName] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [editJobName, setEditJobName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const jobId = params.id
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
      console.error('Error fetching photos:', error)
    } else {
      console.log('Fetched photos:', data)
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
        
        // Get profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', data.user.id)
          .maybeSingle()
        
        if (profileData) {
          setProfile(profileData)
        }
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
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${user.id}/${job.id}/${Date.now()}.${fileExt}`

    // Mobile-optimized image processing for fastest uploads
    const resizeImage = async (file: File) => {
      try {
        // For mobile, be more aggressive with size reduction
        const isMobile = window.innerWidth < 768
        const targetWidth = isMobile ? 800 : 1200
        const targetQuality = isMobile ? 0.5 : 0.6
        
        // Skip resize only for very small images
        if (file.size < 200000) { // 200KB threshold for mobile
          return file
        }

        // Use OffscreenCanvas for better mobile performance if available
        const useOffscreen = typeof OffscreenCanvas !== 'undefined' && isMobile
        
        if (useOffscreen) {
          const imageBitmap = await createImageBitmap(file)
          const ratio = Math.min(1, targetWidth / imageBitmap.width)
          const width = Math.round(imageBitmap.width * ratio)
          const height = Math.round(imageBitmap.height * ratio)

          const offscreenCanvas = new OffscreenCanvas(width, height)
          const ctx = offscreenCanvas.getContext('2d')!
          ctx.drawImage(imageBitmap, 0, 0, width, height)
          
          return await offscreenCanvas.convertToBlob({
            type: 'image/jpeg',
            quality: targetQuality
          })
        } else {
          // Fallback to regular canvas
          const imageBitmap = await createImageBitmap(file)
          const ratio = Math.min(1, targetWidth / imageBitmap.width)
          const width = Math.round(imageBitmap.width * ratio)
          const height = Math.round(imageBitmap.height * ratio)

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          
          // Optimize for speed on mobile
          ctx.imageSmoothingEnabled = !isMobile // Disable smoothing on mobile for speed
          if (ctx.imageSmoothingEnabled) {
            ctx.imageSmoothingQuality = 'low' // Use low quality for speed
          }
          ctx.drawImage(imageBitmap, 0, 0, width, height)

          return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', targetQuality)
          })
        }
      } catch (err) {
        console.error('Resize failed, falling back to original file', err)
        return file
      }
    }

    // Create optimistic placeholder immediately
    const tempId = Date.now()
    const tempPhoto: JobPhoto = {
      id: tempId,
      image_url: URL.createObjectURL(file),
      photo_type: photoType,
      caption: caption || undefined,
      created_at: new Date().toISOString()
    }
    
    // Add optimistic photo immediately for instant feedback
    setPhotos(prev => [tempPhoto, ...prev])
    
    // Get geolocation - skip on mobile for faster uploads
    const getLocation = async () => {
      const isMobile = window.innerWidth < 768
      
      // Skip geolocation on mobile to speed up uploads
      if (isMobile || !navigator.geolocation) return {}
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, // Use low accuracy for speed
            timeout: 2000, // Very short timeout
            maximumAge: 300000 // Allow 5min old location
          })
        })
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }
      } catch (error) {
        console.log('Location not available:', error)
        return {}
      }
    }

    try {
      const isMobile = window.innerWidth < 768
      
      // On mobile, process image synchronously to avoid memory issues
      if (isMobile) {
        const resizedBlob = await resizeImage(file)
        const location = {} // Skip location on mobile for speed
        
        // Convert blob to File if needed
        const finalFile = resizedBlob instanceof Blob && !(resizedBlob instanceof File)
          ? new File([resizedBlob], `${Date.now()}.${fileExt}`, { type: resizedBlob.type })
          : resizedBlob as File

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('job_photos')
          .upload(fileName, finalFile)

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage.from('job_photos').getPublicUrl(fileName)

        // Insert to database
        const { error: insertError } = await supabase.from('job_photos').insert({
          job_id: job.id,
          image_url: publicUrl,
          user_id: user.id,
          photo_type: photoType,
          caption: caption || null,
          ...location
        })

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`)
        }
      } else {
        // Desktop: Run resize and location in parallel
        const [uploadBlob, location] = await Promise.all([
          resizeImage(file),
          getLocation()
        ])

        // Convert blob to File if needed
        const finalFile = uploadBlob instanceof Blob && !(uploadBlob instanceof File)
          ? new File([uploadBlob], `${Date.now()}.${fileExt}`, { type: uploadBlob.type })
          : uploadBlob as File

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('job_photos')
          .upload(fileName, finalFile)

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage.from('job_photos').getPublicUrl(fileName)

        // Insert to database
        const { error: insertError } = await supabase.from('job_photos').insert({
          job_id: job.id,
          image_url: publicUrl,
          user_id: user.id,
          photo_type: photoType,
          caption: caption || null,
          ...location
        })

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`)
        }
      }

      // Replace optimistic photo with real data
      URL.revokeObjectURL(tempPhoto.image_url) // Clean up temp URL
      await fetchPhotos() // Refresh with real data
      
      setCaption('')
      setShowCaptionForm(false)
      
    } catch (error) {
      console.error('Upload error:', error)
      // Remove optimistic photo on failure
      setPhotos(prev => prev.filter(p => p.id !== tempId))
      URL.revokeObjectURL(tempPhoto.image_url)
      alert(`Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    setUploading(false)
  }

  const handleUpdateJobField = async (field: string, value: string) => {
    if (!job || !jobId) return
    
    setSaving(true)
    const { error } = await supabase
      .from('jobs')
      .update({ [field]: value })
      .eq('id', jobId)

    if (error) {
      console.error('Error updating job:', error)
      alert(`Failed to update ${field}`)
    } else {
      // Update local job state
      setJob({ ...job, [field]: value })
      
      // Reset edit states
      if (field === 'job_name') {
        setEditingJobName(false)
        setEditJobName('')
      } else if (field === 'address') {
        setEditingAddress(false)
        setEditAddress('')
      } else if (field === 'installation_info') {
        setEditingNotes(false)
        setEditNotes('')
      }
    }
    setSaving(false)
  }

  const startEditJobName = () => {
    setEditJobName(job?.job_name || '')
    setEditingJobName(true)
  }

  const startEditAddress = () => {
    setEditAddress(job?.address || '')
    setEditingAddress(true)
  }

  const startEditNotes = () => {
    setEditNotes(job?.installation_info || '')
    setEditingNotes(true)
  }

  const cancelEdit = (type: string) => {
    if (type === 'job_name') {
      setEditingJobName(false)
      setEditJobName('')
    } else if (type === 'address') {
      setEditingAddress(false)
      setEditAddress('')
    } else if (type === 'notes') {
      setEditingNotes(false)
      setEditNotes('')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteJob = async () => {
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
    } else {
      router.push('/jobs')
    }
  }

  const handleDeletePhoto = async (photoId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this photo?')) {
      return
    }

    const { error } = await supabase
      .from('job_photos')
      .delete()
      .eq('id', photoId)

    if (error) {
      console.error(error)
      alert('Failed to delete photo')
    } else {
      fetchPhotos()
    }
  }

  if (!user || !job) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Mobile Layout */}
          <div className="md:hidden">
            {/* Top row with navigation and user actions */}
            <div className="flex items-center justify-between mb-3">
              <Link href="/jobs">
                <button className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition">
                  <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/profile" className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1 transition">
                  {profile?.avatar_url ? (
                    <Image 
                      src={profile.avatar_url} 
                      alt="Profile" 
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {profile?.full_name || user?.email?.split('@')[0] || 'Profile'}
                  </span>
                </Link>
                <button
                  onClick={handleDeleteJob}
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                  title="Delete Job"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Bottom row with job info */}
            <div className="text-center">
              {editingJobName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editJobName}
                    onChange={(e) => setEditJobName(e.target.value)}
                    className="w-full text-lg font-bold text-center border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={saving}
                    autoFocus
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleUpdateJobField('job_name', editJobName)}
                      disabled={saving || !editJobName.trim()}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => cancelEdit('job_name')}
                      disabled={saving}
                      className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900">{job.job_name}</h1>
                  <button
                    onClick={startEditJobName}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                    title="Edit job name"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
              {job.address && !editingAddress && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <p className="text-sm text-slate-600">{job.address}</p>
                  <button
                    onClick={startEditAddress}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                    title="Edit address"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
              {editingAddress && (
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Enter address"
                    className="w-full text-sm text-center border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={saving}
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleUpdateJobField('address', editAddress)}
                      disabled={saving}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => cancelEdit('address')}
                      disabled={saving}
                      className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {!job.address && !editingAddress && (
                <button
                  onClick={startEditAddress}
                  className="text-sm text-slate-400 hover:text-slate-600 transition flex items-center justify-center gap-1 mt-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add address
                </button>
              )}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/jobs">
                <button className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition">
                  <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div>
                {editingJobName ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editJobName}
                      onChange={(e) => setEditJobName(e.target.value)}
                      className="text-xl font-bold border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      disabled={saving}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateJobField('job_name', editJobName)}
                        disabled={saving || !editJobName.trim()}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => cancelEdit('job_name')}
                        disabled={saving}
                        className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">{job.job_name}</h1>
                    <button
                      onClick={startEditJobName}
                      className="p-1 text-slate-400 hover:text-slate-600 transition"
                      title="Edit job name"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
                {job.address && !editingAddress && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-600">{job.address}</p>
                    <button
                      onClick={startEditAddress}
                      className="p-1 text-slate-400 hover:text-slate-600 transition"
                      title="Edit address"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
                {editingAddress && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Enter address"
                      className="text-sm border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      disabled={saving}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateJobField('address', editAddress)}
                        disabled={saving}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => cancelEdit('address')}
                        disabled={saving}
                        className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {!job.address && !editingAddress && (
                  <button
                    onClick={startEditAddress}
                    className="text-sm text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add address
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-3 py-2 transition">
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
                onClick={handleDeleteJob}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete Job</span>
              </button>
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
        {/* Photos Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
              <p className="text-slate-600 text-sm mt-1">{photos.length} photos uploaded</p>
              {photos.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">Debug: {filteredPhotos.length} shown after filter</p>
              )}
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
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Take Photo
                      </>
                    )}
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
                <div key={photo.id} className="relative group cursor-pointer" onClick={() => {
                  console.log('Photo clicked:', photo.id)
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
                      {photo.latitude && photo.longitude && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          GPS
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeletePhoto(photo.id, e)
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                      title="Delete photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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

        {/* Notes Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
            {!editingNotes && job.installation_info && (
              <button
                onClick={startEditNotes}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
                title="Edit notes"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>
          
          {editingNotes ? (
            <div className="space-y-3">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add installation notes, important details, or any other relevant information..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={4}
                disabled={saving}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateJobField('installation_info', editNotes)}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Notes'}
                </button>
                <button
                  onClick={() => cancelEdit('notes')}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : job.installation_info ? (
            <div className="prose prose-slate max-w-none">
              <p className="text-slate-600 whitespace-pre-wrap">{job.installation_info}</p>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <p className="text-slate-600 mb-3">No notes added yet</p>
              <button
                onClick={startEditNotes}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
              >
                Add Notes
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto ? (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => {
          console.log('Modal background clicked')
          setShowPhotoModal(false)
        }}>
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden" onClick={(e) => {
            console.log('Modal content clicked')
            e.stopPropagation()
          }}>
            {/* Debug info */}
            <div className="absolute top-0 left-0 bg-red-500 text-white p-2 text-xs z-20">
              Modal Open - Photo ID: {selectedPhoto.id}
            </div>
            <button
              onClick={() => {
                console.log('Close button clicked')
                setShowPhotoModal(false)
              }}
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
                  {selectedPhoto.latitude && selectedPhoto.longitude && (
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-orange-500 text-white flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      GPS
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
      ) : null}

    </div>
  )
}
