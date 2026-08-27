import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createPaymentRequestForUser,
  createQuoteAcceptanceForUser,
  createVariationForUser,
  createJobFromQuoteForUser,
  createPriceBookItemForUser,
  createQuoteForUser,
  duplicateQuoteForUser,
  getJobsForUser,
  getFieldDashboardSummaryForUser,
  getPaymentRequestsForJob,
  getPriceBookItemsForUser,
  getPublicQuoteAcceptance,
  getQuoteDetailForUser,
  getQuotesForUser,
  getVariationsForJob,
  PersistedPhotoPayload,
  QuotePayload,
  respondToQuoteAcceptance,
  setPaymentCheckoutSessionForUser,
  updateJobStatusForUser,
  updatePriceBookItemForUser,
  updateQuoteForUser,
  updateVariationStatusForUser,
} from "./db";
import { storagePut } from "./storage";
import { createCheckoutPaymentLink, getCheckoutPaymentStatus } from "./payments";

const lineItemSchema = z.object({
  category: z.enum(["labour", "materials", "callout", "equipment", "other"]),
  description: z.string().trim().min(1).max(320),
  unit: z.string().trim().min(1).max(32),
  quantity: z.number().finite().positive().max(100000),
  rate: z.number().finite().min(0).max(1000000),
  markupPercent: z.number().finite().min(-100).max(500),
  sortOrder: z.number().int().min(0).max(1000),
});

const photoSchema = z.object({
  dataUrl: z.string().max(9_500_000).optional(),
  storageKey: z.string().max(500).optional(),
  url: z.string().max(720).optional(),
  fileName: z.string().trim().min(1).max(220),
});

export const quoteInputSchema = z.object({
  status: z.enum(["draft", "ready", "sent"]),
  businessName: z.string().trim().max(160).optional(),
  businessAbn: z.string().trim().max(32).optional(),
  businessLicence: z.string().trim().max(80).optional(),
  businessPhone: z.string().trim().max(48).optional(),
  businessEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
  customerPhone: z.string().trim().max(48).optional(),
  trade: z.string().trim().min(1).max(100),
  jobTitle: z.string().trim().min(1).max(220),
  jobAddress: z.string().trim().max(4000).optional(),
  siteDetails: z.string().trim().max(6000).optional(),
  scopeOfWork: z.string().trim().max(12000).optional(),
  assumptions: z.string().trim().max(6000).optional(),
  exclusions: z.string().trim().max(6000).optional(),
  terms: z.string().trim().max(6000).optional(),
  gstRate: z.number().finite().min(0).max(100),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  lineItems: z.array(lineItemSchema).min(1).max(60),
  photos: z.array(photoSchema).max(5),
});

const draftSchema = z.object({
  trade: z.string().trim().min(1).max(100),
  jobTitle: z.string().trim().min(1).max(220),
  jobAddress: z.string().trim().max(4000).optional(),
  siteDetails: z.string().trim().max(6000).optional(),
  existingScope: z.string().trim().max(6000).optional(),
  photos: z.array(z.object({ dataUrl: z.string().max(9_500_000), fileName: z.string().max(220) })).max(5),
});

const variationPhotoSchema = z.object({ dataUrl: z.string().max(9_500_000).optional(), storageKey: z.string().max(500).optional(), url: z.string().max(720).optional(), fileName: z.string().trim().min(1).max(220) });
const variationInputSchema = z.object({ jobId: z.number().int().positive(), title: z.string().trim().min(1).max(220), reason: z.string().trim().max(6000).optional(), scopeOfWork: z.string().trim().min(1).max(12000), status: z.enum(["draft", "sent", "approved", "declined"]), subtotal: z.number().finite().min(0).max(10_000_000), gstAmount: z.number().finite().min(0).max(10_000_000), total: z.number().finite().min(0).max(10_000_000), photos: z.array(variationPhotoSchema).max(5) });
const paymentRequestInputSchema = z.object({ jobId: z.number().int().positive(), kind: z.enum(["deposit", "invoice"]), title: z.string().trim().min(1).max(220), description: z.string().trim().max(4000).optional(), requestedAmountCents: z.number().int().min(50).max(10_000_000), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")) });

export const priceBookInputSchema = z.object({
  category: z.enum(["labour", "materials", "callout", "equipment", "other"]),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).optional(),
  unit: z.string().trim().min(1).max(32),
  rate: z.number().finite().min(0).max(1_000_000),
  markupPercent: z.number().finite().min(-100).max(500),
  trade: z.string().trim().min(1).max(100),
  status: z.enum(["active", "archived"]),
});

function toOptional(value: string | undefined) {
  return value && value.length ? value : null;
}

function dataUrlToImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPEG, PNG, and WebP job-site photos are supported." });
  const data = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!data.length || data.length > 7 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Each job-site photo must be smaller than 7 MB." });
  }
  return { mimeType: match[1].toLowerCase(), data };
}

