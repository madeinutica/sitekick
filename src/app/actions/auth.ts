'use server'

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function resetPassword(email: string) {
    const headerList = await headers()
    const origin = headerList.get('origin') || 'https://www.sitekickapp.com'

    // Use admin client to generate a recovery link directly.
    // This gives us raw tokens that we can put in the URL hash (#),
    // which is the implicit flow and works in ANY browser without a PKCE code verifier.
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error: genError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
            // This is NOT used as the redirect URL -- we build our own link below.
            // We pass it anyway so Supabase records a valid redirect origin.
            redirectTo: `${origin}/reset-password`,
        },
    })

    if (genError || !data) {
        return { error: genError?.message ?? 'Failed to generate reset link' }
    }

    // data.properties contains the raw token info.
    // We build a link pointing directly to our page with the token in the URL hash.
    // This completely bypasses PKCE -- no code verifier needed.
    const { hashed_token } = data.properties as { hashed_token: string }
    const resetLink = `${origin}/reset-password#access_token=${hashed_token}&token_type=bearer&type=recovery`

    try {
        await resend.emails.send({
            from: 'Sitekick <noreply@updates.sitekickapp.com>',
            to: email,
            subject: 'Reset your Sitekick password',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                    <h2 style="color:#1a1a1a;margin-bottom:8px;">Reset your password</h2>
                    <p style="color:#555;margin-bottom:24px;">
                        Click the button below to set a new password for your Sitekick account.
                        This link expires in 1 hour.
                    </p>
                    <a href="${resetLink}"
                       style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                        Reset Password
                    </a>
                    <p style="color:#999;font-size:12px;margin-top:24px;">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                </div>
            `,
        })
    } catch (emailError: any) {
        console.error('Failed to send reset email:', emailError)
        return { error: 'Failed to send reset email. Please try again.' }
    }

    return { success: true }
}
