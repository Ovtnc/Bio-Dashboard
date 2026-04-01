import { AppHeader } from "@/components/layout/app-header";
import { BioItSaasLanding } from "@/components/landing/bio-it-saas-landing";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <BioItSaasLanding />
    </div>
  );
}

