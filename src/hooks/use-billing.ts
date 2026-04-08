import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useLazyGetCheckoutQuery } from '@/redux/api/billing'
import { useAppSelector } from '@/redux/store'
import { toast } from 'sonner'

const CHECKOUT_FALLBACK_ERROR = 'Could not start checkout. Please try again.'

export const useSubscriptionPlan = () => {
    const [trigger, { isFetching }] = useLazyGetCheckoutQuery()
    const id = useAppSelector((state) => state.profile.user?.id)

    const onSubscribe = async () => {
        if (!id) {
            toast.error('You need to be signed in to subscribe.')
            return
        }

        try {
            const res = await trigger(id, true).unwrap()

            if (!res?.url) {
                toast.error(CHECKOUT_FALLBACK_ERROR)
                return
            }

            window.location.assign(res.url)
        } catch (err) {
            const error = err as FetchBaseQueryError & {
                data?: { message?: string } | string | null
            }

            let message = CHECKOUT_FALLBACK_ERROR

            if (typeof error?.data === 'string') {
                message = error.data
            } else if (
                error?.data &&
                typeof error.data === 'object' &&
                'message' in error.data &&
                typeof error.data.message === 'string'
            ) {
                message = error.data.message
            }

            console.error('Checkout error:', err)
            toast.error(message)
        }
    }

    return { onSubscribe, isFetching }
}
