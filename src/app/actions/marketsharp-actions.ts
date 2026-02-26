'use server'

import { createClient } from '@/lib/supabase/server'
import { uploadJobAttachment } from '@/lib/marketsharp/restClient'
import { MarketSharpConfig } from '@/lib/marketsharp/client'

/**
 * Syncs a photo from Supabase Storage back to MarketSharp
 */
export async function syncPhotoToMarketSharp(photoId: number) {
    const supabase = await createClient()

    // 1. Fetch photo details and its linked job
    const { data: photo, error: photoError } = await supabase
        .from('job_photos')
        .select('*, jobs(company_id, marketsharp_job_id)')
        .eq('id', photoId)
        .single()

    if (photoError || !photo) {
        throw new Error(`Photo not found: ${photoError?.message}`)
    }

    const job = photo.jobs as any
    if (!job?.marketsharp_job_id) {
        console.log('Skipping sync: Job not linked to MarketSharp')
        return { success: false, message: 'Job not linked to MarketSharp' }
    }

    // 2. Get company config
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('marketsharp_config')
        .eq('id', job.company_id)
        .single()

    if (companyError || !company?.marketsharp_config) {
        throw new Error(`MarketSharp config not found for company ${job.company_id}`)
    }

    const config = company.marketsharp_config as unknown as MarketSharpConfig

    try {
        // 3. Download photo from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('photos')
            .download(photo.image_url.split('/').pop()!) // Simple extraction of filename from URL

        if (downloadError || !fileData) {
            throw new Error(`Failed to download photo from storage: ${downloadError?.message}`)
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())

        // 4. Upload to MarketSharp
        const result = await uploadJobAttachment(
            {
                companyId: config.companyId,
                apiKey: config.apiKey,
                secretKey: config.secretKey
            },
            job.marketsharp_job_id,
            buffer,
            `Sitekick_${photoId}.jpg`
        )

        // 5. Update local record with sync status
        await supabase
            .from('job_photos')
            .update({
                ms_sync_status: 'synced',
                ms_sync_at: new Date().toISOString()
            })
            .eq('id', photoId)

        return { success: true, result }
    } catch (error: any) {
        console.error('MarketSharp Sync Error:', error)

        await supabase
            .from('job_photos')
            .update({ ms_sync_status: 'failed' })
            .eq('id', photoId)

        throw error
    }
}
