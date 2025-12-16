import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendGoodbyeEmail } from "../utility/mail";
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log('shop--------------------------------------------------------->', shop);
  console.log('topic-------------------------------------------------------->', topic);  

  if (topic === 'APP_SUBSCRIPTIONS_UPDATE') {
    try {

    const { app_subscription } = payload;
    if (!app_subscription) {
      return new Response("No subscription data", { status: 200 });
    }

    const storeId = app_subscription.admin_graphql_api_shop_id;
    if (!storeId) {
      return new Response("Invalid store ID", { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { storeId },
    });

    if (!user) {
      return new Response("User not found", { status: 200 });
    }

    const subscriptionChargeId =
      app_subscription.admin_graphql_api_id.split("/").pop();

    const subscriptionPlanName = app_subscription.name || "Unknown";
    const startedAt = new Date(app_subscription.created_at);
    const updatedAt = new Date(app_subscription.updated_at);
    const isActive = app_subscription.status === "ACTIVE";

    let subscription = await prisma.subscription.findFirst({
      where: { storeId: user.storeId },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          subscriptionPlanName,
          updatedAt,
          isActive,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          storeId: user.storeId,
          subscriptionChargeId,
          subscriptionPlanName,
          startedAt,
          updatedAt,
          isActive,
        },
      });
    }

    await prisma.subscriptionRenew.create({
      data: {
        storeId: user.storeId,
        subscriptionChargeId,
        subscriptionPlanName,
        startedAt,
      },
    });
    return new Response("Subscription processed", { status: 200 });

  } catch (error) {
    console.error("❌ Error processing subscription webhook:", error);
    return new Response("Subscription error", { status: 500 });
  }
    
  }

else if (topic === 'APP_UNINSTALLED') {
    console.log('APP_UNINSTALLED webhook called...');
    console.log(payload);

    try {
      const user = await prisma.user.findUnique({ where: { domain: shop } });
      // email for uninstall
      console.log("emial for sendGoodbyeEmail", user.storeName,"----", user?.email, "-----", import.meta.env.APP_NAME )
      await sendGoodbyeEmail(user.storeName, user.email, import.meta.env.APP_NAME || "Text Engraving by MW");

    } catch (error) {
      console.error("Error while sending uninstall email", error);
    }
  }

  return new Response(null, { status: 200 });
};