import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Payments are not configured. Open Settings → Payment to finish the Stripe setup.");
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export async function createCheckoutPaymentLink(input: {
  origin: string;
  userId: number;
  customerEmail?: string | null;
  customerName?: string | null;
  paymentRequestId: number;
  jobId: number;
  title: string;
  description?: string | null;
  amountCents: number;
}) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: input.customerEmail || undefined,
    client_reference_id: String(input.userId),
    allow_promotion_codes: true,
    metadata: {
      user_id: String(input.userId),
      job_id: String(input.jobId),
      payment_request_id: String(input.paymentRequestId),
      customer_email: input.customerEmail || "",
      customer_name: input.customerName || "",
    },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "aud",
        unit_amount: input.amountCents,
        product_data: { name: input.title, description: input.description || undefined },
      },
    }],
    success_url: `${input.origin}/jobs?payment=success`,
    cancel_url: `${input.origin}/jobs?payment=cancelled`,
  });
  if (!session.url) throw new Error("A payment link could not be generated.");
  return { sessionId: session.id, url: session.url };
}

export async function getCheckoutPaymentStatus(sessionId: string) {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
  return session.payment_status;
}
