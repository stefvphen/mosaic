import { SiteHeader } from '@/components/shell/SiteHeader'

export default function PublicLayout({ children }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
    </>
  )
}
