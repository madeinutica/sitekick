'use server'

import { createServerClient } from '@supabase/ssr'
import { headers, cookies } from 'next/headers'

export async function resetPassword(email: string) {
    const headerList = await headers()
    const cookieStore = await cookies()
    const origin = headerList.get('origin') || 'https://www.sitekickapp.com'

    // Use the 'implicit' flow so the email link contains the token in the URL fragment
    // (e.g. #access_token=...) instead of a ?code= param.
    // PKCE requires the same browser that requested the email to also click the link --
    // which breaks inside email apps like Gmail. Implicit flow has no such requirement.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                flowType: 'implicit',
            },
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set() { },
                remove() { },
            },
        }
    )

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}
