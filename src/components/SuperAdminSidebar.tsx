'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SuperAdminSidebarProps {
  className?: string
}

export default function SuperAdminSidebar({ 
  className = ''
}: SuperAdminSidebarProps) {
  const pathname = usePathname()

  const adminLinks = [
    {
      href: '/admin',
      label: 'User Management',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      description: 'Manage user roles and permissions'
    },
    {
      href: '/gallery',
      label: 'Photo Gallery',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      description: 'View all photos across jobs'
    },
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      description: 'Overview and analytics'
    },
    {
      href: '/admin/marketsharp',
      label: 'MarketSharp',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      description: 'CRM sync & customer data'
    }
  ]

  return (
    <div className={`bg-white border-r border-slate-200 p-6 shadow-sm ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Admin Panel</h3>
        <div className="space-y-2">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                pathname === link.href
                  ? 'bg-primary-red-light border border-primary-red text-primary-red'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`shrink-0 ${pathname === link.href ? 'text-primary-red' : 'text-slate-500'}`}>
                {link.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{link.label}</div>
                <div className="text-xs text-slate-500 truncate">{link.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-slate-200 pt-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h4>
        <div className="space-y-2">
          <Link
            href="/jobs"
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${
              pathname === '/jobs'
                ? 'bg-primary-red-light text-primary-red'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm">All Jobs</span>
          </Link>

          <Link
            href="/profile"
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${
              pathname === '/profile'
                ? 'bg-primary-red-light text-primary-red'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            <span className="text-sm">Profile</span>
          </Link>
        </div>
      </div>
    </div>
  )
}