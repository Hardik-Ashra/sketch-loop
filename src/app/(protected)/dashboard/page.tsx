import { SubscriptionEntitlementQuery } from '@/app/convex/query.config'
import { combineSlug } from '@/lib/utils';
import { redirect } from 'next/navigation';


const Page = async () => {
    const { entitlement, profileName } = await SubscriptionEntitlementQuery();
    if (!entitlement._valueJSON) {
        redirect(`/dashboard/${combineSlug(profileName!)}`)
    }
    redirect(`/dashboard/${combineSlug(profileName!)}`)

}

export default Page