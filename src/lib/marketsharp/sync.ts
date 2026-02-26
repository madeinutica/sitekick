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
    // ─── Step 1: Sync Contacts ───────────────────────────────────────
    let msContacts: MSContact[] = []
    try {
      msContacts = await fetchCustomers(config)
      if (!Array.isArray(msContacts)) msContacts = []
    } catch (err) {
      const msg = `Failed to fetch customers, trying all contacts: ${err instanceof Error ? err.message : err}`
      errors.push(msg)
      try {
        msContacts = await fetchContacts(undefined, config)
        if (!Array.isArray(msContacts)) msContacts = []
      } catch (err2) {
        errors.push(`Failed to fetch contacts: ${err2 instanceof Error ? err2.message : err2}`)
      }
    }

    for (const contact of msContacts) {
      try {
        // Fetch address and phone for this contact
        let address: MSAddress | null = null
        let phone: MSContactPhone | null = null

        try {
          const addresses = await fetchContactAddresses(contact.id, config)
          address = Array.isArray(addresses) && addresses.length > 0 ? addresses[0] : null
        } catch { /* address fetch failed, continue */ }

        try {
          const phones = await fetchContactPhones(contact.id, config)
          phone = Array.isArray(phones) && phones.length > 0 ? phones[0] : null
        } catch { /* phone fetch failed, continue */ }

        const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
        const addressStr = address ? [address.line1, address.city, address.state, address.zip].filter(Boolean).join(', ') : ''

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
            phone: phone?.cellPhone || phone?.homePhone || phone?.workPhone || null,
            address: addressStr,
            city: address?.city || null,
            state: address?.state || null,
            zip: address?.zip || null,
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
      msJobs = await fetchJobs(undefined, config)
      if (!Array.isArray(msJobs)) msJobs = []
    } catch (err) {
      errors.push(`Failed to fetch jobs: ${err instanceof Error ? err.message : err}`)
    }

    for (const msJob of msJobs) {
      try {
        // Resolve the contact's address if the job has no address
        let contactAddress: MSAddress | null = null
        let contactPhone: MSContactPhone | null = null
        if (msJob.contactId) {
          if (!msJob.addressLine1) {
            try {
              const addresses = await fetchContactAddresses(msJob.contactId, config)
              contactAddress = Array.isArray(addresses) && addresses.length > 0 ? addresses[0] : null
            } catch { /* ignore */ }
          }
          // Fetch phone for customer info
          try {
            const phones = await fetchContactPhones(msJob.contactId, config)
            contactPhone = Array.isArray(phones) && phones.length > 0 ? phones[0] : null
          } catch { /* ignore */ }
        }

        // Fetch contract data for this job
        let contract: MSContract | null = null
        try {
          const contracts = await fetchJobContracts(msJob.id, config)
          contract = Array.isArray(contracts) && contracts.length > 0 ? contracts[0] : null
        } catch { /* ignore contract fetch failure */ }

        const address = buildAddressString(contactAddress, msJob)
        const category = mapToCategory(msJob)

        // Build job name from customer last name + job type
        const customerLastName = msJob.Contact?.lastName || ''
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
            city: msJob.city || contactAddress?.city || null,
            state: msJob.state || contactAddress?.state || null,
            zip: msJob.zip || contactAddress?.zip || null,
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

        // Determine if this job belongs in the main jobs table:
        // - Unfinished jobs (not "Installed"/"Completed" or no completed date)
        // - Finished jobs completed within the last 30 days
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
          // Build the full data object with all available info
          const customerName = [msJob.Contact?.firstName, msJob.Contact?.lastName].filter(Boolean).join(' ') || null
          const customerEmail = msJob.Contact?.email1 || null
          const customerPhoneStr = contactPhone?.cellPhone || contactPhone?.homePhone || contactPhone?.workPhone || null

          const jobData = {
            company_id: companyId, // Ensure company assignment
            job_name: jobDisplayName,
            address: address,
            category: category,
            installation_info: msJob.description || null,
            ms_notes: msJob.note || null,
            status: msJob.status || null,
            sale_date: msJob.saleDate || null,
            start_date: msJob.startDate || null,
            completed_date: msJob.completedDate || null,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhoneStr,
            contract_total: contract?.totalContract ? parseFloat(contract.totalContract) : contract?.cashTotal ? parseFloat(contract.cashTotal) : null,
            contract_balance_due: contract?.balanceDue ? parseFloat(contract.balanceDue) : null,
            contract_finance_total: contract?.financeTotal ? parseFloat(contract.financeTotal) : null,
            contract_cash_total: contract?.cashTotal ? parseFloat(contract.cashTotal) : null,
            contract_status: contract?.status || null,
            contract_date: contract?.contractDate || null,
            payment_type: contract?.paymentType || null,
          }

          if (!existingLink) {
            // Create a new job in the main jobs table
            const { error: jobError } = await supabase
              .from('jobs')
              .insert({
                ...jobData,
                user_id: triggeringUserId || null, // Attribute to triggering user if available
                marketsharp_job_id: msJob.id,
                marketsharp_contact_id: msJob.contactId || null,
              })

            if (jobError) {
              errors.push(`Job link ${msJob.id}: ${jobError.message}`)
            }
          } else {
            // Update existing linked job
            // Check if it belongs to the same company
            const { error: updateError } = await supabase
              .from('jobs')
              .update({ ...jobData, is_archived: false }) // Reinstate if it was archived
              .eq('marketsharp_job_id', msJob.id)
              .eq('company_id', companyId) // Safety check

            if (updateError) {
              errors.push(`Job update ${msJob.id}: ${updateError.message}`)
            }
          }
        } else if (existingLink) {
          // Job is finished and older than 30 days — archive instead of delete
          const { error: archiveError } = await supabase
            .from('jobs')
            .update({ is_archived: true })
            .eq('marketsharp_job_id', msJob.id)
            .eq('company_id', companyId)

          if (archiveError) {
            errors.push(`Job archiving ${msJob.id}: ${archiveError.message}`)
          }
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

