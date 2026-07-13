import { Suspense } from "react";
import { AiAdvisor } from "@/components/AiAdvisor";

export default function AdvisorPage() {
  return (
    <Suspense>
      <AiAdvisor />
    </Suspense>
  );
}
