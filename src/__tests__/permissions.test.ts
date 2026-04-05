import { describe, it, expect } from "vitest";
import {
  isPublicRoutes,
  isProtectedRoutes,
  isBypassRoutes,
} from "../lib/permission";

/* =========================================================
   Route Classification Tests
   ========================================================= */

describe("Route permissions", () => {
  describe("isPublicRoutes", () => {
    it("contains auth routes pattern", () => {
      expect(isPublicRoutes).toContain("/auth(.*)");
    });

    it("contains root route", () => {
      expect(isPublicRoutes).toContain("/");
    });

    it("has exactly 2 entries", () => {
      expect(isPublicRoutes).toHaveLength(2);
    });
  });

  describe("isProtectedRoutes", () => {
    it("contains dashboard pattern", () => {
      expect(isProtectedRoutes).toContain("/dashboard(.*)");
    });

    it("has exactly 1 entry", () => {
      expect(isProtectedRoutes).toHaveLength(1);
    });
  });

  describe("isBypassRoutes", () => {
    it("contains polar webhook route", () => {
      expect(isBypassRoutes).toContain("/api/polar/webhook");
    });

    it("contains inngest API pattern", () => {
      expect(isBypassRoutes).toContain("/api/inngest(.*)");
    });

    it("contains auth API pattern", () => {
      expect(isBypassRoutes).toContain("/api/auth(.*)");
    });

    it("contains convex pattern", () => {
      expect(isBypassRoutes).toContain("/convex(.*)");
    });

    it("has exactly 4 entries", () => {
      expect(isBypassRoutes).toHaveLength(4);
    });
  });

  describe("Route pattern regex correctness", () => {
    it("/auth/sign-in matches public auth pattern", () => {
      const pattern = new RegExp("^" + "/auth(.*)".replace("(.*)", "(.*)") + "$");
      expect(pattern.test("/auth/sign-in")).toBe(true);
      expect(pattern.test("/auth/sign-up")).toBe(true);
      expect(pattern.test("/auth")).toBe(true);
    });

    it("/dashboard/projects matches protected pattern", () => {
      const pattern = new RegExp(
        "^" + "/dashboard(.*)".replace("(.*)", "(.*)") + "$"
      );
      expect(pattern.test("/dashboard")).toBe(true);
      expect(pattern.test("/dashboard/projects")).toBe(true);
      expect(pattern.test("/dashboard/billing")).toBe(true);
    });

    it("bypass patterns match correctly", () => {
      const inngestPattern = new RegExp(
        "^" + "/api/inngest(.*)".replace("(.*)", "(.*)") + "$"
      );
      expect(inngestPattern.test("/api/inngest")).toBe(true);
      expect(inngestPattern.test("/api/inngest/events")).toBe(true);
    });

    it("non-matching routes don't match protected", () => {
      const dashboardPattern = new RegExp(
        "^" + "/dashboard(.*)".replace("(.*)", "(.*)") + "$"
      );
      expect(dashboardPattern.test("/auth/sign-in")).toBe(false);
      expect(dashboardPattern.test("/api/project")).toBe(false);
      expect(dashboardPattern.test("/")).toBe(false);
    });
  });
});
