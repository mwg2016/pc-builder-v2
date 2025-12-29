import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const { session } = await authenticate.admin(request);
    const shopDomain = session?.shop;

    if (!shopDomain) {
      return new Response(
        JSON.stringify({
          data: [],
          user: null,
          subscription: null,
          error: "Shop not authenticated",
        }),
        { status: 401, headers }
      );
    }

    // ✅ Get all pricing plans
    const pricingPlans = await prisma.pricing.findMany({
      orderBy: { id: "asc" },
    });

    // ✅ Find user by domain (as per schema)
    const user = await prisma.user.findUnique({
      where: { domain: shopDomain },
      include: {
        subscriptions: {
          where: { isActive: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });

    const subscription = user?.subscriptions?.[0] || null;

    return new Response(
      JSON.stringify({
        data: pricingPlans,
        user,
        subscription,
        error: null,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Pricing API Error:", error);

    return new Response(
      JSON.stringify({
        data: [],
        user: null,
        subscription: null,
        error: error.message || "Internal Server Error",
      }),
      { status: 500, headers }
    );
  }
};


export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const { storeId, pricingId, subscriptionChargeId } = body;

    if (!storeId || !pricingId || !subscriptionChargeId) {
      return Response.json(
        { success: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    // ✅ Get pricing plan
    const pricing = await prisma.pricing.findUnique({
      where: { id: Number(pricingId) },
    });

    if (!pricing) {
      return Response.json(
        { success: false, error: "Invalid Pricing Plan" },
        { status: 404 }
      );
    }

    // ✅ Deactivate old subscriptions
    await prisma.subscription.updateMany({
      where: { storeId, isActive: true },
      data: { isActive: false, canceledAt: new Date() },
    });

    // ✅ Create new subscription
    const newSubscription = await prisma.subscription.create({
      data: {
        storeId,
        subscriptionChargeId,
        subscriptionPlanName: pricing.planName,
        startedAt: new Date(),
        renewAt: pricing.isOneTime
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
      },
    });

    return Response.json({
      success: true,
      subscription: newSubscription,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
};


