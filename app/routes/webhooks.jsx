import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendGoodbyeEmail } from "../utility/mail";
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(
    "shop--------------------------------------------------------->",
    shop,
  );
  console.log(
    "topic-------------------------------------------------------->",
    topic,
  );

if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
  try {
    const { app_subscription } = payload;
    if (!app_subscription) {
      return new Response("No subscription data", { status: 200 });
    }

    /* -------------------------
       STORE ID
    --------------------------*/
    const storeId = app_subscription.admin_graphql_api_shop_id;
    if (!storeId) {
      return new Response("Invalid store ID", { status: 200 });
    }

    /* -------------------------
       SAFE STRING NORMALIZATION
    --------------------------*/
    const subscriptionChargeId =
      app_subscription.admin_graphql_api_id?.split("/").pop() ?? "";

    const incomingPlanId =
      app_subscription.line_items?.[0]?.plan?.id?.split("/").pop() ?? "";

    const startedAt = app_subscription.created_at
      ? new Date(app_subscription.created_at)
      : new Date();

    const updatedAt = app_subscription.updated_at
      ? new Date(app_subscription.updated_at)
      : new Date();

    // ✅ FIX: renew date fallback
    const rawRenewAt = app_subscription.current_period_end;
    const finalRenewAt = rawRenewAt
      ? new Date(rawRenewAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const isActive = app_subscription.status === "ACTIVE";

    /* -------------------------
       FETCH LATEST SUBSCRIPTION
    --------------------------*/
    const subscription = await prisma.subscription.findFirst({
      where: { store_id: storeId },
      orderBy: { id: "desc" },
    });

    /* ============================================================
       CASE 1: NO SUBSCRIPTION EXISTS → CREATE
    ============================================================*/
    if (!subscription) {
      await prisma.subscription.create({
        data: {
          store_id: storeId,
          subscription_charge_id: subscriptionChargeId,
          subscription_plan_id: incomingPlanId,
          started_at: startedAt,
          updated_at: updatedAt,
          renew_at: finalRenewAt, // ✅ always set
          is_active: isActive,
        },
      });

      return new Response("Subscription created", { status: 200 });
    }

    /* ============================================================
       CASE 2: CANCELLED → RENEW
    ============================================================*/
    if (subscription.cancel_at) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          renew_at: finalRenewAt, // ✅ always set
          updated_at: updatedAt,
        },
      });

      await prisma.subscriptionRenew.create({
        data: {
          storeid: storeId,
          subscription_charge_id: subscription.subscription_charge_id,
          subscription_plan_id: subscription.subscription_plan_id,
          started_at: new Date().toISOString(),
        },
      });

      return new Response("Cancelled subscription renewed", {
        status: 200,
      });
    }

    /* ============================================================
       CASE 3: NORMAL ACTIVE UPDATE
    ============================================================*/
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        subscription_charge_id: subscriptionChargeId,
        subscription_plan_id:
          incomingPlanId || subscription.subscription_plan_id,
        updated_at: updatedAt,
        renew_at: finalRenewAt, // ✅ always set
        is_active: isActive,
      },
    });

    return new Response("Subscription updated", { status: 200 });
  } catch (error) {
    console.error("❌ Error processing subscription webhook:", error);
    return new Response("Subscription error", { status: 500 });
  }
}

  else if (topic === "APP_UNINSTALLED") {
    console.log("APP_UNINSTALLED webhook called...");
    console.log(payload);

    try {
      const user = await prisma.user.findUnique({ where: { domain: shop } });
      // email for uninstall
      console.log(
        "emial for sendGoodbyeEmail",
        user.storeName,
        "----",
        user?.email,
        "-----",
        import.meta.env.APP_NAME,
      );
      await sendGoodbyeEmail(
        user.storeName,
        user.email,
        import.meta.env.APP_NAME || "Text Engraving by MW",
      );
    } catch (error) {
      console.error("Error while sending uninstall email", error);
    }
  }

  return new Response(null, { status: 200 });
};
