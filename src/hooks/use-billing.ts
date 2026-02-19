import { useLazyGetCheckoutQuery } from '@/redux/api/billing'
import { useAppSelector } from '@/redux/store'
import { toast } from 'sonner'

export const useSubscriptionPlan = () => {
    const [trigger, { isFetching }] = useLazyGetCheckoutQuery()
    console.log("trigger", trigger, isFetching)
    const { id } = useAppSelector((state) => state.profile)
    console.log(id)
    const onSubscribe = async () => {
        try {
            const res = await trigger(id).unwrap()
            console.log(res)
            window.location.href = res.url
        } catch (err) {
            console.error('Checkout error: ', err)
            toast.error('Could not start checkout. Please try again. ')
        }
    }
    return { onSubscribe, isFetching }
}