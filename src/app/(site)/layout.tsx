import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="pb-8">{children}</main>
      <SiteFooter />
    </>
  );
}
