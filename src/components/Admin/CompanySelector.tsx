'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface Company {
    id: string
    name: string
}

interface CompanySelectorProps {
    onCompanyChange: (companyId: string | null) => void
    currentCompanyId: string | null
}

export default function CompanySelector({ onCompanyChange, currentCompanyId }: CompanySelectorProps) {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchCompanies() {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name')
                .order('name')

            if (!error && data) {
                setCompanies(data)
            }
            setLoading(false)
        }

        fetchCompanies()
    }, [supabase])

    if (loading) return null

    return (
        <div className="flex items-center gap-2">
            <label htmlFor="company-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Viewing:
            </label>
            <select
                id="company-select"
                value={currentCompanyId || ''}
                onChange={(e) => onCompanyChange(e.target.value || null)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary-red focus:border-primary-red block p-2 transition shadow-sm"
            >
                <option value="">All Companies</option>
                {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                        {company.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
