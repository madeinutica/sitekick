'use server'

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { headers } from 'next/headers'

const resend = new Resend(process.env.RESEND_API_KEY)

function buildEmailHtml(title: string, features: string[], bugFixes: string[], date: string) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

    <!-- Header -->
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Sitekick</h1>
      <p style="margin:6px 0 0;color:#fca5a5;font-size:13px;font-weight:500;">System Update</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${date}</p>
      <h2 style="margin:0 0 24px;color:#0f172a;font-size:22px;font-weight:800;">${title}</h2>

      <p style="margin:0 0 32px;color:#475569;font-size:15px;line-height:1.6;">
        Here's a summary of what changed in Sitekick this week. We've been busy making improvements to help your team work faster and smarter.
      </p>

      ${features.length > 0 ? `
      <!-- New Features -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h3 style="margin:0 0 16px;color:#15803d;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;">
          ✨ &nbsp;What's New
        </h3>
        <ul style="margin:0;padding:0 0 0 20px;">
          ${features.map(f => `<li style="color:#166534;font-size:14px;line-height:1.7;margin-bottom:6px;">${f}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${bugFixes.length > 0 ? `
      <!-- Bug Fixes -->
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h3 style="margin:0 0 16px;color:#c2410c;font-size:15px;font-weight:700;">
          🐛 &nbsp;Bug Fixes
        </h3>
        <ul style="margin:0;padding:0 0 0 20px;">
          ${bugFixes.map(b => `<li style="color:#9a3412;font-size:14px;line-height:1.7;margin-bottom:6px;">${b}</li>`).join('')}
        </ul>
      </div>` : ''}

      <p style="margin:32px 0 0;color:#475569;font-size:15px;line-height:1.6;">
        As always, if you have questions or feedback, just reply to this email. We read every one.
      </p>
      <p style="margin:8px 0 0;color:#475569;font-size:15px;">— The Sitekick Team</p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        You're receiving this because you have a Sitekick account.<br/>
        © ${new Date().getFullYear()} Sitekick. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendSystemUpdate(
    title: string,
    features: string[],
    bugFixes: string[]
): Promise<{ success?: boolean; sentCount?: number; error?: string }> {
    const headerList = await headers()
    const authHeader = headerList.get('x-user-id')

    // Use admin client to fetch all users
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch all user emails from auth.users via admin API
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) return { error: usersError.message }

    const emails = users
        .filter(u => !!u.email)
        .map(u => u.email as string)

    if (emails.length === 0) return { error: 'No users found to email.' }

    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const html = buildEmailHtml(title, features, bugFixes, date)

    // Resend batch limit is 50 per call, so we send in batches
    const BATCH_SIZE = 50
    const batches = []
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        batches.push(emails.slice(i, i + BATCH_SIZE))
    }

    try {
        for (const batch of batches) {
            await resend.emails.send({
                from: 'Sitekick Updates <noreply@updates.sitekickapp.com>',
                to: batch,
                subject: `Sitekick Update: ${title}`,
                html,
            })
        }
    } catch (err: any) {
        return { error: `Failed to send emails: ${err.message}` }
    }

    // Save to history
    const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(authHeader ?? '')
    await supabaseAdmin.from('system_updates').insert({
        title,
        features,
        bug_fixes: bugFixes,
        recipient_count: emails.length,
        created_by: currentUser?.user?.id ?? null,
    })

    return { success: true, sentCount: emails.length }
}

export async function getSystemUpdates() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data, error } = await supabaseAdmin
        .from('system_updates')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20)

    if (error) return { error: error.message }
    return { data }
}
