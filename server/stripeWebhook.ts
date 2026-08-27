import type { Express, Request, Response } from "express";
import express from "express";
import { getStripeClient } from "./payments";

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || typeof signature !== "string" || !secret) return res.status(400).json({ error: "Missing Stripe webhook signature or configuration." });
    try {
      const event = getStripeClient().webhooks.constructEvent(req.body, signature, secret);
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }
      if (event.type === "checkout.session.completed") console.log("[Webhook] Checkout session completed", { eventId: event.id, sessionId: event.data.object.id });
      return res.json({ received: true });
    } catch (error) {
      console.warn("[Webhook] Signature verification failed", error instanceof Error ? error.message : "Unknown error");
      return res.status(400).json({ error: "Webhook verification failed." });
    }
  });
}
