'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Point directly to reset-password. This avoids server-side routes that might be pre-clicked by email scanners.
        const redirectUrl = `${window.location.origin}/reset-password`

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-light-gray via-white to-light-gray px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div className="text-center mb-8">
                        <Image
                            src="/images/sitekick-logo-web.png"
                            alt="Sitekick Logo"
                            width={160}
                            height={40}
                            className="h-12 w-auto mx-auto mb-4"
                        />
                        <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
                        <p className="text-slate-600 mt-2">Enter your email to receive a reset link</p>
                    </div>

                    {success ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Check your email</h2>
                            <p className="text-slate-600 mb-6">We&apos;ve sent a password reset link to <strong>{email}</strong>.</p>
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full px-4 py-3 text-white bg-primary-red rounded-lg font-medium hover:bg-primary-red-dark transition"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="mb-6 p-4 bg-primary-red-light border border-primary-red text-primary-red text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleResetPassword} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="email">
                                        Email
                                    </label>
                                    <input
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent transition"
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>

                                <button
                                    className="w-full px-4 py-3 text-white bg-primary-red rounded-lg font-medium hover:bg-primary-red-dark focus:outline-none focus:ring-2 focus:ring-primary-red focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending link...' : 'Send Reset Link'}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                                    Back to Sign In
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
