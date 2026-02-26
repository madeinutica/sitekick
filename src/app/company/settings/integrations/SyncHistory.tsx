'use client'

interface SyncLog {
    id: number
    started_at: string
    completed_at: string | null
    contacts_synced: number
    jobs_synced: number
    status: string
    errors: string[] | null
}

interface SyncHistoryProps {
    logs: SyncLog[]
}

export function SyncHistory({ logs }: SyncHistoryProps) {
    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(new Date(dateString))
    }

    if (!logs || logs.length === 0) {
        return (
            <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Sync History</h3>
                <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
                    No sync logs found for your company.
                </p>
            </div>
        )
    }

    return (
        <div className="mt-10">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sync History
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Contacts</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Jobs</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                        {formatDate(log.started_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${log.status === 'success' ? 'bg-green-100 text-green-700' :
                                            log.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {log.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-center font-mono">
                                        {log.contacts_synced}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-center font-mono">
                                        {log.jobs_synced}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate italic">
                                        {log.errors ? `${log.errors.length} errors found` : 'Healthy sync'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="mt-3 text-xs text-slate-400 italic">
                Only showing the last {logs.length} sync attempts.
            </p>
        </div>
    )
}
