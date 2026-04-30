import { ProfileQuery } from "@/convex/query.config";
import { normalizeProfile, ConvexUserRaw } from "@/types/user";
import { combineSlug } from "@/lib/utils";
import { redirect } from "next/navigation";

const Page = async () => {
  const rawProfile = await ProfileQuery();
  const profile = normalizeProfile(rawProfile._valueJSON as unknown as ConvexUserRaw | null);
  const profileName = profile?.name;

  redirect(`/dashboard/${combineSlug(profileName!)}`);
};

export default Page;
