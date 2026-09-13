import type { Metadata } from "next";
import { InstallClient } from "./InstallClient";

export const metadata: Metadata = {
  title: "Install the app",
  description:
    "Add Vermont Pickup Soccer to your home screen and get notified when a field, signup, or request needs review.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/install" },
};

export default function InstallPage() {
  return <InstallClient />;
}
