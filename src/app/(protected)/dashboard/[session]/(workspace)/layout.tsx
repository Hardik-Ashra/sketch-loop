import { ProfileQuery } from "@/convex/query.config";
import { normalizeProfile, ConvexUserRaw } from "@/types/user";
import Navbar from "@/components/navbar/navbar";
import { combineSlug } from "@/lib/utils";
import { redirect } from "next/navigation";
import React from "react";
type Props = {
  children: React.ReactNode;
};
const Layout = async ({ children }: Props) => {
  const rawProfile = await ProfileQuery();
  const profile = normalizeProfile(rawProfile._valueJSON as unknown as ConvexUserRaw | null);
  const profileName = profile?.name;
  return (
    <div className="grid grid-cols-1">
      <Navbar />
      {children}
    </div>
  );
};

export default Layout;
