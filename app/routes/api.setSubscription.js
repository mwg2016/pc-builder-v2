// import prisma from "../db.server";
// import { authenticate } from "../shopify.server";

// export const action = async ({ request }) => {
//   const { admin, session } = await authenticate.admin(request);

//   try {
//     const shopDomain = session?.shop?.split(".")[0];
//     if (!shopDomain) {
//       return new Response(
//         JSON.stringify({ error: "Shop domain not found" }),
//         { status: 400 }
//       );
//     }

//     const { planName, planPrice, pricingId, storeId } =
//       await request.json();

//     if (!planName || !planPrice || !pricingId || !storeId) {
//       return new Response(
//         JSON.stringify({ error: "Missing required fields" }),
//         { status: 400 }
//       );
//     }

//     /* ---------- Shopify create ---------- */

//     const query = `
//       mutation AppSubscriptionCreate(
//         $name: String!
//         $lineItems: [AppSubscriptionLineItemInput!]!
//         $returnUrl: URL!
//         $test: Boolean!
//       ) {
//         appSubscriptionCreate(
//           name: $name
//           returnUrl: $returnUrl
//           lineItems: $lineItems
//           test: $test
//         ) {
//           userErrors { field message }
//           appSubscription { id status }
//           confirmationUrl
//         }
//       }
//     `;

//     const variables = {
//       name: planName,
//       returnUrl: `https://admin.shopify.com/store/${shopDomain}/apps/pc-builder-v2-bhaskar-1/app/pricing`,
//       test: true,
//       lineItems: [
//         {
//           plan: {
//             appRecurringPricingDetails: {
//               price: {
//                 amount: Number(planPrice),
//                 currencyCode: "USD",
//               },
//               interval: "EVERY_30_DAYS",
//             },
//           },
//         },
//       ],
//     };

//     const res = await admin.graphql(query, { variables });
//     const json = await res.json();
//     const result = json.data?.appSubscriptionCreate;

//     if (!result || result.userErrors?.length) {
//       return new Response(
//         JSON.stringify({ error: result?.userErrors || "Shopify error" }),
//         { status: 400 }
//       );
//     }

//     const chargeId =
//       result.appSubscription.id.split("/").pop();

//     /* ---------- DB logic ---------- */

//     const existing = await prisma.subscription.findFirst({
//       where: { store_id: storeId },
//       orderBy: { id: "desc" },
//     });

//     if (existing) {
//       // ✅ PLAN CHANGE / RE-SUBSCRIBE
//       await prisma.subscription.update({
//   where: { id: existing.id },
//   data: {
//     subscription_charge_id: chargeId,
//     subscription_plan_id: pricingId.toString(),
//     is_active: true,
//     updated_at: new Date(),
//     // ❌ cancel_at ko kabhi touch mat karo
//   },
// });

//     } else {
//       // ✅ FIRST TIME CREATE
//       await prisma.subscription.create({
//         data: {
//           store_id: storeId,
//           subscription_charge_id: chargeId,
//           subscription_plan_id: pricingId.toString(),
//           started_at: new Date(),
//           updated_at: new Date(),
//           is_active: true, // 👈 FIXED
//         },
//       });
//     }

//     return new Response(
//       JSON.stringify({ confirmationUrl: result.confirmationUrl }),
//       { status: 200 }
//     );
//   } catch (err) {
//     console.error("Subscription action error:", err);
//     return new Response(
//       JSON.stringify({ error: "Internal server error" }),
//       { status: 500 }
//     );
//   }
// };

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const shopDomain = session?.shop?.split(".")[0];
    if (!shopDomain) {
      return new Response(JSON.stringify({ error: "Shop domain not found" }), {
        status: 400,
      });
    }

    const { planName, planPrice, pricingId, storeId } = await request.json();

    if (!planName || planPrice === undefined || !pricingId || !storeId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    /* ===========================
       FIND EXISTING SUBSCRIPTION
    ============================ */
    const existing = await prisma.subscription.findFirst({
      where: { store_id: storeId },
      orderBy: { id: "desc" },
    });

    /* ===========================
       FREE PLAN HANDLING
    ============================ */
    if (Number(planPrice) === 0) {
      if (existing?.subscription_charge_id) {
        const cancelMutation = `
          mutation AppSubscriptionCancel($id: ID!) {
            appSubscriptionCancel(id: $id) {
              userErrors { message }
              appSubscription { id status }
            }
          }
        `;

        await admin.graphql(cancelMutation, {
          variables: {
            id: `gid://shopify/AppSubscription/${existing.subscription_charge_id}`,
          },
        });
      }

      if (existing) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            subscription_plan_id: pricingId.toString(),
            is_active: false,
            cancel_at: new Date(),
            updated_at: new Date(),
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            store_id: storeId,
            subscription_plan_id: pricingId.toString(),
            is_active: false,
            started_at: new Date(),
            cancel_at: new Date(),
            updated_at: new Date(),
          },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Free plan activated" }),
        { status: 200 }
      );
    }

    /* ===========================
       PAID PLAN → SHOPIFY CREATE
    ============================ */

    const query = `
      mutation AppSubscriptionCreate(
        $name: String!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $returnUrl: URL!
        $test: Boolean!
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
          test: $test
        ) {
          userErrors { field message }
          appSubscription { id status }
          confirmationUrl
        }
      }
    `;

    const variables = {
      name: planName,
      returnUrl: `https://admin.shopify.com/store/${shopDomain}/apps/pc-builder-v2-bhaskar-1/app/pricing`,
      test: true,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: Number(planPrice),
                currencyCode: "USD",
              },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    };

    const res = await admin.graphql(query, { variables });
    const json = await res.json();
    const result = json.data?.appSubscriptionCreate;

    if (!result || result.userErrors?.length) {
      return new Response(
        JSON.stringify({ error: result?.userErrors || "Shopify error" }),
        { status: 400 }
      );
    }

    const chargeId = result.appSubscription.id.split("/").pop();

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          subscription_charge_id: chargeId,
          subscription_plan_id: pricingId.toString(),
          is_active: true,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          store_id: storeId,
          subscription_charge_id: chargeId,
          subscription_plan_id: pricingId.toString(),
          started_at: new Date(),
          updated_at: new Date(),
          is_active: true,
        },
      });
    }

    return new Response(
      JSON.stringify({ confirmationUrl: result.confirmationUrl }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Subscription action error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
};
