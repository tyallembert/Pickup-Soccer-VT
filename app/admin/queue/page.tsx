import type { Metadata } from "next";
import { QueueClient } from "./QueueClient";

export const metadata: Metadata = { title: "Approvals" };

export default function QueuePage() {
  return <QueueClient />;
}
