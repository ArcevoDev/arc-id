import { buildMetadata } from "@/components/metadata";
import { FeedbackContent } from "./_components/feedback-content";

export const metadata = buildMetadata({
  title: "Feedback",
  description: "Have a question, bug report, or feature request? Let us know.",
  path: "/feedback",
});

export default function FeedbackPage() {
  return <FeedbackContent />;
}
