# Notification Delivery Research Notes

## SMS delivery state

Twilio supports outbound message status callbacks through HTTP POST requests. The callbacks include a message status and, where a message fails or is undelivered, an error code. Callback timing and ordering are not guaranteed, so the application should treat delivery events as asynchronous updates and use an idempotent event identifier where supplied. Source: [Twilio outbound message status documentation](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status).

## Email delivery state

Resend supports real-time email event webhooks, retries failed callback deliveries, and can replay events. Its webhooks provide at-least-once delivery and do not guarantee order, so a notification ledger should deduplicate using the delivery identifier and use the provider event time for ordering. Source: [Resend webhook documentation](https://resend.com/docs/webhooks/introduction).

## Design implication

For TradieQuote, application events such as a quote acceptance, variation response, or completed Stripe checkout should immediately create a notification intent. Provider callbacks should update delivery state in an append-safe notification ledger; they should never be relied on as the source of truth for the business event itself.
