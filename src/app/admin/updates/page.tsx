'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { sendSystemUpdate, getSystemUpdates } from '@/app/actions/updates'

type UpdateHistory = {
    id: string
    title: string
    features: string[]
    bug_fixes: string[]
    recipient_count: number
    sent_at: string
    notes?: string
}

export default function AdminUpdatesPage() {
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [title, setTitle] = useState('')
    const [features, setFeatures] = useState<string[]>([''])
    const [bugFixes, setBugFixes] = useState<string[]>([''])
    const [history, setHistory] = useState<UpdateHistory[]>([])
    const [notes, setNotes] = useState('')
    const [result, setResult] = useState<{ success?: boolean; sentCount?: number; error?: string } | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const loadHistory = useCallback(async () => {
        const res = await getSystemUpdates()
        if (res.data) setHistory(res.data as UpdateHistory[])
    }, [])

    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.auth.getUser()
            if (!data.user) { router.push('/login'); return }
            const { data: rolesData } = await supabase.from('user_roles').select('roles(name)').eq('user_id', data.user.id)
            const roles = (rolesData as any[])?.map((ur: any) => ur.roles?.name).filter(Boolean) || []
            if (!roles.includes('super_admin')) { router.push('/'); return }
            await loadHistory()
            setLoading(false)
        }
        init()
    }, [router, supabase, loadHistory])

    const handleSend = async () => {
        const cleanFeatures = features.filter(f => f.trim())
        const cleanFixes = bugFixes.filter(b => b.trim())
        if (!title.trim()) return

        setSending(true)
        setResult(null)

        try {
            const res = await sendSystemUpdate(title.trim(), cleanFeatures, cleanFixes, notes.trim())
            setResult(res)
            if (res.success) {
                setTitle('')
                setFeatures([''])
                setBugFixes([''])
                setNotes('')
                await loadHistory()
            }
        } catch (err: any) {
            setResult({ error: "An unexpected error occurred while sending. Please try again." })
        } finally {
            setSending(false)
        }
    }

    const updateListItem = (
        list: string[],
        setList: (v: string[]) => void,
        index: number,
        value: string
    ) => {
        const next = [...list]
        next[index] = value
        setList(next)
    }

    const addItem = (list: string[], setList: (v: string[]) => void) =>
        setList([...list, ''])

    const removeItem = (list: string[], setList: (v: string[]) => void, index: number) =>
        setList(list.filter((_, i) => i !== index))

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-red" />
            </div>
        )
    }

    const cleanFeatures = features.filter(f => f.trim())
    const cleanFixes = bugFixes.filter(b => b.trim())

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-manrope">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin" className="text-slate-400 hover:text-slate-600 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Updates</h1>
                        <p className="text-slate-500 mt-1">Compose and send weekly update emails to all users.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    {/* Compose Panel */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <span className="w-8 h-8 bg-primary-red/10 rounded-lg flex items-center justify-center text-primary-red text-base">✏️</span>
                                Compose Update
                            </h2>

                            {/* Title */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Update Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Week of March 6 — Performance & New Gallery Filters"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-red/30 focus:border-primary-red"
                                />
                            </div>

                            {/* Notes */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">📝 Update Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Add a personal note or summary (optional)..."
                                    rows={4}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-red/30 focus:border-primary-red resize-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 italic">This will appear at the top of the email as a summary paragraph.</p>
                            </div>

                            {/* New Features */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">✨ New Features</label>
                                <div className="space-y-2">
                                    {features.map((f, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={f}
                                                onChange={e => updateListItem(features, setFeatures, i, e.target.value)}
                                                placeholder={`Feature ${i + 1}...`}
                                                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-red/30 focus:border-primary-red"
                                            />
                                            {features.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(features, setFeatures, i)}
                                                    className="text-slate-400 hover:text-red-500 px-2 transition"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => addItem(features, setFeatures)}
                                    className="mt-2 text-sm text-primary-red hover:text-primary-red-dark font-medium flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add feature
                                </button>
                            </div>

                            {/* Bug Fixes */}
                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">🐛 Bug Fixes</label>
                                <div className="space-y-2">
                                    {bugFixes.map((b, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={b}
                                                onChange={e => updateListItem(bugFixes, setBugFixes, i, e.target.value)}
                                                placeholder={`Fix ${i + 1}...`}
                                                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-red/30 focus:border-primary-red"
                                            />
                                            {bugFixes.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(bugFixes, setBugFixes, i)}
                                                    className="text-slate-400 hover:text-red-500 px-2 transition"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => addItem(bugFixes, setBugFixes)}
                                    className="mt-2 text-sm text-primary-red hover:text-primary-red-dark font-medium flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add fix
                                </button>
                            </div>

                            {/* Result Banner */}
                            {result && (
                                <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${result.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                                    {result.success
                                        ? `✅ Successfully sent to ${result.sentCount} users!`
                                        : `❌ ${result.error}`}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    disabled={!title.trim()}
                                    className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:border-primary-red hover:text-primary-red transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {showPreview ? 'Hide Preview' : '👁 Preview Email'}
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!title.trim() || sending || (cleanFeatures.length === 0 && cleanFixes.length === 0)}
                                    className="flex-1 px-4 py-3 bg-primary-red text-white rounded-xl font-semibold text-sm hover:bg-primary-red-dark transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {sending ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending...
                                        </>
                                    ) : '📨 Send to All Users'}
                                </button>
                            </div>
                        </div>

                        {/* Email Preview */}
                        {showPreview && title && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-900 text-sm">Email Preview</h3>
                                    <span className="text-xs text-slate-400">How it will look in inboxes</span>
                                </div>
                                <div className="p-4">
                                    <div style={{ maxWidth: '100%', fontFamily: 'sans-serif', fontSize: 14 }}>
                                        {/* Simplified preview */}
                                        <div style={{ background: '#dc2626', padding: '24px', borderRadius: '8px 8px 0 0' }}>
                                            <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Sitekick</div>
                                            <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4 }}>System Update</div>
                                        </div>
                                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: 0, padding: '24px', borderRadius: '0 0 8px 8px' }}>
                                            <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            </div>
                                            <div style={{ color: '#0f172a', fontSize: 22, fontWeight: 800, marginBottom: 24, marginTop: 8 }}>
                                                {title || 'Update Title'}
                                            </div>
                                            {notes && (
                                                <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '16px', marginBottom: 16, borderLeft: '4px solid #cbd5e1', color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                                                    {notes}
                                                </div>
                                            )}
                                            {cleanFeatures.length > 0 && (
                                                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '16px', marginBottom: 16, border: '1px solid #bbf7d0' }}>
                                                    <div style={{ color: '#15803d', fontWeight: 700, marginBottom: 10 }}>✨ What's New</div>
                                                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                                                        {cleanFeatures.map((f, i) => <li key={i} style={{ color: '#166534', fontSize: 13, lineHeight: 1.7 }}>{f}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {cleanFixes.length > 0 && (
                                                <div style={{ background: '#fff7ed', borderRadius: 8, padding: '16px', border: '1px solid #fed7aa', marginBottom: 16 }}>
                                                    <div style={{ color: '#c2410c', fontWeight: 700, marginBottom: 10 }}>🐛 Bug Fixes</div>
                                                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                                                        {cleanFixes.map((b, i) => <li key={i} style={{ color: '#9a3412', fontSize: 13, lineHeight: 1.7 }}>{b}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                                                    © {new Date().getFullYear()} Sitekick. All rights reserved.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
                                <span className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 text-sm">📋</span>
                                Sent History
                            </h2>
                            {history.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="text-3xl mb-2">📭</div>
                                    <p className="text-slate-400 text-sm">No updates sent yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {history.map(update => (
                                        <div key={update.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                                            <p className="font-semibold text-slate-900 text-sm leading-tight">{update.title}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs text-slate-400">{new Date(update.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span className="text-xs text-slate-500 font-medium">📨 {update.recipient_count} recipients</span>
                                            </div>
                                            {update.notes && (
                                                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 italic">"{update.notes}"</p>
                                            )}
                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                {update.features.length > 0 && (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                                        {update.features.length} feature{update.features.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {update.bug_fixes.length > 0 && (
                                                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                                                        {update.bug_fixes.length} fix{update.bug_fixes.length > 1 ? 'es' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
