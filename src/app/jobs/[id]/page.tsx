'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

import Link from 'next/link'
import Image from 'next/image'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'


// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

type NoteWithoutProfiles = {
  id: string
  user_id: string
  content: string
  created_at: string
}

type Note = NoteWithoutProfiles & {
  profiles?: { full_name?: string | null; avatar_url?: string | null }
}

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  is_super_user?: boolean
}

function JobNotesSection({ jobId, user, jobOwnerId }: { jobId: string, user: User | null, jobOwnerId?: string }) {
  const supabase = createClient()
  const [notes, setNotes] = useState<Note[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSuperUser, setIsSuperUser] = useState(false)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)

  // Fetch notes for this job
  const fetchNotes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .select('id, user_id, content, created_at')
      .eq('job_id', parseInt(jobId as string))
      .is('photo_id', null)
      .order('created_at', { ascending: false })
    if (!error && data) {
      // Fetch profile data separately for each note
      const notesWithProfiles = await Promise.all(
        data.map(async (note: NoteWithoutProfiles) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', note.user_id)
            .maybeSingle()
          return {
            ...note,
            profiles: profile
          }
        })
      )
      setNotes(notesWithProfiles)
    }
    setLoading(false)
  }, [supabase, jobId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Fetch user profile and roles
  useEffect(() => {
    if (!user) return
    const fetchProfileAndRoles = async () => {
      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      setProfile(profileData)

      // Get user roles
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)
      
      const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
      setUserRoles(roles)
      setIsSuperUser(roles.includes('super_admin'))

      // Get project-specific roles for this job
      // Note: Project-specific roles have been simplified to use only global roles
    }
    fetchProfileAndRoles()
  }, [user, supabase, jobId])

  // Add note
  const handleAddNote = async () => {
    if (!noteContent.trim() || !user) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('notes').insert({
        job_id: parseInt(jobId as string),
        user_id: user.id,
        content: noteContent,
        photo_id: null
      })
      
      if (error) {
        console.error('Error adding comment:', error)
        alert(`Failed to add comment: ${error.message}`)
      } else {
        console.log('Comment added successfully:', data)
        setNoteContent('')
        await fetchNotes()
      }
    } catch (error) {
      console.error('Unexpected error adding comment:', error)
      alert('An unexpected error occurred while adding the comment')
    } finally {
      setLoading(false)
    }
  }

  // Edit note
  const handleEditNote = async (id: string) => {
    if (!editingContent.trim()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('notes').update({ content: editingContent }).eq('id', id)
      
      if (error) {
        console.error('Error editing comment:', error)
        alert(`Failed to edit comment: ${error.message}`)
      } else {
        console.log('Comment edited successfully:', data)
        setEditingId(null)
        setEditingContent('')
        await fetchNotes()
      }
    } catch (error) {
      console.error('Unexpected error editing comment:', error)
      alert('An unexpected error occurred while editing the comment')
    } finally {
      setLoading(false)
    }
  }  // Format time ago
  function formatTimeAgo(dateString: string) {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }

  // Check if user can comment (job owner, super admin, brand ambassador, or assigned users)
  const canComment = isSuperUser || 
    (user && jobOwnerId && user.id === jobOwnerId) || 
    userRoles.includes('brand_ambassador') ||
    userRoles.some(role => ['rep', 'measure_tech', 'installer'].includes(role))

  return (
    <div>
      <div className="space-y-5 mb-4">
        {notes.length > 0 ? (
          notes.map(note => (
            <div key={note.id} className="flex items-start gap-3">
              {note.profiles?.avatar_url ? (
                <Image src={note.profiles.avatar_url} alt="avatar" width={40} height={40} className="rounded-full w-10 h-10 object-cover" />
              ) : (
                <div className="w-10 h-10 bg-primary-red rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <div className="font-bold text-slate-900 leading-tight">{note.profiles?.full_name || 'User'}</div>
                {editingId === note.id ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-red"
                    />
                    <button
                      className="px-3 py-2 bg-primary-red text-white rounded-lg font-semibold text-sm hover:bg-primary-red-dark transition"
                      onClick={() => handleEditNote(note.id)}
                      disabled={loading || !editingContent.trim()}
                    >Save</button>
                    <button
                      className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-300 transition"
                      onClick={() => { setEditingId(null); setEditingContent('') }}
                    >Cancel</button>
                  </div>
                ) : (
                  <div className="text-slate-800 mb-1 whitespace-pre-line">{note.content}</div>
                )}
                <div className="text-xs text-slate-500">{formatTimeAgo(note.created_at)}</div>
              </div>
              {(isSuperUser || note.user_id === user?.id) && editingId !== note.id && (
                <button
                  className="ml-2 text-slate-400 hover:text-primary-red"
                  title="Edit note"
                  onClick={() => { setEditingId(note.id); setEditingContent(note.content) }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="text-slate-500 text-sm">No comments yet.</div>
        )}
      </div>
      
      {/* Comment form - only show for authorized users */}
      {canComment ? (
        <form className="flex items-center gap-2 pt-2 border-t border-slate-100" onSubmit={e => { e.preventDefault(); handleAddNote() }}>
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="avatar" width={40} height={40} className="rounded-full w-10 h-10 object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 bg-primary-red rounded-full flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <input
            type="text"
            className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-red"
            placeholder="Add a comment"
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="px-3 py-2 bg-primary-red text-white rounded-lg font-semibold text-sm hover:bg-primary-red-dark transition disabled:opacity-50 shrink-0"
            disabled={loading || !noteContent.trim()}
          >Post</button>
        </form>
      ) : (
        <div className="pt-4 border-t border-slate-100">
          <div className="text-center py-4">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Only super users and the job owner can add comments</p>
          </div>
        </div>
      )}
    </div>
  )
}

type Job = {
  id: number
  job_name: string
  installation_info: string
  address: string
  category: string
  user_id?: string
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

type JobDocument = {
  id: number
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  created_at: string
  uploader_name?: string
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
  const [editingAssignments, setEditingAssignments] = useState(false)
  const [editingCategory, setEditingCategory] = useState(false)
  const [editJobName, setEditJobName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<string[]>([])
  const [editCategory, setEditCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string }[]>([])
  const [assignedUsers, setAssignedUsers] = useState<{ id: string; full_name: string | null; avatar_url: string | null; role: string }[]>([])
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [userRoles, setUserRoles] = useState<{ name: string }[]>([])
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [geocodingLoading, setGeocodingLoading] = useState(false)
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<JobDocument | null>(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [documentFileInputRef, setDocumentFileInputRef] = useState<HTMLInputElement | null>(null)
  
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const jobId = params.id
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Geocode address to coordinates
  const geocodeAddress = async (address: string) => {
    if (!address || !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return
    
    setGeocodingLoading(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}&limit=1`
      )
      const data = await response.json()
      
      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center
        setCoordinates({ latitude, longitude })
      }
    } catch (error) {
      console.error('Geocoding error:', error)
    } finally {
      setGeocodingLoading(false)
    }
  }

  const filteredPhotos = filterType === 'all' 
    ? photos 
    : photos.filter(photo => photo.photo_type === filterType)

  const fetchJob = useCallback(async () => {
    if (!jobId) return
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', parseInt(jobId as string))
      .single()
    if (error) {
      console.error(error)
    } else {
      setJob(data)
      // Geocode the address if available
      if (data.address) {
        geocodeAddress(data.address)
      }
    }
  }, [supabase, jobId])

  const fetchPhotos = useCallback(async () => {
    if (!jobId) return
    const { data, error } = await supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', parseInt(jobId as string))
    if (error) {
      console.error('Error fetching photos:', error)
    } else {
      console.log('Fetched photos:', data)
      setPhotos(data)
    }
  }, [supabase, jobId])

  const fetchDocuments = useCallback(async () => {
    if (!jobId) return
    const { data, error } = await supabase
      .from('job_documents')
      .select('*')
      .eq('job_id', parseInt(jobId as string))
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error fetching documents:', error)
    } else {
      // Fetch uploader names separately
      const documentsWithNames = await Promise.all(
        data.map(async (doc: JobDocument) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', doc.uploaded_by)
            .maybeSingle()
          return {
            ...doc,
            uploader_name: profile?.full_name || 'Unknown User'
          }
        })
      )
      setDocuments(documentsWithNames)
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
        fetchDocuments()
        
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
          
          const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles).filter(Boolean) || []
          setUserRoles(roles)

          // Get project-specific roles for this job
          // Note: Project-specific roles have been simplified to use only global roles

          // If super user or has appropriate roles, fetch all users for assignment
          if (profileData.is_super_user || roles.some(role => role.name === 'super_admin')) {
            const { data: usersData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .order('full_name')
            if (usersData) {
              setUsers(usersData.map((profile: Profile) => ({
                id: profile.id,
                full_name: profile.full_name,
                email: '' // Email not accessible client-side
              })))
            }
          }
        }
      }
    }
    checkUser()
  }, [router, supabase, fetchJob, fetchPhotos, fetchDocuments, jobId])

  // Fetch assigned users with their roles
  useEffect(() => {
    if (jobId && userRoles.some(role => role.name === 'super_admin')) {
      const fetchAssignedUsers = async () => {
        const { data } = await supabase
          .from('job_assignments')
          .select('user_id')
          .eq('job_id', parseInt(jobId as string))
        
        if (data) {
          // Fetch profiles and roles for each assigned user
          const assignedUsersData = await Promise.all(
            data.map(async (assignment: { user_id: string }) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', assignment.user_id)
                .maybeSingle()
              
              // Get user roles
              const { data: userRolesData } = await supabase
                .from('user_roles')
                .select('roles(name)')
                .eq('user_id', assignment.user_id)
              
              const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
              
              return {
                id: assignment.user_id,
                full_name: profile?.full_name || null,
                avatar_url: profile?.avatar_url || null,
                role: roles.length > 0 ? roles[0] : 'user' // Take first role for display
              }
            })
          )
          setAssignedUsers(assignedUsersData)
        }
      }
      fetchAssignedUsers()
    }
  }, [jobId, userRoles, supabase])

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
    }

    if (showAccountDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAccountDropdown])

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
    
    // Get geolocation - optimized for both mobile and desktop
    const getLocation = async () => {
      const isMobile = window.innerWidth < 768
      
      // Skip geolocation if not available
      if (!navigator.geolocation) return {}
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: !isMobile, // Use high accuracy on desktop, low on mobile
            timeout: isMobile ? 3000 : 2000, // Shorter timeout on mobile
            maximumAge: 300000 // Allow 5min old location
          })
        })
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
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
        const location = await getLocation() // Enable location on mobile too
        
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

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user || !job) {
      return
    }

    setUploadingDocument(true)
    const file = event.target.files[0]
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const fileName = `${user.id}/${job.id}/${Date.now()}.${fileExt}`

    try {
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('job_documents')
        .upload(fileName, file)

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      const { data: { publicUrl } } = supabase.storage.from('job_documents').getPublicUrl(fileName)

      // Insert to database
      const { error: insertError } = await supabase.from('job_documents').insert({
        job_id: job.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id
      })

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`)
      }

      // Refresh documents
      await fetchDocuments()

    } catch (error) {
      console.error('Document upload error:', error)
      alert(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    setUploadingDocument(false)
  }

  const handleDeleteDocument = async (documentId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    const { error } = await supabase
      .from('job_documents')
      .delete()
      .eq('id', documentId)

    if (error) {
      console.error(error)
      alert('Failed to delete document')
    } else {
      fetchDocuments()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleUpdateJobField = async (field: string, value: string) => {
    if (!job || !jobId) return
    
    setSaving(true)
    const { error } = await supabase
      .from('jobs')
      .update({ [field]: value })
      .eq('id', parseInt(jobId as string))

    if (error) {
      console.error('Error updating job:', error)
      alert(`Failed to update ${field}`)
    } else {
      // Update local job state
      setJob({ ...job, [field]: value })
      
      // If updating address, geocode it
      if (field === 'address' && value) {
        geocodeAddress(value)
      }
      
      // If updating assignment, refresh the assigned users
      if (field === 'assignments') {
        // Refresh assigned users after update
        const { data } = await supabase
          .from('job_assignments')
          .select('user_id')
          .eq('job_id', parseInt(jobId as string))
        
        if (data) {
          // Fetch profiles for each assigned user
          const assignedUsersData = await Promise.all(
            data.map(async (assignment: { user_id: string }) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', assignment.user_id)
                .maybeSingle()
              
              return {
                id: assignment.user_id,
                full_name: profile?.full_name || null,
                avatar_url: profile?.avatar_url || null
              }
            })
          )
          setAssignedUsers(assignedUsersData)
        }
      }
      
      // Reset edit states
      if (field === 'job_name') {
        setEditingJobName(false)
        setEditJobName('')
      } else if (field === 'address') {
        setEditingAddress(false)
        setEditAddress('')
      } else if (field === 'assignments') {
        setEditingAssignments(false)
        setEditAssignedUserIds([])
      } else if (field === 'category') {
        setEditingCategory(false)
        setEditCategory('')
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

  const startEditAssignment = () => {
    setEditAssignedUserIds(assignedUsers.map(user => user.id))
    setEditingAssignments(true)
  }

  const startEditCategory = () => {
    setEditCategory(job?.category || '')
    setEditingCategory(true)
  }

  const cancelEdit = (type: string) => {
    if (type === 'job_name') {
      setEditingJobName(false)
      setEditJobName('')
    } else if (type === 'address') {
      setEditingAddress(false)
      setEditAddress('')
    } else if (type === 'assignment') {
      setEditingAssignments(false)
      setEditAssignedUserIds([])
    } else if (type === 'category') {
      setEditingCategory(false)
      setEditCategory('')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleDeleteJob = async () => {
    if (!confirm('Are you sure you want to delete this job? This will also delete all associated photos.')) {
      return
    }

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', parseInt(jobId as string))

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
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray">
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
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1 transition"
                  >
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
                      <div className="w-7 h-7 bg-primary-red-light rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <Link href="/profile" onClick={() => setShowAccountDropdown(false)}>
                        <div className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Profile
                        </div>
                      </Link>
                      <Link href="/settings" onClick={() => setShowAccountDropdown(false)}>
                        <div className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Settings
                        </div>
                      </Link>
                      <button
                        onClick={() => {
                          setShowAccountDropdown(false)
                          handleSignOut()
                        }}
                        className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
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
                    className="w-full text-lg font-bold text-center border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                    disabled={saving}
                    autoFocus
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleUpdateJobField('job_name', editJobName)}
                      disabled={saving || !editJobName.trim()}
                      className="px-3 py-1 text-sm bg-primary-red text-white rounded-lg hover:bg-primary-red-dark disabled:opacity-50"
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
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900">{job.job_name}</h1>
                    {(userRoles.some(role => role.name === 'super_admin')) && (
                      <button
                        onClick={startEditJobName}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Edit job name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {editingCategory ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                          disabled={saving}
                        >
                          <option value="Windows">Windows</option>
                          <option value="Bathrooms">Bathrooms</option>
                          <option value="Siding">Siding</option>
                          <option value="Doors">Doors</option>
                        </select>
                        <button
                          onClick={() => handleUpdateJobField('category', editCategory)}
                          disabled={saving || !editCategory.trim()}
                          className="px-2 py-1 text-xs bg-primary-red text-white rounded hover:bg-primary-red-dark disabled:opacity-50"
                        >
                          {saving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => cancelEdit('category')}
                          disabled={saving}
                          className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {job.category && (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            job.category === 'Windows' ? 'bg-blue-500 text-white' :
                            job.category === 'Bathrooms' ? 'bg-green-500 text-white' :
                            job.category === 'Siding' ? 'bg-yellow-500 text-white' :
                            job.category === 'Doors' ? 'bg-purple-500 text-white' :
                            'bg-slate-500 text-white'
                          }`}>
                            {job.category}
                          </span>
                        )}
                        {(userRoles.some(role => role.name === 'super_admin')) && (
                          <button
                            onClick={startEditCategory}
                            className="p-1 text-slate-400 hover:text-slate-600 transition"
                            title="Edit category"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {job.address && !editingAddress && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <p className="text-sm text-slate-600">{job.address}</p>
                  {(userRoles.some(role => role.name === 'super_admin')) && (
                    <button
                      onClick={startEditAddress}
                      className="p-1 text-slate-400 hover:text-slate-600 transition"
                      title="Edit address"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              {editingAddress && (
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Enter address"
                    className="w-full text-sm text-center border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                    disabled={saving}
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleUpdateJobField('address', editAddress)}
                      disabled={saving}
                      className="px-3 py-1 text-sm bg-primary-red text-white rounded-lg hover:bg-primary-red-dark disabled:opacity-50"
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
              {!job.address && !editingAddress && (userRoles.some(role => role.name === 'super_admin')) && (
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
              {/* Assignment Section - Mobile */}
              {(userRoles.some(role => role.name === 'super_admin')) && (
                <div className="mt-2">
                  {editingAssignments ? (
                    <div className="space-y-2">
                      <div className="text-sm text-slate-600 mb-2">Assign users:</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {users.map((user) => (
                          <label key={user.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editAssignedUserIds.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditAssignedUserIds(prev => [...prev, user.id])
                                } else {
                                  setEditAssignedUserIds(prev => prev.filter(id => id !== user.id))
                                }
                              }}
                              className="w-4 h-4 text-primary-red focus:ring-primary-red border-slate-300 rounded"
                              disabled={saving}
                            />
                            <span className="text-sm text-slate-700">{user.full_name || 'Unnamed User'}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={async () => {
                            setSaving(true)
                            try {
                              console.log('Starting assignment update for jobId:', jobId, 'parsed:', parseInt(jobId as string))
                              console.log('Current user roles:', userRoles)
                              
                              // Delete existing assignments
                              console.log('Deleting existing assignments...')
                              const { error: deleteError } = await supabase
                                .from('job_assignments')
                                .delete()
                                .eq('job_id', parseInt(jobId as string))
                              
                              if (deleteError) {
                                console.error('Delete error:', deleteError)
                                alert(`Failed to delete existing assignments: ${deleteError.message}`)
                                setSaving(false)
                                return
                              }
                              
                              console.log('Delete successful, inserting new assignments:', editAssignedUserIds)

                              // Insert new assignments
                              if (editAssignedUserIds.length > 0) {
                                const assignments = editAssignedUserIds.map(userId => ({
                                  job_id: parseInt(jobId as string),
                                  user_id: userId,
                                  assigned_by: user.id
                                }))
                                console.log('Inserting assignments:', assignments)
                                
                                const { error: insertError } = await supabase
                                  .from('job_assignments')
                                  .insert(assignments)
                                
                                if (insertError) {
                                  console.error('Insert error:', insertError)
                                  alert(`Failed to insert new assignments: ${insertError.message}`)
                                  setSaving(false)
                                  return
                                }
                                
                                console.log('Insert successful')
                              }

                              // Refresh assigned users
                              console.log('Refreshing assigned users...')
                              const { data, error: fetchError } = await supabase
                                .from('job_assignments')
                                .select('user_id')
                                .eq('job_id', parseInt(jobId as string))
                              
                              if (fetchError) {
                                console.error('Fetch error:', fetchError)
                                alert(`Failed to refresh assignments: ${fetchError.message}`)
                                setSaving(false)
                                return
                              }
                              
                              console.log('Fetched data:', data)

                              if (data) {
                                // Fetch profiles and roles for each assigned user
                                const assignedUsersData = await Promise.all(
                                  data.map(async (assignment: { user_id: string }) => {
                                    const { data: profile } = await supabase
                                      .from('profiles')
                                      .select('full_name, avatar_url')
                                      .eq('id', assignment.user_id)
                                      .maybeSingle()
                                    
                                    // Get user roles
                                    const { data: userRolesData } = await supabase
                                      .from('user_roles')
                                      .select('roles(name)')
                                      .eq('user_id', assignment.user_id)
                                    
                                    const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
                                    
                                    return {
                                      id: assignment.user_id,
                                      full_name: profile?.full_name || null,
                                      avatar_url: profile?.avatar_url || null,
                                      role: roles.length > 0 ? roles[0] : 'user'
                                    }
                                  })
                                )
                                console.log('Setting assigned users:', assignedUsersData)
                                setAssignedUsers(assignedUsersData)
                              }

                              setEditingAssignments(false)
                              setEditAssignedUserIds([])
                              console.log('Assignment update completed successfully')
                            } catch (error) {
                              console.error('Unexpected error updating assignments:', error)
                              alert(`Failed to update assignments: ${error instanceof Error ? error.message : 'Unknown error'}`)
                            }
                            setSaving(false)
                          }}
                          disabled={saving}
                          className="px-3 py-1 text-sm bg-primary-red text-white rounded-lg hover:bg-primary-red-dark disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => cancelEdit('assignment')}
                          disabled={saving}
                          className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm text-slate-600">
                        Assigned: {assignedUsers.length > 0 ? assignedUsers.map(u => u.full_name).filter(Boolean).join(', ') : 'Unassigned'}
                      </span>
                      <button
                        onClick={startEditAssignment}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Change assignment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
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
                      className="text-xl font-bold border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      disabled={saving}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateJobField('job_name', editJobName)}
                        disabled={saving || !editJobName.trim()}
                        className="px-3 py-1 text-sm bg-primary-red text-white rounded-lg hover:bg-primary-red-dark disabled:opacity-50"
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
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-slate-900">{job.job_name}</h1>
                      {(userRoles.some(role => role.name === 'super_admin')) && (
                        <button
                          onClick={startEditJobName}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                          title="Edit job name"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {editingCategory ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                            disabled={saving}
                          >
                            <option value="Windows">Windows</option>
                            <option value="Bathrooms">Bathrooms</option>
                            <option value="Siding">Siding</option>
                            <option value="Doors">Doors</option>
                          </select>
                          <button
                            onClick={() => handleUpdateJobField('category', editCategory)}
                            disabled={saving || !editCategory.trim()}
                            className="px-2 py-1 text-xs bg-primary-red text-white rounded hover:bg-primary-red-dark disabled:opacity-50"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => cancelEdit('category')}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {job.category && (
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              job.category === 'Windows' ? 'bg-blue-500 text-white' :
                              job.category === 'Bathrooms' ? 'bg-green-500 text-white' :
                              job.category === 'Siding' ? 'bg-yellow-500 text-white' :
                              job.category === 'Doors' ? 'bg-purple-500 text-white' :
                              'bg-slate-500 text-white'
                            }`}>
                              {job.category}
                            </span>
                          )}
                          {(userRoles.some(role => role.name === 'super_admin')) && (
                            <button
                              onClick={startEditCategory}
                              className="p-1 text-slate-400 hover:text-slate-600 transition"
                              title="Edit category"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {job.address && !editingAddress && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-600">{job.address}</p>
                    {(userRoles.some(role => role.name === 'super_admin')) && (
                      <button
                        onClick={startEditAddress}
                        className="p-1 text-slate-400 hover:text-slate-600 transition"
                        title="Edit address"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                {editingAddress && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Enter address"
                      className="text-sm border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent"
                      disabled={saving}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateJobField('address', editAddress)}
                        disabled={saving}
                        className="px-3 py-1 text-sm bg-primary-red text-white rounded-lg hover:bg-primary-red-dark disabled:opacity-50"
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
                {!job.address && !editingAddress && (userRoles.some(role => role.name === 'super_admin')) && (
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
                {/* Assignment Section - Desktop */}
                {(userRoles.some(role => role.name === 'super_admin')) && (
                  <div className="mt-1">
                    {editingAssignments ? (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-600">Assign users:</div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {users.map((user) => (
                            <label key={user.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editAssignedUserIds.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditAssignedUserIds(prev => [...prev, user.id])
                                  } else {
                                    setEditAssignedUserIds(prev => prev.filter(id => id !== user.id))
                                  }
                                }}
                                className="w-4 h-4 text-primary-red focus:ring-primary-red border-slate-300 rounded"
                                disabled={saving}
                              />
                              <span className="text-sm text-slate-700">{user.full_name || 'Unnamed User'}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setSaving(true)
                              try {
                                console.log('Starting desktop assignment update for jobId:', jobId, 'parsed:', parseInt(jobId as string))
                                console.log('Current user roles:', userRoles)
                                
                              // Delete existing assignments
                              console.log('Deleting existing assignments...')
                              const { error: deleteError } = await supabase
                                .from('job_assignments')
                                .delete()
                                .eq('job_id', parseInt(jobId as string))

                              if (deleteError) {
                                  console.error('Delete error:', deleteError)
                                  alert(`Failed to delete existing assignments: ${deleteError.message}`)
                                  setSaving(false)
                                  return
                                }
                                
                                console.log('Delete successful, inserting new assignments:', editAssignedUserIds)

                              // Insert new assignments
                              if (editAssignedUserIds.length > 0) {
                                const assignments = editAssignedUserIds.map(userId => ({
                                  job_id: parseInt(jobId as string),
                                  user_id: userId,
                                  assigned_by: user.id
                                }))
                                console.log('Inserting assignments:', assignments)
                                
                                const { error: insertError } = await supabase
                                  .from('job_assignments')
                                  .insert(assignments)

                                if (insertError) {
                                  console.error('Insert error:', insertError)
                                  alert(`Failed to insert new assignments: ${insertError.message}`)
                                  setSaving(false)
                                  return
                                }
                                  
                                  console.log('Insert successful')
                                }

                                // Refresh assigned users
                                console.log('Refreshing assigned users...')
                                const { data, error: fetchError } = await supabase
                                  .from('job_assignments')
                                  .select('user_id')
                                  .eq('job_id', parseInt(jobId as string))
                                
                                if (fetchError) {
                                  console.error('Fetch error:', fetchError)
                                  alert(`Failed to refresh assignments: ${fetchError.message}`)
                                  setSaving(false)
                                  return
                                }
                                
                                console.log('Fetched data:', data)

                                if (data) {
                                  // Fetch profiles and roles for each assigned user
                                  const assignedUsersData = await Promise.all(
                                    data.map(async (assignment: { user_id: string }) => {
                                      const { data: profile } = await supabase
                                        .from('profiles')
                                        .select('full_name, avatar_url')
                                        .eq('id', assignment.user_id)
                                        .maybeSingle()
                                      
                                      // Get user roles
                                      const { data: userRolesData } = await supabase
                                        .from('user_roles')
                                        .select('roles(name)')
                                        .eq('user_id', assignment.user_id)
                                      
                                      const roles = (userRolesData as unknown as { roles: { name: string } }[])?.map(ur => ur.roles?.name).filter(Boolean) || []
                                      
                                      return {
                                        id: assignment.user_id,
                                        full_name: profile?.full_name || null,
                                        avatar_url: profile?.avatar_url || null,
                                        role: roles.length > 0 ? roles[0] : 'user'
                                      }
                                    })
                                  )
                                  console.log('Setting assigned users:', assignedUsersData)
                                  setAssignedUsers(assignedUsersData)
                                }

                                setEditingAssignments(false)
                                setEditAssignedUserIds([])
                                console.log('Desktop assignment update completed successfully')
                              } catch (error) {
                                console.error('Unexpected error updating assignments:', error)
                                alert(`Failed to update assignments: ${error instanceof Error ? error.message : 'Unknown error'}`)
                              }
                              setSaving(false)
                            }}
                            disabled={saving}
                            className="px-3 py-1 text-sm bg-primary-red text-white rounded-lg hover:bg-primary-red-dark disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => cancelEdit('assignment')}
                            disabled={saving}
                            className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          Assigned: {assignedUsers.length > 0 ? assignedUsers.map(u => u.full_name).filter(Boolean).join(', ') : 'Unassigned'}
                        </span>
                        <button
                          onClick={startEditAssignment}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                          title="Change assignment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
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
                  <div className="w-8 h-8 bg-primary-red-light rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700">
                  {profile?.full_name || 'Name'}
                </span>
              </Link>
              {userRoles.some(role => role.name === 'super_admin') && (
                <button
                  onClick={handleDeleteJob}
                  className="px-4 py-2 text-sm font-medium text-primary-red hover:text-primary-red-dark hover:bg-primary-red-light rounded-lg transition flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Job</span>
                </button>
              )}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-lg transition"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAccountDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <Link href="/profile" onClick={() => setShowAccountDropdown(false)}>
                      <div className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Profile Settings
                      </div>
                    </Link>
                    <button
                      onClick={() => {
                        setShowAccountDropdown(false)
                        handleSignOut()
                      }}
                      className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
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
        {/* Mobile Photo Upload Button */}
        <div className="md:hidden mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 px-6 bg-primary-red text-white rounded-xl font-bold text-lg hover:bg-primary-red-dark transition flex items-center justify-center gap-3 shadow-lg"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Add Photo</span>
          </button>
        </div>

        {/* Hidden file input for mobile camera */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          ref={fileInputRef}
          style={{ display: 'none' }}
        />

        {/* Assigned Users Section */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Assigned Staff</h3>
          {assignedUsers.length > 0 ? (
            <div className="flex -space-x-2">
              {assignedUsers.map((assignedUser) => (
                <div
                  key={assignedUser.id}
                  className="relative group"
                >
                  {assignedUser.avatar_url ? (
                    <Image
                      src={assignedUser.avatar_url}
                      alt={assignedUser.full_name || 'User'}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full border-2 border-white object-cover hover:scale-110 transition-transform"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 bg-primary-red-light rounded-full border-2 border-white flex items-center justify-center hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {assignedUser.full_name || 'Unnamed User'}
                    <div className="text-slate-300 capitalize">{assignedUser.role.replace('_', ' ')}</div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600">No staff assigned yet</p>
          )}
        </div>

        {/* Location Section */}
        {job?.address && (
          <div className="bg-white rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Location</h3>
            <div className="space-y-4">
              <p className="text-slate-700">{job.address}</p>
              {coordinates ? (
                <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
                  <Map
                    initialViewState={{
                      latitude: coordinates.latitude,
                      longitude: coordinates.longitude,
                      zoom: 15
                    }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle="mapbox://styles/mapbox/streets-v11"
                    mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
                  >
                    <Marker
                      latitude={coordinates.latitude}
                      longitude={coordinates.longitude}
                      anchor="bottom"
                    >
                      <div className="w-6 h-6 bg-primary-red rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </Marker>
                  </Map>
                </div>
              ) : geocodingLoading ? (
                <div className="h-64 bg-slate-100 rounded-lg flex items-center justify-center">
                  <div className="text-slate-500">Loading map...</div>
                </div>
              ) : (
                <div className="h-64 bg-slate-100 rounded-lg flex items-center justify-center">
                  <div className="text-slate-500">Unable to load map</div>
                </div>
              )}
            </div>
          </div>
        )}

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
                    {(userRoles.some(role => role.name === 'super_admin')) && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeletePhoto(photo.id, e)
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-primary-red text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-primary-red-dark"
                        title="Delete photo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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

        {/* Documents Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
              <p className="text-slate-600 text-sm mt-1">{documents.length} documents uploaded</p>
            </div>
            <button
              onClick={() => documentFileInputRef?.click()}
              disabled={uploadingDocument}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2 disabled:opacity-50"
            >
              {uploadingDocument ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Document</span>
                </>
              )}
            </button>
          </div>

          {/* Hidden file input for documents */}
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
            onChange={handleDocumentUpload}
            ref={(ref) => setDocumentFileInputRef(ref)}
            style={{ display: 'none' }}
          />

          {/* Documents List */}
          {documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3 flex-1">
                    {/* File Icon */}
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      {document.file_type.includes('pdf') ? (
                        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      ) : document.file_type.includes('word') || document.file_type.includes('document') ? (
                        <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      ) : document.file_type.includes('excel') || document.file_type.includes('spreadsheet') ? (
                        <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900 truncate">{document.file_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>Uploaded by {document.uploader_name}</span>
                        <span>{new Date(document.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedDocument(document)
                        setShowDocumentModal(true)
                      }}
                      className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        const link = window.document.createElement('a')
                        link.href = document.file_url
                        link.download = document.file_name
                        link.click()
                      }}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                    >
                      Download
                    </button>
                    {(userRoles.some(role => role.name === 'super_admin')) && (
                      <button
                        onClick={(e) => handleDeleteDocument(document.id, e)}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                        title="Delete document"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No documents yet</h3>
              <p className="text-slate-600 mb-4">Upload contracts, permits, or other important documents</p>
              <button
                onClick={() => documentFileInputRef?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Upload Your First Document
              </button>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Comments</h2>
          <JobNotesSection jobId={String(jobId)} user={user} jobOwnerId={job?.user_id} />
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
            <div className="absolute top-0 left-0 bg-primary-red text-white p-2 text-xs z-20">
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

      {/* Document Modal */}
      {showDocumentModal && selectedDocument ? (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowDocumentModal(false)}>
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowDocumentModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Document Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 truncate">{selectedDocument.file_name}</h3>
                  <p className="text-sm text-slate-600">
                    {formatFileSize(selectedDocument.file_size)} • Uploaded by {selectedDocument.uploader_name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const link = window.document.createElement('a')
                      link.href = selectedDocument.file_url
                      link.download = selectedDocument.file_name
                      link.click()
                    }}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>

            {/* Document Viewer */}
            <div className="relative w-full h-[80vh] bg-slate-100">
              {selectedDocument.file_type.includes('pdf') ? (
                <iframe
                  src={selectedDocument.file_url}
                  className="w-full h-full"
                  title={selectedDocument.file_name}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Preview not available</h3>
                    <p className="text-slate-600 mb-4">This file type cannot be previewed in the browser</p>
                    <button
                      onClick={() => {
                        const link = window.document.createElement('a')
                        link.href = selectedDocument.file_url
                        link.download = selectedDocument.file_name
                        link.click()
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Download to View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
