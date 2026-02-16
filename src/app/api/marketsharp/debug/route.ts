import { NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * GET /api/marketsharp/debug
 * Debug endpoint to inspect raw MarketSharp API responses and field names.
 */
export async function GET() {
  try {
    const companyId = process.env.MARKETSHARP_COMPANY_ID!
    const apiKey = process.env.MARKETSHARP_API_KEY!
    const secretKey = process.env.MARKETSHARP_SECRET_KEY!

    if (!companyId || !apiKey || !secretKey) {
      return NextResponse.json({ error: 'Missing MarketSharp credentials' }, { status: 500 })
    }

    const epochTime = Math.floor(Date.now() / 1000).toString()
    const message = companyId + apiKey + epochTime
    const secretKeyBytes = Buffer.from(secretKey, 'base64')
    const messageBytes = Buffer.from(message, 'utf-8')
    const hash = crypto.createHmac('sha256', secretKeyBytes).update(messageBytes).digest('base64')
    const auth = `${companyId}:${apiKey}:${epochTime}:${hash}`

    const baseUrl = 'https://api4.marketsharpm.com/WcfDataService.svc'

    // Fetch first 3 customers and first 3 jobs with $top=3
    const [customersRes, jobsRes] = await Promise.all([
      fetch(`${baseUrl}/Customers?$top=3`, {
        headers: { 'Authorization': auth, 'Accept': 'application/json' },
      }),
      fetch(`${baseUrl}/Jobs?$top=3`, {
        headers: { 'Authorization': auth, 'Accept': 'application/json' },
      }),
    ])

    const customersRaw = await customersRes.json()
    const jobsRaw = await jobsRes.json()

    // Extract the actual arrays
    const customers = Array.isArray(customersRaw.d) ? customersRaw.d :
      customersRaw.d?.results ? customersRaw.d.results :
      customersRaw.value ? customersRaw.value : customersRaw

    const jobs = Array.isArray(jobsRaw.d) ? jobsRaw.d :
      jobsRaw.d?.results ? jobsRaw.d.results :
      jobsRaw.value ? jobsRaw.value : jobsRaw

    return NextResponse.json({
      customersEnvelopeKeys: Object.keys(customersRaw),
      customersFieldNames: Array.isArray(customers) && customers.length > 0 ? Object.keys(customers[0]) : [],
      customersFirstRecord: Array.isArray(customers) && customers.length > 0 ? customers[0] : null,
      customersCount: Array.isArray(customers) ? customers.length : 'not an array',
      jobsEnvelopeKeys: Object.keys(jobsRaw),
      jobsFieldNames: Array.isArray(jobs) && jobs.length > 0 ? Object.keys(jobs[0]) : [],
      jobsFirstRecord: Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null,
      jobsCount: Array.isArray(jobs) ? jobs.length : 'not an array',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
