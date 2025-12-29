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

  // if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
  //   try {
  //     const { app_subscription } = payload;

  //     if (!app_subscription) {
  //       return new Response("No subscription data", { status: 200 });
  //     }

  //     const storeId = app_subscription.admin_graphql_api_shop_id;
  //     if (!storeId) {
  //       return new Response("Invalid store ID", { status: 200 });
  //     }

  //     const user = await prisma.user.findUnique({
  //       where: { storeId },
  //     });

  //     if (!user) {
  //       return new Response("User not found", { status: 200 });
  //     }

  //     const subscriptionChargeId =
  //       app_subscription.admin_graphql_api_id?.split("/").pop() || null;

  //     // ⚠️ Webhook may NOT send plan id
  //     const incomingPlanId =
  //       app_subscription.line_items?.[0]?.plan?.id?.split("/").pop() || null;

  //     const startedAt = app_subscription.created_at
  //       ? new Date(app_subscription.created_at)
  //       : new Date();

  //     const updatedAt = app_subscription.updated_at
  //       ? new Date(app_subscription.updated_at)
  //       : new Date();

  //     const cancelAt = app_subscription.canceled_at
  //       ? new Date(app_subscription.canceled_at)
  //       : null;

  //     const renewAt = app_subscription.current_period_end
  //       ? new Date(app_subscription.current_period_end)
  //       : null;

  //     const isActive = app_subscription.status === "ACTIVE";

  //     // 🔑 Always fetch latest row
  //     const subscription = await prisma.subscription.findFirst({
  //       where: { store_id: user.storeId },
  //       orderBy: { id: "desc" },
  //     });

  //     if (!subscription) {
  //       // ✅ First-time create
  //       await prisma.subscription.create({
  //         data: {
  //           store_id: user.storeId,
  //           subscription_charge_id: subscriptionChargeId,
  //           subscription_plan_id: incomingPlanId, // may be null
  //           started_at: startedAt,
  //           updated_at: updatedAt,
  //           cancel_at: cancelAt,
  //           renew_at: renewAt,
  //           is_active: isActive,
  //         },
  //       });
  //     } else {
  //       // ✅ Update only — DO NOT overwrite plan_id with null
  //       await prisma.subscription.update({
  //         where: { id: subscription.id },
  //         data: {
  //           subscription_charge_id: subscriptionChargeId,
  //           updated_at: updatedAt,
  //           cancel_at: cancelAt ?? subscription.cancel_at, // 🔒 never erase
  //           renew_at: renewAt,
  //           is_active: isActive,
  //         },
  //       });
  //     }

  //     return new Response("Subscription processed", { status: 200 });
  //   } catch (error) {
  //     console.error("❌ Error processing subscription webhook:", error);
  //     return new Response("Subscription error", { status: 500 });
  //   }
  // }

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


  //   if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
  //   try {
  //     const { app_subscription } = payload;
  //     if (!app_subscription) {
  //       return new Response("No subscription data", { status: 200 });
  //     }

  //     const storeId = app_subscription.admin_graphql_api_shop_id;
  //     if (!storeId) {
  //       return new Response("Invalid store ID", { status: 200 });
  //     }

  //     const user = await prisma.user.findUnique({
  //       where: { storeId },
  //     });
  //     if (!user) {
  //       return new Response("User not found", { status: 200 });
  //     }

  //     const subscriptionChargeId =
  //       app_subscription.admin_graphql_api_id?.split("/").pop() || null;

  //     const incomingPlanId =
  //       app_subscription.line_items?.[0]?.plan?.id?.split("/").pop() || null;

  //     const startedAt = app_subscription.created_at
  //       ? new Date(app_subscription.created_at)
  //       : new Date();

  //     const updatedAt = app_subscription.updated_at
  //       ? new Date(app_subscription.updated_at)
  //       : new Date();

  //     const cancelAt = app_subscription.canceled_at
  //       ? new Date(app_subscription.canceled_at)
  //       : null;

  //     const renewAt = app_subscription.current_period_end
  //       ? new Date(app_subscription.current_period_end)
  //       : null;

  //     const isActive = app_subscription.status === "ACTIVE";

  //     // 🔑 latest subscription row
  //     const subscription = await prisma.subscription.findFirst({
  //       where: { store_id: user.storeId },
  //       orderBy: { id: "desc" },
  //     });

  //     if (!subscription) {
  //       // ✅ first-time create
  //       await prisma.subscription.create({
  //         data: {
  //           store_id: user.storeId,
  //           subscription_charge_id: subscriptionChargeId,
  //           subscription_plan_id: incomingPlanId,
  //           started_at: startedAt,
  //           updated_at: updatedAt,
  //           cancel_at: cancelAt,
  //           renew_at: renewAt,
  //           is_active: isActive,
  //         },
  //       });

  //       return new Response("Subscription created", { status: 200 });
  //     }

  //     /* ----------------------------------------
  //        🔴 CASE: already cancelled subscription
  //     -----------------------------------------*/
  //     if (subscription.cancel_at) {
  //       // 👉 Only update renew_at & updated_at
  //       await prisma.subscription.update({
  //         where: { id: subscription.id },
  //         data: {
  //           renew_at: renewAt,
  //           updated_at: updatedAt,
  //         },
  //       });

  //       // 👉 Insert entry into SubscriptionRenew table
  //       await prisma.subscriptionRenew.create({
  //         data: {
  //           storeid: user.storeId,
  //           subscription_charge_id: Number(subscriptionChargeId),
  //           subscription_plan_id: Number(
  //             incomingPlanId ?? subscription.subscription_plan_id
  //           ),
  //           started_at: startedAt.toISOString(),
  //         },
  //       });

  //       return new Response("Renewal logged", { status: 200 });
  //     }

  //     /* ----------------------------------------
  //        🟢 Normal active subscription update
  //     -----------------------------------------*/
  //     await prisma.subscription.update({
  //       where: { id: subscription.id },
  //       data: {
  //         subscription_charge_id: subscriptionChargeId,
  //         updated_at: updatedAt,
  //         cancel_at: cancelAt ?? subscription.cancel_at,
  //         renew_at: renewAt,
  //         is_active: isActive,
  //       },
  //     });

  //     return new Response("Subscription updated", { status: 200 });
  //   } catch (error) {
  //     console.error("❌ Error processing subscription webhook:", error);
  //     return new Response("Subscription error", { status: 500 });
  //   }
  // }
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
