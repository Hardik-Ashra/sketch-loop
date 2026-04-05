import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema } from "../lib/validators/auth";
import { normalizeProfile, ConvexUserRaw } from "../types/user";

/* =========================================================
   signInSchema
   ========================================================= */

describe("signInSchema", () => {
  it("accepts a valid email + password", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const result = signInSchema.safeParse({
      email: "",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 6 chars", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password exactly 6 chars", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(signInSchema.safeParse({}).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.c" }).success).toBe(false);
    expect(signInSchema.safeParse({ password: "123456" }).success).toBe(false);
  });
});

/* =========================================================
   signUpSchema
   ========================================================= */

describe("signUpSchema", () => {
  const validData = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "Secret1234",
  };

  it("accepts valid sign-up data", () => {
    const result = signUpSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects first name shorter than 2 chars", () => {
    const result = signUpSchema.safeParse({ ...validData, firstName: "J" });
    expect(result.success).toBe(false);
  });

  it("rejects last name shorter than 2 chars", () => {
    const result = signUpSchema.safeParse({ ...validData, lastName: "D" });
    expect(result.success).toBe(false);
  });

  it("rejects first name longer than 50 chars", () => {
    const result = signUpSchema.safeParse({
      ...validData,
      firstName: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({ ...validData, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = signUpSchema.safeParse({ ...validData, password: "Short1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: "alllowercase1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without a number", () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: "NoNumberHere",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password with uppercase + number + 8 chars", () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: "Abcdefg1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when all fields are missing", () => {
    const result = signUpSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

/* =========================================================
   normalizeProfile
   ========================================================= */

describe("normalizeProfile", () => {
  it("returns null for null input", () => {
    expect(normalizeProfile(null)).toBeNull();
  });

  it("normalizes a user with a name", () => {
    const raw: ConvexUserRaw = {
      _id: "abc123",
      _creationTime: 1700000000000,
      email: "test@example.com",
      name: "John Doe",
    };
    const result = normalizeProfile(raw);
    expect(result).toEqual({
      id: "abc123",
      createdAtMs: 1700000000000,
      email: "test@example.com",
      name: "johndoe",
      image: undefined,
      emailVerifiedAtMs: undefined,
    });
  });

  it("extracts name from email when name is undefined", () => {
    const raw: ConvexUserRaw = {
      _id: "xyz789",
      _creationTime: 1700000000000,
      email: "jane.smith@example.com",
    };
    const result = normalizeProfile(raw);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Jane Smith");
  });

  it("includes emailVerifiedAtMs when present", () => {
    const raw: ConvexUserRaw = {
      _id: "v123",
      _creationTime: 1700000000000,
      email: "verified@example.com",
      emailVerificationTime: 1700001000000,
    };
    const result = normalizeProfile(raw);
    expect(result!.emailVerifiedAtMs).toBe(1700001000000);
  });

  it("includes image when present", () => {
    const raw: ConvexUserRaw = {
      _id: "img1",
      _creationTime: 1700000000000,
      email: "img@example.com",
      image: "https://example.com/avatar.jpg",
    };
    const result = normalizeProfile(raw);
    expect(result!.image).toBe("https://example.com/avatar.jpg");
  });

  it("handles email with special separators for name extraction", () => {
    const raw: ConvexUserRaw = {
      _id: "sep1",
      _creationTime: 1700000000000,
      email: "first_last-name.extra@example.com",
    };
    const result = normalizeProfile(raw);
    expect(result!.name).toBe("First Last Name Extra");
  });
});
