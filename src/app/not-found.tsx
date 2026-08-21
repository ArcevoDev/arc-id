import { NotFound } from "@arcevo/facet-components";

export default function NotFoundPage() {
  return (
    <NotFound
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
      actionLabel="Go home"
      actionHref="/"
      animation="gradient"
    />
  );
}
