import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Chandigarh Fastfood",
  description: "Thoughtful local food, delivered with clarity.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
