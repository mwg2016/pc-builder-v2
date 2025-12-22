import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const { storeId, subscriptionChargeId } = await request.json();

    if (!storeId || !subscriptionChargeId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    /* -------------------- Cancel on Shopify -------------------- */
    const query = `
      mutation AppSubscriptionCancel($id: ID!, $prorate: Boolean) {
        appSubscriptionCancel(id: $id, prorate: $prorate) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
        }
      }
    `;

    const variables = {
      id: `gid://shopify/AppSubscription/${subscriptionChargeId}`,
      prorate: true,
    };

    const graphRes = await admin.graphql(query, { variables });
    const jsonRes = await graphRes.json();
    const cancelData = jsonRes?.data?.appSubscriptionCancel;

    if (!cancelData || cancelData.userErrors?.length > 0) {
      return new Response(
        JSON.stringify({
          error: cancelData?.userErrors || "Failed to cancel subscription",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    /* -------------------- Update Subscription in DB -------------------- */
    const now = new Date(); // ✅ Date object (IMPORTANT)

    await prisma.subscription.updateMany({
      where: {
        store_id: storeId,
        subscription_charge_id: subscriptionChargeId,
        is_active: true,
      },
      data: {
        is_active: false,
        updated_at: now,
        cancel_at: now,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: cancelData.appSubscription.status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Cancel subscription error:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
