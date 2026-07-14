'use client'

import * as RadixTabs from '@radix-ui/react-tabs'

export function Tabs(props) {
  return <RadixTabs.Root {...props} />
}

export function TabsList(props) {
  return <RadixTabs.List className="tabs-list" {...props} />
}

export function TabsTrigger(props) {
  return <RadixTabs.Trigger className="tabs-trigger" {...props} />
}

export function TabsContent(props) {
  return <RadixTabs.Content {...props} />
}
