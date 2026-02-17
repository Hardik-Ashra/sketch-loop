import { SubscriptionEntitlementQuery } from "@/convex/query.config";
import Navbar from "@/components/navbar/navbar";
import { combineSlug } from "@/lib/utils";
import { redirect } from "next/navigation";
import React from "react";
type Props = {
  children: React.ReactNode;
};
const Layout = async ({ children }: Props) => {
  const { profileName, entitlement } = await SubscriptionEntitlementQuery();
  if (!entitlement._valueJSON) {
    redirect(`/billing/${combineSlug(profileName!)}`);
  }
  return (
    <div className="grid grid-cols-1">
      <Navbar />
      {children}
    </div>
  );
};

export default Layout;