function cleanedFileName(fileName: string, fallback: string) {
  const name = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
  return name || fallback;
}

async function persistPhotos(userId: number, photos: z.infer<typeof photoSchema>[]): Promise<PersistedPhotoPayload[]> {
  return Promise.all(photos.map(async (photo, index) => {
    if (photo.dataUrl) {
      const image = dataUrlToImage(photo.dataUrl);
      const fileName = cleanedFileName(photo.fileName, `job-photo-${index + 1}.jpg`);
      const stored = await storagePut(`${userId}/quote-photos/${fileName}`, image.data, image.mimeType);
      return { storageKey: stored.key, url: stored.url, fileName };
    }
    if (!photo.storageKey || !photo.url || !photo.storageKey.startsWith(`${userId}/`)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A saved photo reference was invalid." });
    }
    return { storageKey: photo.storageKey, url: photo.url, fileName: cleanedFileName(photo.fileName, `job-photo-${index + 1}`) };
  }));
}

async function persistVariationPhotos(userId: number, photos: z.infer<typeof variationPhotoSchema>[]): Promise<PersistedPhotoPayload[]> {
  return Promise.all(photos.map(async (photo, index) => {
    if (photo.dataUrl) {
      const image = dataUrlToImage(photo.dataUrl);
      const fileName = cleanedFileName(photo.fileName, `variation-photo-${index + 1}.jpg`);
      const stored = await storagePut(`${userId}/variation-photos/${crypto.randomUUID()}-${fileName}`, image.data, image.mimeType);
      return { storageKey: stored.key, url: stored.url, fileName };
    }
    if (!photo.storageKey || !photo.url || !photo.storageKey.startsWith(`${userId}/`)) throw new TRPCError({ code: "BAD_REQUEST", message: "A saved variation photo reference was invalid." });
    return { storageKey: photo.storageKey, url: photo.url, fileName: cleanedFileName(photo.fileName, `variation-photo-${index + 1}`) };
  }));
}

