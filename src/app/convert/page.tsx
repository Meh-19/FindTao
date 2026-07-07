import { Suspense } from "react";
import { Converter } from "@/components/Converter";

export default function ConvertPage() {
  return (
    <Suspense>
      <Converter />
    </Suspense>
  );
}
