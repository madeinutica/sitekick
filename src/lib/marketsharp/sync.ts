/**
 * MarketSharp Sync Engine
 * 
 * Handles syncing contacts and jobs from MarketSharp OData API
 * into the local Supabase database.
 */

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import {
  fetchContacts,
  fetchContactAddresses,
  fetchContactPhones,
  fetchJobs,
  fetchCustomers,
  fetchJobContracts,
  type MSContact,
  type MSJob,
  type MSAddress,
  type MSContactPhone,
  type MSContract,
} from './client'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for server-side sync')
  }
  return createSupabaseAdmin(url, serviceKey)
}

export interface SyncResult {
  success: boolean
  contactsSynced: number
  jobsSynced: number
  errors: string[]
  startedAt: string
  completedAt: string
}

/**
 * Map a MarketSharp job type/description to a local category.
 * Adjust this mapping based on your MarketSharp product types.
 */
function mapToCategory(msJob: MSJob): string {
  const type = (msJob.type || msJob.description || msJob.name || '').toLowerCase()
  if (type.includes('window')) return 'Windows'
  if (type.includes('bath') || type.includes('bathroom')) return 'Bathrooms'
  if (type.includes('siding')) return 'Siding'
  if (type.includes('door')) return 'Doors'
  // Default category
  return 'Windows'
}

/**
 * Build a full address string from MarketSharp address components
 */
function buildAddressString(addr?: MSAddress | null, job?: MSJob | null): string {
  // Try job address first
  if (job?.addressLine1) {
    const parts = [job.addressLine1, job.city, job.state, job.zip].filter(Boolean)
    return parts.join(', ')
  }
  // Fall back to contact address
  if (addr?.line1) {
    const parts = [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean)
    return parts.join(', ')
  }
  return ''
}

/**
 * Run a full sync from MarketSharp to local database.
 * This upserts contacts and jobs using the marketsharp_id as the foreign key.
 */
/**
 * Run a full sync for a specific company from MarketSharp to local database.
 * This upserts contacts and jobs using the marketsharp_id as the foreign key.
 */
