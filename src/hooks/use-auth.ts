"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  signInSchema,
  signUpSchema,
  type SignInData,
  type SignUpData,
} from "@/lib/validators/auth";

export const useAuth = () => {
  const { signIn, signOut } = useAuthActions();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);

  /* ─── Forms ───────────────────────────────────────────── */

  const signInForm = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  /* ─── Handlers ────────────────────────────────────────── */

  const handleSignIn = async (data: SignInData) => {
    setIsSigningIn(true);
    try {
      await signIn("password", {
        email: data.email,
        password: data.password,
        flow: "signIn",
      });
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (error) {
      console.error("Sign-in error:", error);
      signInForm.setError("root", {
        message: "Invalid email or password",
      });
      toast.error("Invalid email or password");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (data: SignUpData) => {
    setIsSigningUp(true);
    try {
      await signIn("password", {
        email: data.email,
        password: data.password,
        name: `${data.firstName} ${data.lastName}`,
        flow: "signUp",
      });
      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (error) {
      console.error("Sign-up error:", error);
      signUpForm.setError("root", {
        message: "Failed to create account. Email may already be in use.",
      });
      toast.error("Failed to create account");
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsOAuthLoading("google");
    try {
      await signIn("google");
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setIsOAuthLoading(null);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/auth/sign-in");
    } catch (error) {
      console.error("Sign-out error:", error);
      toast.error("Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  /* ─── Computed ────────────────────────────────────────── */

  const isLoading = isSigningIn || isSigningUp || isSigningOut || !!isOAuthLoading;

  return {
    // Forms
    signInForm,
    signUpForm,
    // Handlers
    handleSignIn,
    handleSignUp,
    handleGoogleSignIn,
    handleSignOut,
    // Loading states
    isLoading,
    isSigningIn,
    isSigningUp,
    isSigningOut,
    isOAuthLoading,
  };
};