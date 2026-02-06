'use client'

import { ReactNode, useRef } from 'react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { RootState } from './store'


const ReduxProvider = ({
    children,
    preloadedState,
}: {
    children: ReactNode
    preloadedState?: Partial<RootState>
}) => {
    const storeRef = useRef(makeStore(preloadedState))
    return <Provider store={storeRef.current}> {children} </Provider>
}
export default ReduxProvider