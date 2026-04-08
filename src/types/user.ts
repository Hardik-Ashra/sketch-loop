import { combineSlug } from "@/lib/utils"

export type ConvexUserRaw = {
    _creationTime: number
    _id: string
    email: string
    emailVerificationTime?: number
    image?: string
    name?: string
}

export type Profile = {
    id: string
    createdAtMs: number
    email: string
    emailVerifiedAtMs?: number
    image?: string
    name?: string
}

/** Derive a human-readable display name from an email address. */
const extractNameFromEmail = (email: string): string => {
    const username = email.split("@")[0];
    return username
        .split(/[._-]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
};

export const normalizeProfile = (
    raw: ConvexUserRaw | null
): Profile | null => {
    if (!raw) return null;

    // Use the raw name if present; fall back to a name generated from the email.
    // Note: combineSlug is only used for slug/ID purposes elsewhere – do NOT
    // run the display name through it here, as it strips spaces and lowercases.
    const name =
        raw.name && raw.name.trim().length > 0
            ? raw.name.trim()
            : extractNameFromEmail(raw.email);

    return {
        id: raw._id,
        createdAtMs: raw._creationTime,
        email: raw.email,
        emailVerifiedAtMs: raw.emailVerificationTime,
        image: raw.image,
        name,
    };
};

/** Generate a URL-safe slug from a profile name. */
export const profileSlug = (name: string): string => combineSlug(name);