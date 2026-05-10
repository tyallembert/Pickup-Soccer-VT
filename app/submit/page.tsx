import type { Metadata } from "next";
import { SubmitForm } from "./SubmitForm";

export const metadata: Metadata = {
  title: "Add a Pickup Soccer Field — Vermont",
  description:
    "Know a weekly pickup soccer game in Vermont? Submit the field, day, and time and we'll add it to the directory after a quick review.",
  alternates: { canonical: "/submit" },
  openGraph: {
    title: "Add a Pickup Soccer Field — Vermont",
    description:
      "Submit a weekly pickup soccer game to the Vermont directory.",
    url: "/submit",
    type: "website",
  },
};

export default function SubmitPage() {
  return <SubmitForm />;
}
