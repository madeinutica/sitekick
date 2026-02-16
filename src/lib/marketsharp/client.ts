/**
 * MarketSharp OData API Client
 * 
 * The MarketSharp API is a read-only OData API.
 * Authentication uses HMAC-SHA256 with company ID, API key, and secret key.
 * Auth header format: companyID:APIkey:epoch:hash
 * 
 * Base URL: https://api4.marketsharpm.com/WcfDataService.svc
 */

import crypto from 'crypto'

const MARKETSHARP_BASE_URL = 'https://api4.marketsharpm.com/WcfDataService.svc'

export interface MarketSharpConfig {
  companyId: string
  apiKey: string
  secretKey: string
}

function getConfig(): MarketSharpConfig {
  const companyId = process.env.MARKETSHARP_COMPANY_ID
  const apiKey = process.env.MARKETSHARP_API_KEY
  const secretKey = process.env.MARKETSHARP_SECRET_KEY

  if (!companyId || !apiKey || !secretKey) {
    throw new Error(
      'MarketSharp credentials not configured. Set MARKETSHARP_COMPANY_ID, MARKETSHARP_API_KEY, and MARKETSHARP_SECRET_KEY environment variables.'
    )
  }

  return { companyId, apiKey, secretKey }
}

/**
 * Generate the HMAC-SHA256 authorization header for MarketSharp API requests.
 * Format: companyID:APIkey:epoch:hash
 */
function generateAuthHeader(config: MarketSharpConfig): string {
  const epochTime = Math.floor(Date.now() / 1000).toString()
  const message = config.companyId + config.apiKey + epochTime

  // Secret key is base64-encoded, decode it first
  const secretKeyBytes = Buffer.from(config.secretKey, 'base64')
  const messageBytes = Buffer.from(message, 'utf-8')

  const hash = crypto
    .createHmac('sha256', secretKeyBytes)
    .update(messageBytes)
    .digest('base64')

  return `${config.companyId}:${config.apiKey}:${epochTime}:${hash}`
}

/**
 * Parse OData date format: /Date(1674536400000)/ → ISO string
 */
function parseODataDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.match(/\/Date\((\d+)\)\//)
  if (match) {
    return new Date(parseInt(match[1])).toISOString()
  }
  return value
}

/**
 * Recursively parse OData dates in an object
 */
function parseODataDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string' && obj.startsWith('/Date(')) return parseODataDate(obj)
  if (Array.isArray(obj)) return obj.map(parseODataDates)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip deferred navigation properties
      if (typeof value === 'object' && value !== null && '__deferred' in (value as Record<string, unknown>)) continue
      result[key] = parseODataDates(value)
    }
    return result
  }
  return obj
}

/**
 * Make an authenticated GET request to the MarketSharp OData API.
 */
async function msGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const config = getConfig()
  const auth = generateAuthHeader(config)

  let url = `${MARKETSHARP_BASE_URL}/${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': auth,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`MarketSharp API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  // OData WCF responses use varying envelope formats:
  //   - Collections may be: { d: [...] } or { d: { results: [...] } }
  //   - Single entities may be: { d: { ... } }
  //   - Newer OData may use: { value: [...] }
  let result: unknown
  if (data.d) {
    if (Array.isArray(data.d)) result = data.d
    else if (data.d.results && Array.isArray(data.d.results)) result = data.d.results
    else result = data.d
  } else if (data.value) {
    result = data.value
  } else {
    result = data
  }
  // Parse OData date formats and strip deferred navigation properties
  return parseODataDates(result) as T
}

// ─── MarketSharp Data Types ────────────────────────────────────────────

export interface MSContact {
  id: string
  companyId: string
  firstName: string
  lastName: string
  middleInitial?: string
  title?: string
  businessName?: string
  email1?: string
  email2?: string
  email3?: string
  website1?: string
  source?: string
  creationDate?: string
  isActive?: boolean
  lastUpdate?: string
  mailMergeName?: string
}

export interface MSAddress {
  id: string
  contactId: string
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country?: string
  latitude?: number
  longitude?: number
  isActive?: boolean
}

export interface MSContactPhone {
  contactId: string
  homePhone?: string
  cellPhone?: string
  workPhone?: string
  otherPhone?: string
  companyPhone?: string
}

export interface MSJob {
  id: string
  contactId: string
  inquiryId?: string
  site?: string
  number?: string
  name: string
  description?: string
  type?: string
  status?: string
  addressLine1?: string
  addressLin2?: string
  city?: string
  state?: string
  zip?: string
  note?: string
  startDate?: string
  saleDate?: string
  completedDate?: string
  appointmentId?: string
  isActive?: boolean
  lastUpdate?: string
  createdDate?: string
  Contact?: {
    id?: string
    firstName?: string
    lastName?: string
    email1?: string
  }
}

export interface MSInquiry {
  id: string
  contactId: string
  description?: string
  inquiryDate?: string
  jobSiteAddressLine1?: string
  jobSiteAddressLine2?: string
  jobSiteCity?: string
  jobSiteState?: string
  jobSiteZip?: string
  isActive?: boolean
  division?: string
  lastUpdate?: string
  createdDate?: string
}

