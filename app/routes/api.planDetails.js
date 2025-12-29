import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const { session } = await authenticate.admin(request);
    const shopDomain = session?.shop;

    if (!shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: "Shop not authenticated" }),
        { status: 401, headers }
      );
    }

    // Get user by domain
    const user = await prisma.user.findUnique({
      where: { domain: shopDomain },
      select: { storeId: true }
    });

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers }
      );
    }

    // Check for active subscription
    const subscription = await prisma.subscription.findFirst({
      where: { storeId: user.storeId, isActive: true }
    });

    // If subscription exists → user purchased a plan
    const hasPlan = Boolean(subscription);

    return new Response(
      JSON.stringify({ success: hasPlan }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error("Check Plan API Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers }
    );
  }
};
