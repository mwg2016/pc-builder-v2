// // import prisma from "../db.server";
// // import { authenticate } from "../shopify.server";

// // export const action = async ({ request }) => {
// //   try {
// //     const { admin, session } = await authenticate.admin(request);

// //     const shopDomain = session?.shop?.split(".")[0] || null;

// //     if (!shopDomain) {
// //       return new Response(
// //         JSON.stringify({ error: "Shop domain not found" }),
// //         { status: 400, headers: { "Content-Type": "application/json" } },
// //       );
// //     }

// //     const body = await request.json();
// //     const { planName, planPrice, pricingId, storeId  } = body;

// //     await prisma.subscription.create({
// //   data: {
// //     store_id: storeId,
// //     subscription_plan_id: pricingId.toString(), // 👈 STORE PRICING ID
// //     is_active: false,
// //   },
// // });


// //     if (!planName || !planPrice) {
// //       return new Response(
// //         JSON.stringify({ error: "Missing required fields" }),
// //         { status: 400, headers: { "Content-Type": "application/json" } },
// //       );
// //     }

// //     const query = `
// //       mutation AppSubscriptionCreate(
// //         $name: String!
// //         $lineItems: [AppSubscriptionLineItemInput!]!
// //         $returnUrl: URL!
// //         $test: Boolean!
// //       ) {
// //         appSubscriptionCreate(
// //           name: $name
// //           returnUrl: $returnUrl
// //           lineItems: $lineItems
// //           test: $test
// //         ) {
// //           userErrors { field message }
// //           appSubscription { id status }
// //           confirmationUrl
// //         }
// //       }
// //     `;

// //     const variables = {
// //       name: planName,
// //       returnUrl: `https://admin.shopify.com/store/${shopDomain}/apps/pc-builder-v2-bhaskar-1/app/pricing`,
// //       test: true,
// //       lineItems: [
// //         {
// //           plan: {
// //             appRecurringPricingDetails: {
// //               price: {
// //                 amount: Number(planPrice),
// //                 currencyCode: "USD",
// //               },
// //               interval: "EVERY_30_DAYS",
// //             },
// //           },
// //         },
// //       ],
// //     };

// //     const graphRes = await admin.graphql(query, { variables });
// //     const jsonRes = await graphRes.json();

// //     const appSubscriptionCreate = jsonRes.data?.appSubscriptionCreate;

// //     if (!appSubscriptionCreate) {
// //       return new Response(
// //         JSON.stringify({ error: "Invalid GraphQL response" }),
// //         { status: 500, headers: { "Content-Type": "application/json" } },
// //       );
// //     }

// //     if (appSubscriptionCreate.userErrors?.length) {
// //       return new Response(
// //         JSON.stringify({ error: appSubscriptionCreate.userErrors }),
// //         { status: 400, headers: { "Content-Type": "application/json" } },
// //       );
// //     }

// //     return new Response(
// //       JSON.stringify({
// //         confirmationUrl: appSubscriptionCreate.confirmationUrl,
// //         shopDomain,
// //       }),
// //       { status: 200, headers: { "Content-Type": "application/json" } },
// //     );
// //   } catch (error) {
// //     return new Response(
// //       JSON.stringify({ error: "Internal server error" }),
// //       { status: 500, headers: { "Content-Type": "application/json" } },
// //     );
// //   }
// // };


// import prisma from "../db.server";
// import { authenticate } from "../shopify.server";

// export const action = async ({ request }) => {
//   try {
//     const { admin, session } = await authenticate.admin(request);

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

//     /* ---------------- SHOPIFY CALL ---------------- */

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

//     /* ---------------- DB LOGIC (NO DUPLICATES) ---------------- */

//     // 🔑 always pick latest row
//     const existing = await prisma.subscription.findFirst({
//       where: { store_id: storeId },
//       orderBy: { id: "desc" },
//     });

//     if (existing) {
//       // ✅ UPDATE ONLY
//       await prisma.subscription.update({
//         where: { id: existing.id },
//         data: {
//           subscription_charge_id: chargeId,
//           subscription_plan_id: pricingId.toString(),
//           is_active: true, // 👈 activate on first success
//           updated_at: new Date(),
//         },
//       });
//     } else {
//       // ✅ CREATE ONLY ONCE
//       await prisma.subscription.create({
//         data: {
//           store_id: storeId,
//           subscription_charge_id: chargeId,
//           subscription_plan_id: pricingId.toString(),
//           started_at: new Date(),
//           updated_at: new Date(),
//           is_active: true,
//         },
//       });
//     }

//     return new Response(
//       JSON.stringify({
//         confirmationUrl: result.confirmationUrl,
//       }),
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
      return new Response(
        JSON.stringify({ error: "Shop domain not found" }),
        { status: 400 }
      );
    }

    const { planName, planPrice, pricingId, storeId } =
      await request.json();

    if (!planName || !planPrice || !pricingId || !storeId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    /* ---------- Shopify create ---------- */

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

    const chargeId =
      result.appSubscription.id.split("/").pop();

    /* ---------- DB logic ---------- */

    const existing = await prisma.subscription.findFirst({
      where: { store_id: storeId },
      orderBy: { id: "desc" },
    });

    if (existing) {
      // ✅ PLAN CHANGE / RE-SUBSCRIBE
      await prisma.subscription.update({
  where: { id: existing.id },
  data: {
    subscription_charge_id: chargeId,
    subscription_plan_id: pricingId.toString(),
    is_active: true,
    updated_at: new Date(),
    // ❌ cancel_at ko kabhi touch mat karo
  },
});

    } else {
      // ✅ FIRST TIME CREATE
      await prisma.subscription.create({
        data: {
          store_id: storeId,
          subscription_charge_id: chargeId,
          subscription_plan_id: pricingId.toString(),
          started_at: new Date(),
          updated_at: new Date(),
          is_active: true, // 👈 FIXED
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