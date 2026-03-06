'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [readyToReset, setReadyToReset] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // This effect just checks if we have any auth data in the URL
  useEffect(() => {
    const hasCode = !!searchParams.get('code')
    const hasAccessToken = !!searchParams.get('access_token')
    const hasHashToken = typeof window !== 'undefined' && window.location.hash.includes('access_token')

    if (hasCode || hasAccessToken || hasHashToken) {
      // We have tokens, but we won't consume them yet. 
      // The user must click the "Verify" button first.
    }
  }, [searchParams])

  const handleVerify = async () => {
    setVerifying(true)
    setError('')

    try {
      // With 'implicit' flow the reset email contains tokens in the URL hash
      // fragment (#access_token=...&refresh_token=...).
      // We read those here so no PKCE code-verifier is ever needed.
      let accessToken: string | null = null
      let refreshToken: string | null = null

      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        accessToken = hashParams.get('access_token')
        refreshToken = hashParams.get('refresh_token')
      }

      // Fallback: query params (shouldn't happen with implicit flow, but keep for safety)
      if (!accessToken) {
        accessToken = searchParams.get('access_token')
        refreshToken = searchParams.get('refresh_token')
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) throw error
        setReadyToReset(true)
      } else {
        // No tokens found – maybe user already has a valid session
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setReadyToReset(true)
        } else {
          setError('No valid reset session found. Your link may have expired. Please request a new one.')
        }
      }
    } catch (err: any) {
      console.error('Auth verification error:', err.message)
      setError(err.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Redirect to login after a delay
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err) {
      console.error('Password reset error:', err)
      setError('An unexpected error occurred')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Reset Your Password</h1>
            <p className="text-slate-600 mt-2">
              {!readyToReset && !success ? 'Please verify your request to continue' : 'Enter your new password below'}
            </p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Password Updated!</h2>
              <p className="text-slate-600">Your password has been successfully reset. You will be redirected to the login page shortly.</p>
            </div>
          ) : !readyToReset ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                To protect your account, please click the button below to verify this reset request and choose a new password.
              </div>

              {error && (
                <div className="bg-primary-red-light border border-primary-red rounded-lg p-4">
                  <p className="text-primary-red text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full px-4 py-3 bg-primary-red text-white rounded-lg font-medium hover:bg-primary-red-dark transition disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Continue'
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-normal text-slate-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-slate-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-primary-red-light border border-primary-red rounded-lg p-4">
                  <p className="text-primary-red text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-primary-red text-white rounded-lg font-medium hover:bg-primary-red-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-red-lighter border-t-primary-red rounded-full mx-auto mb-4"></div>
              <p className="text-slate-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}