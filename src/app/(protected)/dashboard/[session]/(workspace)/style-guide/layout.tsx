import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Hash, LayoutIcon, Type } from 'lucide-react'
import React from 'react'
type Props = {
    children: React.ReactNode
}

const tabs = [
    {
        value: 'colours',
        label: 'Colours',
        icon: Hash
    },
    {
        value: 'typography',
        label: 'Typography',
        icon: Type
    },
    {
        value: 'moodboard',
        label: 'Moodboard',
        icon: LayoutIcon
    }
] as const
const Layout = ({ children }: Props) => {
    return <Tabs
        defaultValue='colours'
        className='w-full'
    >
        <div className='mt-36 container mx-auto px-4 sm:px-6 py-6 sm:py-8'>
            <div >
                <div className='flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-5'>
                    <div>
                        <h1 className='text-3xl lg:text-left text-center font-bold text-foreground'>Style Guide</h1>
                        <p className='text-muted-foreground mt-2 text-center lg:text-left'>Manage your style guide for your project
                        </p>
                    </div>
                    <TabsList className='grid w-full sm:w-fit h-auto grid-cols-3 rounded-full backdrop-blur-xl bg-white/8 border border-white/12 saturate-150 p-1'>
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className='flex items-center gap-2 rounded-xl data-[state=active]:bg-white/15 data-[state=active]:backdrop-blur-xl data-[state=active]:border data-[state=active]:border-white/2 transition-all duration-100 text-xs sm:text-sm'>
                                    <Icon className='w-4 h-4' />
                                    <span className='hidden sm:inline'>{tab.label}</span>
                                    <span className='sm:hidden'>{tab.value}</span>
                                </TabsTrigger>
                            )
                        })}
                    </TabsList>
                </div>
            </div>
            <div className='container mx-auto px-4 sm:px-6 py-6 sm:py-8'>
                {children}
            </div>
        </div>
    </Tabs>
}

export default Layout