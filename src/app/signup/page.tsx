'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      let companyId = null

      if (company.trim()) {
        // 1. Try to find existing company
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('name', company.trim())
          .maybeSingle()

        if (existingCompany) {
          companyId = existingCompany.id
        } else {
          // 2. Create new company
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert({ name: company.trim() })
            .select('id')
            .single()

          if (!companyError && newCompany) {
            companyId = newCompany.id
          } else {
            console.error('Error creating company:', companyError)
          }
        }
      }

      // 3. Create or update the profile with company_id
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: fullName || null,
          phone: phone || null,
          company: company || null, // Keep text company for reference
          company_id: companyId,
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        setError('Account created but profile setup failed. Please complete your profile.')
      }

      // Check if email confirmation is required
      if (authData.session) {
        // User is automatically logged in
        router.push('/')
      } else {
        // Email confirmation required
        setError('Please check your email to confirm your account before logging in.')
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <Image
            src="/images/sitekick-logo-web.png"
            alt="Sitekick Logo"
            width={96}
            height={96}
            className="mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Join Sitekick</h1>
          <p className="text-slate-600">Create your account to get started</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-primary-red-light border border-primary-red text-primary-red px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-normal text-slate-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-normal text-slate-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-normal text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-normal text-slate-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-normal text-slate-700 mb-2">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ABC Construction"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-primary-red text-white rounded-lg font-semibold hover:bg-primary-red-dark transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-red-lighter"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="text-primary-red font-medium hover:text-primary-red-dark">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

