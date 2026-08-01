import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

/** PWA manifest — lets the app be installed to a home screen and gives mobile
 *  browsers the right name, colours, and icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — find it, QC it, hand it to your agent`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
