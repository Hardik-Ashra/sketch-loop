import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import {
    validateEvent,
    WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { isPolarwebhookEvent, type PolarWebhookEvent } from "@/types/polar";

/**
 * Handle incoming Polar webhook POST requests: verify signature, validate payload shape,
 * dispatch a "polar/webhook.received" ingress event for processing, and return an HTTP response.
 *
 * @param req - The incoming Next.js request containing the webhook payload and headers
 * @returns A NextResponse:
 * - 500 with body "Missing POLAR_WEBHOOK_SECRET" if the webhook secret is not configured
 * - 403 with body "Invalid signature" if signature verification fails
 * - 400 with body "Unsupported event shape" if the payload does not match the expected Polar webhook shape
 * - 500 with body "Failed to process webhook" if dispatching the ingress event fails
 * - 200 JSON `{ ok: true }` on successful processing
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    const secret = process.env.POLAR_WEBHOOK_SECRET ?? "";
    if (!secret) {
        return new NextResponse("Missing POLAR_WEBHOOK_SECRET", { status: 500 });
    }

    const raw = await req.arrayBuffer();

    const headersObject = Object.fromEntries(req.headers);
    let verified: unknown;
    try {
        verified = validateEvent(Buffer.from(raw), headersObject, secret);
    } catch (err) {
        if (err instanceof WebhookVerificationError) {
            return new NextResponse("Invalid signature", { status: 403 });
        }
        throw err;
    }
    if (!isPolarwebhookEvent(verified)) {
        return new NextResponse("Unsupported event shape", { status: 400 });
    }

    const evt: PolarWebhookEvent = verified;
    const id = String(evt.id ?? Date.now());

    try {
        await inngest.send({
            name: "polar/webhook.received",
            id,
            data: evt,
        })
    } catch (error) {
        console.error(error);
        return new NextResponse("Failed to process webhook", { status: 500 });
    }

    return NextResponse.json({ ok: true });
}