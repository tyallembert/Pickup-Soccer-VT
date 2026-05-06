import { QueueClient } from "./QueueClient";

export default function QueuePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Moderation queue</h1>
      <QueueClient />
    </section>
  );
}
