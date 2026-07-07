import { redirect } from "next/navigation";

export default function LegacyHaulRedirect() {
  redirect("/hauls");
}
