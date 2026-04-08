import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

type CheckoutResponse = {
    url: string
}

export const BillingApi = createApi({
    reducerPath: 'billing',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/billing' }),
    endpoints: (builder) => ({
        getCheckout: builder.query<CheckoutResponse, string>({
            query: (userId) => ({
                url: '/checkout',
                method: 'GET',
                params: {
                    userId,
                },
            }),
        }),
    }),
})

export const { useLazyGetCheckoutQuery } = BillingApi
