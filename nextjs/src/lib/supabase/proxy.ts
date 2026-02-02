import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/lib/types'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {data: user} = await supabase.auth.getUser()

    // Redirect to login if not authenticated and trying to access protected routes
    if (
        (!user || !user.user) && request.nextUrl.pathname.startsWith('/app')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    // Handle role-based access control for authenticated users
    if (user && user.user) {
        const pathname = request.nextUrl.pathname

        // Check access to /admin/* routes (system admin only)
        if (pathname.startsWith('/admin')) {
            const { data: isSystemAdmin } = await supabase.rpc('is_system_admin')

            if (!isSystemAdmin) {
                const url = request.nextUrl.clone()
                url.pathname = '/app'
                return NextResponse.redirect(url)
            }
        }

        // Check access to /app/org/[slug]/* routes (org members or system admin)
        const orgMatch = pathname.match(/^\/app\/org\/([^\/]+)/)
        if (orgMatch) {
            const orgSlug = orgMatch[1]

            // Get organization by slug
            const { data: orgData } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', orgSlug)
                .single()

            if (orgData) {
                const org = orgData as { id: string }
                // Check if user is system admin or org member
                const { data: isSystemAdmin } = await supabase.rpc('is_system_admin')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: isOrgMember } = await (supabase as any).rpc('is_org_member', { org_id: org.id })

                if (!isSystemAdmin && !isOrgMember) {
                    const url = request.nextUrl.clone()
                    url.pathname = '/app'
                    return NextResponse.redirect(url)
                }
            }
        }
    }

    // Handle participant access via token for /q/[token]/* routes
    const participantMatch = request.nextUrl.pathname.match(/^\/q\/([^\/]+)/)
    if (participantMatch) {
        const token = participantMatch[1]

        // Validate token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tokenValidation } = await (supabase as any).rpc('validate_participant_token', {
            token_value: token
        })

        if (!tokenValidation || tokenValidation.length === 0 || !tokenValidation[0].is_valid) {
            const url = request.nextUrl.clone()
            url.pathname = '/invalid-token'
            return NextResponse.redirect(url)
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}