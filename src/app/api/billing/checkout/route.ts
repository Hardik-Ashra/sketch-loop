import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";

/**
 * GET /api/billing/checkout?userId=<id>
 *
 * Creates a Polar checkout session and returns { url: string }.
 * Returns 400 if userId is missing, 500 with a JSON error body on any failure.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json(
            { error: "userId is required" },
            { status: 400 }
        );
    }

    // Validate required env vars up-front so errors are obvious in logs
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    const productId = process.env.POLAR_STANDARD_PLAN;
    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;

    if (!accessToken) {
        console.error("[billing/checkout] POLAR_ACCESS_TOKEN is not set");
        return NextResponse.json(
            { error: "Billing service is not configured correctly." },
            { status: 500 }
        );
    }

    if (!productId) {
        console.error("[billing/checkout] POLAR_STANDARD_PLAN is not set");
        return NextResponse.json(
            { error: "Billing service is not configured correctly." },
            { status: 500 }
        );
    }

    try {
        const polar = new Polar({
            server:
                process.env.POLAR_ENV === "sandbox" ? "sandbox" : "production",
            accessToken,
        });

        const session = await polar.checkouts.create({
            products: [productId],
            successUrl: `${appUrl}/billing/success`,
            metadata: {
                userId,
            },
        });

        if (!session.url) {
            console.error("[billing/checkout] Polar returned no URL", session);
            return NextResponse.json(
                { error: "Checkout session was created but returned no URL." },
                { status: 500 }
            );
        }

        return NextResponse.json({ url: session.url });
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : "Unknown error";
        console.error("[billing/checkout] Polar SDK error:", message, err);
        return NextResponse.json(
            { error: `Could not create checkout session: ${message}` },
            { status: 500 }
        );
    }
}