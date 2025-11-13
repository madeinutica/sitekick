'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isSuperUser, setIsSuperUser] = useState(false)
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchProfileData = async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_super_user, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    
    if (profileError) {
      console.error('Profile error:', profileError)
    } else if (profileData) {
      console.log('Home page - Profile loaded:', profileData)
      setIsSuperUser(profileData.is_super_user || false)
      setProfile(profileData)
    }
  }

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
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
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
              <Link href="/profile" className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-3 py-2 transition">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover"
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
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="bg-white rounded-xl border border-slate-200 p-6 opacity-50">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reports</h3>
                <p className="text-slate-600 text-sm">Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Panel Link for Super Users */}
        {isSuperUser && (
          <div className="mt-8">
            <Link href="/admin">
              <div className="bg-gradient-to-r from-red-500 to-orange-600 rounded-xl p-6 hover:shadow-lg transition cursor-pointer">
                <div className="flex items-center space-x-4 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Admin Panel</h3>
                    <p className="text-white/80 text-sm">Manage super user access</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Notes Section */}
          {/* Notes Section removed */}
      </main>
    </div>
  )
}

// NotesSection component
import { useCallback } from 'react'

type Note = {
  id: string
  user_id: string
  content: string
  created_at: string
  user_profile?: { full_name?: string; avatar_url?: string }
}

function NotesSection({ user, isSuperUser, profile }: { user: User, isSuperUser: boolean, profile: any }) {
  const supabase = createClient()
  const [notes, setNotes] = useState<Note[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch notes with user profile
  const fetchNotes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .select('id, user_id, content, created_at, profiles(full_name, avatar_url)')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setNotes(data.map((n: any) => ({
        ...n,
        user_profile: n.profiles
      })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Add note
  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setLoading(true)
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      content: noteContent
    })
    setNoteContent('')
    setLoading(false)
    fetchNotes()
  }

  // Edit note
  const handleEditNote = async (id: string) => {
    if (!editingContent.trim()) return
    setLoading(true)
    await supabase.from('notes').update({ content: editingContent }).eq('id', id)
    setEditingId(null)
    setEditingContent('')
    setLoading(false)
    fetchNotes()
  }

  // Format time ago
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

  return (
    <div>
      <div className="space-y-5 mb-4">
        {notes.length > 0 ? (
          notes.map(note => (
            <div key={note.id} className="flex items-start gap-3">
              {note.user_profile?.avatar_url ? (
                <img src={note.user_profile.avatar_url} alt="avatar" className="rounded-full w-10 h-10 object-cover" />
              ) : (
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <div className="font-bold text-slate-900 leading-tight">{note.user_profile?.full_name || 'User'}</div>
                {editingId === note.id ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      className="px-3 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition"
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
              {(isSuperUser || note.user_id === user.id) && editingId !== note.id && (
                <button
                  className="ml-2 text-slate-400 hover:text-red-600"
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
      <form className="flex items-center gap-3 pt-2 border-t border-slate-100" onSubmit={e => { e.preventDefault(); handleAddNote() }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="avatar" className="rounded-full w-10 h-10 object-cover" />
        ) : (
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <input
          type="text"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Add a comment"
          value={noteContent}
          onChange={e => setNoteContent(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition disabled:opacity-50"
          disabled={loading || !noteContent.trim()}
        >Post</button>
      </form>
    </div>
  )
}
