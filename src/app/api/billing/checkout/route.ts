import { Polar } from '@polar-sh/sdk'
import { NextRequest, NextResponse } from 'next/server'

const REQUIRED_ENV_VARS = [
    'POLAR_ACCESS_TOKEN',
    'POLAR_STANDARD_PLAN',
    'NEXT_PUBLIC_APP_URL',
] as const

const getMissingEnvVars = () =>
    REQUIRED_ENV_VARS.filter((name) => !process.env[name])

/**
 * Creates a Polar checkout session for the provided `userId` and returns the session URL.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const missingEnvVars = getMissingEnvVars()

    if (missingEnvVars.length > 0) {
        console.error('Checkout configuration error:', { missingEnvVars })
        return NextResponse.json(
            { error: 'Checkout is not configured. Please contact support.' },
            { status: 500 },
        )
    }

    try {
        const polar = new Polar({
            server: process.env.POLAR_ENV === 'sandbox' ? 'sandbox' : 'production',
            accessToken: process.env.POLAR_ACCESS_TOKEN!,
        })

        const session = await polar.checkouts.create({
            products: [process.env.POLAR_STANDARD_PLAN!],
            successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
            metadata: {
                userId,
            },
        })

        if (!session.url) {
            return NextResponse.json(
                { error: 'Checkout session could not be created.' },
                { status: 500 },
            )
        }

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.error('Checkout session creation failed:', error)
        return NextResponse.json(
            { error: 'Unable to start checkout right now. Please try again later.' },
            { status: 500 },
        )
    }
}
