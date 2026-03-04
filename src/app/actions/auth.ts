'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function resetPassword(email: string) {
    const supabase = await createClient()
    const headerList = await headers()
    const origin = headerList.get('origin') || 'https://www.sitekickapp.com'

    // By sending the reset request from the server, we avoid creating a 
    // browser-only PKCE verifier in the "sending" browser.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}
