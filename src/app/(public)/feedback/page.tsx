"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from "@arcevo/facet-components";

export default function FeedbackPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // v1: local confirmation only. Wire to a backend endpoint or mail
    // service when the public site gains one.
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Feedback</CardTitle>
          <CardDescription>
            We&apos;d love to hear your thoughts, suggestions, or any issues you&apos;ve
            encountered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-8">
              <p className="text-lg font-medium text-foreground">Thank you!</p>
              <p className="text-sm text-muted-foreground">
                Your feedback has been received.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us what's on your mind…"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Send feedback
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
