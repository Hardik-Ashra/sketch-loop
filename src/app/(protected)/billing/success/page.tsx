"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";

const Page = () => {
  const router = useRouter();
  const redirected = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  // 1) Current user
  const me = useQuery(api.user.getCurrentUser);

  // 2) Entitlement
  const entitled = useQuery(
    api.subscription.hasEntitlement,
    me?._id ? { userId: me._id as Id<"users"> } : "skip",
  );

  // ✅ Redirect Logic (FIXED)
  useEffect(() => {
    if (redirected.current) return;

    // wait until user resolved
    if (me === undefined) return;

    if (me === null) {
      redirected.current = true;
      router.replace("/auth/sign-in");
      return;
    }

    // wait until entitlement resolved
    if (entitled === undefined) return;

    // 🔥 IMPORTANT: explicitly check === true
    if (entitled === true) {
      redirected.current = true;
      router.replace("/dashboard");
      return;
    }
  }, [me, entitled, router]);

  // ✅ Timeout only AFTER entitlement finished loading
  useEffect(() => {
    if (redirected.current) return;

    if (!me?._id) return;
    if (entitled === undefined) return; // ← wait for result
    if (entitled === true) return;

    const t = setTimeout(() => {
      if (redirected.current) return;
      setTimedOut(true);
      redirected.current = true;
      router.replace(`/billing/${me.name}`);
    }, 45000);

    return () => clearTimeout(t);
  }, [me, entitled, router]);

  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <div className="mb-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent align-[-2px]" />
      </div>
      <div className="mb-1 text-lg">Finalizing your subscription...</div>
      <div className="text-sm text-gray-500" aria-live="polite">
        {me === undefined
          ? "Checking your account..."
          : entitled === undefined
            ? "Confirming your entitlement..."
            : timedOut
              ? "Taking longer than expected - redirecting to billing."
              : "This should only take a few seconds."}
      </div>
    </div>
  );
};

export default Page;
