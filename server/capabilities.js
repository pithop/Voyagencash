function capabilities() {
  const storage = !!(process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
  const base = process.env.LIVE_CHECKOUT_ENABLED === "true" && storage && !!process.env.DUFFEL_API_TOKEN && !!process.env.VOUCHER_SIGNING_SECRET;
  const stripePublicKey = process.env.STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || null;
  return { cashCheckout: base && !!process.env.PAYENCASH_ADAPTER_URL && !!process.env.PAYENCASH_API_KEY && !!process.env.PAYENCASH_WEBHOOK_SECRET,
    cardCheckout: base && !!stripePublicKey && !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY) && !!process.env.STRIPE_WEBHOOK_SECRET,
    stripePublicKey, wallet: !!process.env.PAYENCASH_ADAPTER_URL && !!process.env.PAYENCASH_API_KEY };
}
module.exports = { capabilities };