export async function runSync(companyId: string, config: { companyId: string; apiKey: string; secretKey: string }, triggeringUserId?: string): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const errors: string[] = []
  let contactsSynced = 0
  let jobsSynced = 0

  const supabase = getSupabaseAdmin()

  try {
    // ─── Step 0: Determine Sync Type (Full vs Delta) ──────────────────
    // Look for the last successful sync start time to use as a delta threshold
    const { data: lastSync } = await supabase
      .from('ms_sync_log')
      .select('started_at')
      .eq('company_id', companyId)
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let filter: string | undefined = undefined
    if (lastSync?.started_at) {
      // MarketSharp OData dates must be YYYY-MM-DDTHH:MM:SS
      const lastDate = new Date(lastSync.started_at)
      // Subtract a 5-minute buffer to account for clock drift or mid-sync updates
      const bufferDate = new Date(lastDate.getTime() - 5 * 60 * 1000)
      const dateStr = bufferDate.toISOString().split('.')[0]
      filter = `lastUpdate ge datetime'${dateStr}'`
      console.log(`[MarketSharp] Performing delta sync using filter: ${filter}`)
    } else {
      console.log(`[MarketSharp] No previous successful sync found. Performing full sync.`)
    }

    // ─── Step 1: Sync Contacts ───────────────────────────────────────
    let msContacts: MSContact[] = []
    try {
      // Use the unified fetchContacts which now correctly handles filters and fallbacks
      msContacts = await fetchContacts(filter, config)
      if (!Array.isArray(msContacts)) msContacts = []
    } catch (err) {
      errors.push(`Failed to fetch contacts: ${err instanceof Error ? err.message : err}`)
    }

    for (const contact of msContacts) {
      try {
        const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
        const addressStr = [contact.addressLine1, contact.city, contact.state, contact.zip]
          .filter(Boolean)
          .join(', ')

        // Upsert into ms_contacts table
        const { error } = await supabase
          .from('ms_contacts')
          .upsert({
            company_id: companyId,
            marketsharp_id: contact.id,
            first_name: contact.firstName || '',
            last_name: contact.lastName || '',
            full_name: fullName,
            email: contact.email1 || null,
            phone: contact.cellPhone || contact.homePhone || contact.workPhone || null,
            address: addressStr,
            city: contact.city || null,
            state: contact.state || null,
            zip: contact.zip || null,
            business_name: contact.businessName || null,
            source: contact.source || null,
            is_active: contact.isActive ?? true,
            last_synced_at: new Date().toISOString(),
            ms_created_date: contact.creationDate || null,
            ms_last_update: contact.lastUpdate || null,
          }, { onConflict: 'company_id, marketsharp_id' })

        if (error) {
          errors.push(`Contact ${contact.id} upsert error: ${error.message}`)
        } else {
          contactsSynced++
        }
      } catch (err) {
        errors.push(`Contact ${contact.id}: ${err instanceof Error ? err.message : err}`)
      }
    }

    // ─── Step 2: Sync Jobs ────────────────────────────────────────────
    let msJobs: MSJob[] = []
    try {
      msJobs = await fetchJobs(filter, config)
      if (!Array.isArray(msJobs)) msJobs = []
    } catch (err) {
      errors.push(`Failed to fetch jobs: ${err instanceof Error ? err.message : err}`)
    }

    // Since we removed all sub-resource fetches (due to MarketSharp server bugs),
    // we resolve the contact info locally from our synced ms_contacts table.
    const uniqueContactIds = [...new Set(msJobs.map(j => j.contactId).filter(Boolean))]
    const contactMap: Record<string, any> = {}

    if (uniqueContactIds.length > 0) {
      const { data: contactsData } = await supabase
        .from('ms_contacts')
        .select('*')
        .eq('company_id', companyId)
        .in('marketsharp_id', uniqueContactIds)

      if (contactsData) {
        contactsData.forEach(c => {
          contactMap[c.marketsharp_id] = c
        })
      }
    }

    for (const msJob of msJobs) {
      try {
        // Resolve contact from local map
        const resolvedContact = msJob.contactId ? contactMap[msJob.contactId] : null

        const address = buildAddressString(null, msJob) || resolvedContact?.address || ''
        const category = mapToCategory(msJob)

        // Build job name from customer last name + job type
        const customerLastName = resolvedContact?.last_name || ''
        const jobType = msJob.name || msJob.type || 'Job'
        const jobDisplayName = customerLastName
          ? `${customerLastName} - ${jobType}`
          : msJob.name || `Job ${msJob.number || msJob.id}`

        // Upsert into ms_jobs table (MarketSharp mirror)
        const { error } = await supabase
          .from('ms_jobs')
          .upsert({
            company_id: companyId,
            marketsharp_id: msJob.id,
            marketsharp_contact_id: msJob.contactId || null,
            job_name: jobDisplayName,
            description: msJob.description || null,
            job_type: msJob.type || null,
            status: msJob.status || null,
            address: address,
            city: msJob.city || resolvedContact?.city || null,
            state: msJob.state || resolvedContact?.state || null,
            zip: msJob.zip || resolvedContact?.zip || null,
            category: category,
            start_date: msJob.startDate || null,
            sale_date: msJob.saleDate || null,
            completed_date: msJob.completedDate || null,
            is_active: msJob.isActive ?? true,
            last_synced_at: new Date().toISOString(),
            ms_created_date: msJob.createdDate || null,
            ms_last_update: msJob.lastUpdate || null,
          }, { onConflict: 'company_id, marketsharp_id' })

        if (error) {
          errors.push(`Job ${msJob.id} upsert error: ${error.message}`)
        } else {
          jobsSynced++
        }

        // Determine if this job belongs in the main jobs table
        const completedStatuses = ['installed', 'completed', 'closed']
        const isFinished = completedStatuses.includes((msJob.status || '').toLowerCase()) || !!msJob.completedDate
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const completedDate = msJob.completedDate ? new Date(msJob.completedDate) : null
        const isRecentlyFinished = isFinished && completedDate && completedDate >= thirtyDaysAgo
        const shouldBeInMainTable = !isFinished || isRecentlyFinished

        const { data: existingLink } = await supabase
          .from('jobs')
          .select('id')
          .eq('marketsharp_job_id', msJob.id)
          .maybeSingle()

        if (shouldBeInMainTable) {
          const jobData = {
            company_id: companyId,
            job_name: jobDisplayName,
            address: address,
            category: category,
            installation_info: msJob.description || null,
            ms_notes: msJob.note || null,
            status: msJob.status || null,
            sale_date: msJob.saleDate || null,
            start_date: msJob.startDate || null,
            completed_date: msJob.completedDate || null,
            customer_name: resolvedContact?.full_name || null,
            customer_email: resolvedContact?.email || null,
            customer_phone: resolvedContact?.phone || null,
            // Contract info is unavailable due to MarketSharp API bug
            contract_total: null,
            contract_balance_due: null,
            contract_status: null,
            contract_date: null,
          }

          if (!existingLink) {
            await supabase.from('jobs').insert({
              ...jobData,
              user_id: triggeringUserId || null,
              marketsharp_job_id: msJob.id,
              marketsharp_contact_id: msJob.contactId || null,
            })
          } else {
            await supabase.from('jobs')
              .update({ ...jobData, is_archived: false })
              .eq('marketsharp_job_id', msJob.id)
          }
        } else if (existingLink) {
          await supabase.from('jobs')
            .update({ is_archived: true })
            .eq('marketsharp_job_id', msJob.id)
        }
      } catch (err) {
        errors.push(`Job ${msJob.id}: ${err instanceof Error ? err.message : err}`)
      }
    }

    // ─── Step 3: Log the sync run ────────────────────────────────────
    const completedAt = new Date().toISOString()
    await supabase
      .from('ms_sync_log')
      .insert({
        company_id: companyId,
        started_at: startedAt,
        completed_at: completedAt,
        contacts_synced: contactsSynced,
        jobs_synced: jobsSynced,
        errors: errors.length > 0 ? errors : null,
        status: errors.length === 0 ? 'success' : 'partial',
      })

    return {
      success: errors.length === 0,
      contactsSynced,
      jobsSynced,
      errors,
      startedAt,
      completedAt,
    }
  } catch (err) {
    const completedAt = new Date().toISOString()
    errors.push(`Fatal sync error: ${err instanceof Error ? err.message : err}`)

    // Try to log the failed sync
    try {
      await supabase
        .from('ms_sync_log')
        .insert({
          company_id: companyId,
          started_at: startedAt,
          completed_at: completedAt,
          contacts_synced: contactsSynced,
          jobs_synced: jobsSynced,
          errors,
          status: 'failed',
        })
    } catch { /* ignore logging failure */ }

    return {
      success: false,
      contactsSynced,
      jobsSynced,
      errors,
      startedAt,
      completedAt,
    }
  }
}

