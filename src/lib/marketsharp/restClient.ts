/**
 * MarketSharp Momentum REST API Client (v1.0)
 * 
 * Unlike the OData API, this REST API supports POST/PUT operations
 * for uploading attachments, adding notes, etc.
 * 
 * Authentication:
 * 1. POST /token with HMAC-auth to get a Bearer token
 * 2. Use Bearer token for subsequent requests
 */

import crypto from 'crypto'

interface MarketSharpConfig {
    companyId: string
    apiKey: string
    secretKey: string
    baseUrl?: string
}

const DEFAULT_REST_URL = 'https://restapi.marketsharpm.com'

/**
 * Generate HMAC auth header for token request
 */
function generateHMACAuth(config: MarketSharpConfig): string {
    const epochTime = Math.floor(Date.now() / 1000).toString()
    const message = config.companyId + config.apiKey + epochTime
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64')
    const messageBytes = Buffer.from(message, 'utf-8')

    const hash = crypto
        .createHmac('sha256', secretKeyBytes)
        .update(messageBytes)
        .digest('base64')

    return `${config.companyId}:${config.apiKey}:${epochTime}:${hash}`
}

/**
 * Get a Bearer token from MarketSharp
 */
async function getAccessToken(config: MarketSharpConfig): Promise<string> {
    const auth = generateHMACAuth(config)
    const baseUrl = config.baseUrl || DEFAULT_REST_URL

    const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
            'Authorization': auth,
            'Accept': 'application/json',
        },
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`MarketSharp Token Error ${response.status}: ${text}`)
    }

    const data = await response.json()
    return data.access_token
}

/**
 * Upload an image as an attachment to a job (note) in MarketSharp
 */
export async function uploadJobAttachment(
    config: MarketSharpConfig,
    marketsharpJobId: string,
    imageBuffer: Buffer,
    fileName: string,
    contentType: string = 'image/jpeg'
) {
    const token = await getAccessToken(config)
    const baseUrl = config.baseUrl || DEFAULT_REST_URL

    // MARKETSHARP API NOTE: 
    // Based on Momentum API docs, attachments are often uploaded via:
    // POST /companies/{companyId}/jobs/{jobId}/attachments
    // OR as part of a Note.

    const url = `${baseUrl}/companies/${config.companyId}/jobs/${marketsharpJobId}/attachments`

    const formData = new FormData()
    // Use Uint8Array since it's compatible with Blob and Buffer
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: contentType })
    formData.append('file', blob, fileName)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`MarketSharp Upload Error ${response.status}: ${text}`)
    }

    return await response.json()
}
