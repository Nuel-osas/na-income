import Checker from "@/components/Checker";
import { Hero, HowItWorks, LawTable, Pricing, SiteFooter, SiteHeader, SplitBar } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 sm:px-6">
        <Hero />
        <SplitBar />
        <Checker />
        <HowItWorks />
        <Pricing />
        <LawTable />
      </main>
      <SiteFooter />
    </>
  );
}