export interface MSAppointment {
  id: string
  inquiryId: string
  salesperson1Id?: string
  salesperson2Id?: string
  appointmentDate?: string
  subject?: string
  type?: string
  note?: string
  resultId?: string
  isActive?: boolean
  lastUpdate?: string
}

export interface MSEmployee {
  id: string
  name: string
  isActive?: boolean
  companyId: string
}

export interface MSContract {
  id: string
  jobId: string
  contractDate?: string
  status?: string
  completedDate?: string
  gross?: string | null
  grossPercent?: string | null
  totalContract?: string | null
  balanceDue?: string | null
  financeTotal?: string | null
  cashTotal?: string | null
  paymentType?: string | null
  isActive?: boolean
}

// ─── API Methods ───────────────────────────────────────────────────────

/**
 * Fetch all contacts (limit 5000 per MarketSharp API)
 */
export async function fetchContacts(filter?: string): Promise<MSContact[]> {
  const params: Record<string, string> = {}
  if (filter) params['$filter'] = filter
  return msGet<MSContact[]>('Contacts', Object.keys(params).length > 0 ? params : undefined)
}

/**
 * Fetch a single contact by OID
 */
export async function fetchContact(contactOid: string): Promise<MSContact> {
  return msGet<MSContact>(`Contacts('${contactOid}')`)
}

/**
 * Fetch addresses for a contact
 */
export async function fetchContactAddresses(contactOid: string): Promise<MSAddress[]> {
  return msGet<MSAddress[]>(`Contacts('${contactOid}')/Address`)
}

/**
 * Fetch phone numbers for a contact
 */
export async function fetchContactPhones(contactOid: string): Promise<MSContactPhone[]> {
  return msGet<MSContactPhone[]>(`Contacts('${contactOid}')/ContactPhone`)
}

/**
 * Fetch all jobs (limit 5000 per request)
 * Includes $expand=Contact to get customer name inline.
 */
export async function fetchJobs(filter?: string): Promise<MSJob[]> {
  const params: Record<string, string> = { '$expand': 'Contact' }
  if (filter) params['$filter'] = filter
  return msGet<MSJob[]>('Jobs', params)
}

/**
 * Fetch jobs for a specific contact
 */
export async function fetchContactJobs(contactOid: string): Promise<MSJob[]> {
  return msGet<MSJob[]>(`Contacts('${contactOid}')/Job`)
}

/**
 * Fetch inquiries/leads
 */
export async function fetchInquiries(filter?: string): Promise<MSInquiry[]> {
  const params: Record<string, string> = {}
  if (filter) params['$filter'] = filter
  return msGet<MSInquiry[]>('Inquiries', Object.keys(params).length > 0 ? params : undefined)
}

/**
 * Fetch inquiries for a specific contact
 */
export async function fetchContactInquiries(contactOid: string): Promise<MSInquiry[]> {
  return msGet<MSInquiry[]>(`Contacts('${contactOid}')/Inquiry`)
}

/**
 * Fetch appointments
 */
export async function fetchAppointments(filter?: string): Promise<MSAppointment[]> {
  const params: Record<string, string> = {}
  if (filter) params['$filter'] = filter
  return msGet<MSAppointment[]>('Appointments', Object.keys(params).length > 0 ? params : undefined)
}

/**
 * Fetch employees
 */
export async function fetchEmployees(): Promise<MSEmployee[]> {
  return msGet<MSEmployee[]>('Employees')
}

/**
 * Fetch contracts for a job
 */
export async function fetchContracts(filter?: string): Promise<MSContract[]> {
  const params: Record<string, string> = {}
  if (filter) params['$filter'] = filter
  return msGet<MSContract[]>('Contracts', Object.keys(params).length > 0 ? params : undefined)
}

/**
 * Fetch contracts for a specific job by job ID
 */
export async function fetchJobContracts(jobId: string): Promise<MSContract[]> {
  return msGet<MSContract[]>(`Jobs('${jobId}')/Contract`)
}

/**
 * Fetch customers (contact type = customer)
 */
export async function fetchCustomers(): Promise<MSContact[]> {
  return msGet<MSContact[]>('Customers')
}

/**
 * Fetch leads
 */
export async function fetchLeads(): Promise<MSContact[]> {
  return msGet<MSContact[]>('Leads')
}

/**
 * Fetch prospects
 */
export async function fetchProspects(): Promise<MSContact[]> {
  return msGet<MSContact[]>('Prospects')
}

/**
 * Test the MarketSharp API connection by fetching customers and jobs
 */
export async function testConnection(): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const customers = await fetchCustomers()
    const jobs = await fetchJobs()
    const customerCount = Array.isArray(customers) ? customers.length : 0
    const jobCount = Array.isArray(jobs) ? jobs.length : 0
    return {
      success: true,
      message: `Connected successfully. Found ${customerCount} customers and ${jobCount} jobs.`,
      data: { customerCount, jobCount }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error connecting to MarketSharp'
    }
  }
}
