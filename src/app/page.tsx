'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        router.push('/dashboard')
      } else {
        setIsChecking(false)
      }
    }
    checkUser()
  }, [router, supabase])

  if (isChecking) {
    return null
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-light-gray via-white to-light-gray">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image
                src="/images/sitekick-logo-web.png"
                alt="Sitekick Logo"
                width={128}
                height={128}
                className="rounded-lg"
              />
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
                Sign In
              </Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-primary-red hover:bg-primary-red-dark rounded-lg transition shadow-lg shadow-primary-red-lighter">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Document Your Field Work
            <span className="block text-primary-red mt-2">Like Never Before</span>
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Professional photo documentation, job management, and GPS tracking for field technicians. 
            Streamline your workflow and never lose track of a job site again.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="px-8 py-4 text-lg font-semibold text-white bg-primary-red hover:bg-primary-red-dark rounded-xl transition shadow-xl shadow-primary-red-lighter hover:shadow-2xl hover:shadow-primary-red-light">
              Start Free Trial
            </Link>
            <Link href="/login" className="px-8 py-4 text-lg font-semibold text-slate-700 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-xl transition">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-center text-slate-900 mb-12">Everything You Need</h3>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition">
            <div className="w-12 h-12 bg-primary-red-light rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Photo Documentation</h4>
            <p className="text-slate-600">
              Capture, organize, and categorize job site photos with captions. Before, after, progress, and issue tracking.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition">
            <div className="w-12 h-12 bg-primary-red-light rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">GPS Tracking</h4>
            <p className="text-slate-600">
              Automatic location tagging for every photo. View job sites on a map and prove you were on site.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition">
            <div className="w-12 h-12 bg-primary-red-light rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Job Management</h4>
            <p className="text-slate-600">
              Track multiple jobs with addresses, notes, and installation details. All your work in one place.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition">
            <div className="w-12 h-12 bg-primary-red-light rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Mobile First</h4>
            <p className="text-slate-600">
              Progressive Web App works on any device. Install on your phone for offline access and native feel.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition">
            <div className="w-12 h-12 bg-primary-red-light rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Secure & Private</h4>
            <p className="text-slate-600">
              Your data is encrypted and secure. User authentication and row-level security protect your information.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition">
            <div className="w-12 h-12 bg-primary-red-light rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Team Ready</h4>
            <p className="text-slate-600">
              Super user access for managers. View all jobs across your team or just your own work.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-primary-red rounded-3xl p-12 text-center shadow-2xl">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Elevate Your Field Work?
          </h3>
          <p className="text-xl text-white/90 mb-8">
            Join field technicians who trust Sitekick for professional documentation
          </p>
          <Link href="/signup" className="inline-block px-8 py-4 text-lg font-semibold text-primary-red bg-white hover:bg-slate-50 rounded-xl transition shadow-xl">
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/images/sitekick-logo-web.png"
                alt="Sitekick Logo"
                width={120}
                height={120}
                className="rounded-lg"
              />
            </div>
            <p className="text-sm text-slate-600">
              © 2025 Sitekick. Professional field documentation made simple.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}