async function toQuotePayload(userId: number, input: z.infer<typeof quoteInputSchema>): Promise<QuotePayload> {
  const photos = await persistPhotos(userId, input.photos);
  return {
    quoteNumber: `TQ-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    status: input.status,
    businessName: toOptional(input.businessName),
    businessAbn: toOptional(input.businessAbn),
    businessLicence: toOptional(input.businessLicence),
    businessPhone: toOptional(input.businessPhone),
    businessEmail: toOptional(input.businessEmail),
    customerName: input.customerName,
    customerEmail: toOptional(input.customerEmail),
    customerPhone: toOptional(input.customerPhone),
    trade: input.trade,
    jobTitle: input.jobTitle,
    jobAddress: toOptional(input.jobAddress),
    siteDetails: toOptional(input.siteDetails),
    scopeOfWork: toOptional(input.scopeOfWork),
    assumptions: toOptional(input.assumptions),
    exclusions: toOptional(input.exclusions),
    terms: toOptional(input.terms),
    gstRate: input.gstRate,
    validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
    lineItems: input.lineItems,
    photos,
  };
}

const aiDraftResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "tradie_quote_draft",
    strict: true,
    schema: {
      type: "object",
      properties: {
        scopeOfWork: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        exclusions: { type: "array", items: { type: "string" } },
        suggestedLineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["labour", "materials", "callout", "equipment", "other"] },
              description: { type: "string" },
              unit: { type: "string" },
              quantity: { type: "number" },
              rate: { type: "number" },
              markupPercent: { type: "number" },
            },
            required: ["category", "description", "unit", "quantity", "rate", "markupPercent"],
            additionalProperties: false,
          },
        },
      },
      required: ["scopeOfWork", "assumptions", "exclusions", "suggestedLineItems"],
      additionalProperties: false,
    },
  },
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  quote: router({
    list: protectedProcedure.query(({ ctx }) => getQuotesForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const detail = await getQuoteDetailForUser(input.id, ctx.user.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      return detail;
    }),
    create: protectedProcedure.input(quoteInputSchema).mutation(async ({ ctx, input }) => {
      const payload = await toQuotePayload(ctx.user.id, input);
      const created = await createQuoteForUser(ctx.user.id, payload);
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Quote could not be saved." });
      return created;
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: quoteInputSchema })).mutation(async ({ ctx, input }) => {
      const payload = await toQuotePayload(ctx.user.id, input.data);
      const updated = await updateQuoteForUser(input.id, ctx.user.id, payload);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      return updated;
    }),
    duplicate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const duplicate = await duplicateQuoteForUser(input.id, ctx.user.id);
      if (!duplicate) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      return duplicate;
    }),
    draft: protectedProcedure.input(draftSchema).mutation(async ({ input }) => {
      const jobContext = [
        `Trade: ${input.trade}`,
        `Job: ${input.jobTitle}`,
        input.jobAddress ? `Site address: ${input.jobAddress}` : "",
        input.siteDetails ? `Site details: ${input.siteDetails}` : "",
        input.existingScope ? `Tradie's notes: ${input.existingScope}` : "",
      ].filter(Boolean).join("\n");
      const response = await invokeLLM({
        max_tokens: 2400,
        response_format: aiDraftResponseFormat,
        messages: [
          {
            role: "system",
            content: "You are a careful Australian tradie estimating assistant. Create a preliminary, editable draft only from the job information and photos supplied. Do not claim unseen conditions, regulatory compliance, exact material availability, or suitability for a particular site. Use clear Australian English and AUD. Suggest a measured scope, conservative assumptions and exclusions, and detailed editable line items across labour, materials, call-out, equipment, or other costs where applicable. The tradie must verify quantities, rates, pricing, trade licensing, safety, and tax treatment before sending the quote. Return only the requested JSON.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `${jobContext}\n\nPrepare a draft quote. Use reasonable placeholders where a detail is not knowable, and clearly place uncertainty in assumptions or exclusions.` },
              ...input.photos.map(photo => ({ type: "image_url" as const, image_url: { url: photo.dataUrl, detail: "high" as const } })),
            ],
          },
        ],
      });
      const content = response.choices[0]?.message.content;
      if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The draft response could not be read." });
      try {
        return JSON.parse(content) as {
          scopeOfWork: string;
          assumptions: string[];
          exclusions: string[];
          suggestedLineItems: Array<z.infer<typeof lineItemSchema>>;
        };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The draft response was not valid. Please try again." });
      }
    }),
  }),
  acceptance: router({
    create: protectedProcedure.input(z.object({ quoteId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const acceptance = await createQuoteAcceptanceForUser(input.quoteId, ctx.user.id);
      if (!acceptance) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      const origin = ctx.req.headers.origin || `${ctx.req.protocol}://${ctx.req.get("host")}`;
      return { ...acceptance, publicUrl: `${origin}/accept/${acceptance.publicToken}` };
    }),
    getPublic: publicProcedure.input(z.object({ token: z.string().min(32).max(96) })).query(async ({ input }) => {
      const acceptance = await getPublicQuoteAcceptance(input.token);
      if (!acceptance || acceptance.status === "revoked") throw new TRPCError({ code: "NOT_FOUND", message: "This approval link is no longer available." });
      return { ...acceptance, quoteSnapshot: JSON.parse(acceptance.quoteSnapshot) };
    }),
    respond: publicProcedure.input(z.object({ token: z.string().min(32).max(96), decision: z.enum(["accepted", "declined"]), signerName: z.string().trim().min(1).max(160), signerEmail: z.string().trim().email().max(320).optional().or(z.literal("")), agrees: z.boolean() })).mutation(async ({ input }) => {
      if (input.decision === "accepted" && !input.agrees) throw new TRPCError({ code: "BAD_REQUEST", message: "Please confirm that you agree to the quote before accepting it." });
      const response = await respondToQuoteAcceptance(input.token, input.decision, { name: input.signerName, email: toOptional(input.signerEmail) });
      if (!response) throw new TRPCError({ code: "CONFLICT", message: "This approval request has already been actioned or is no longer available." });
      return response;
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => getFieldDashboardSummaryForUser(ctx.user.id)),
  }),
  variation: router({
    listForJob: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const result = await getVariationsForJob(input.jobId, ctx.user.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      return result;
    }),
    create: protectedProcedure.input(variationInputSchema).mutation(async ({ ctx, input }) => {
      const photos = await persistVariationPhotos(ctx.user.id, input.photos);
      const variation = await createVariationForUser(input.jobId, ctx.user.id, { ...input, reason: toOptional(input.reason), photos });
      if (!variation) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      return variation;
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "sent", "approved", "declined"]) })).mutation(async ({ ctx, input }) => {
      const variation = await updateVariationStatusForUser(input.id, ctx.user.id, input.status);
      if (!variation) throw new TRPCError({ code: "NOT_FOUND", message: "Variation not found." });
      return variation;
    }),
  }),
  payment: router({
    listForJob: protectedProcedure.input(z.object({ jobId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const requests = await getPaymentRequestsForJob(input.jobId, ctx.user.id);
      return Promise.all(requests.map(async request => {
        if (!request.stripeCheckoutSessionId) return { ...request, paymentStatus: "not_created" as const };
        try { return { ...request, paymentStatus: await getCheckoutPaymentStatus(request.stripeCheckoutSessionId) }; }
        catch { return { ...request, paymentStatus: "unavailable" as const }; }
      }));
    }),
    createCheckout: protectedProcedure.input(paymentRequestInputSchema).mutation(async ({ ctx, input }) => {
      const request = await createPaymentRequestForUser(input.jobId, ctx.user.id, { kind: input.kind, title: input.title, description: toOptional(input.description), requestedAmountCents: input.requestedAmountCents, dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null });
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      try {
        const origin = ctx.req.headers.origin || `${ctx.req.protocol}://${ctx.req.get("host")}`;
        const checkout = await createCheckoutPaymentLink({ origin, userId: ctx.user.id, customerEmail: null, customerName: null, paymentRequestId: request.id, jobId: input.jobId, title: request.title, description: request.description, amountCents: request.requestedAmountCents });
        await setPaymentCheckoutSessionForUser(request.id, ctx.user.id, checkout.sessionId);
        return { paymentRequest: request, checkoutUrl: checkout.url };
      } catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Payment link could not be generated." });
      }
    }),
  }),
  priceBook: router({
    list: protectedProcedure.query(({ ctx }) => getPriceBookItemsForUser(ctx.user.id)),
    create: protectedProcedure.input(priceBookInputSchema).mutation(async ({ ctx, input }) => {
      const item = await createPriceBookItemForUser(ctx.user.id, { ...input, description: toOptional(input.description) });
      if (!item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Price book item could not be created." });
      return item;
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: priceBookInputSchema })).mutation(async ({ ctx, input }) => {
      const item = await updatePriceBookItemForUser(input.id, ctx.user.id, { ...input.data, description: toOptional(input.data.description) });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Price book item not found." });
      return item;
    }),
  }),
  job: router({
    list: protectedProcedure.query(({ ctx }) => getJobsForUser(ctx.user.id)),
    createFromQuote: protectedProcedure.input(z.object({ quoteId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const job = await createJobFromQuoteForUser(input.quoteId, ctx.user.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
      return job;
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["planned", "active", "on_hold", "complete"]) })).mutation(async ({ ctx, input }) => {
      const job = await updateJobStatusForUser(input.id, ctx.user.id, input.status);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      return job;
    }),
  }),
});

export type AppRouter = typeof appRouter;
