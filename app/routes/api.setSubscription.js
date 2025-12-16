import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    const shopDomain = session?.shop?.split(".")[0] || null;

    if (!shopDomain) {
      console.error("❌ SHOP DOMAIN NOT FOUND IN SESSION");

      return new Response(JSON.stringify({ error: "Shop domain not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();

    const { planName, planPrice, trialDays } = body;

    if (!planName || !planPrice) {
      console.error("❌ MISSING FIELDS | SHOP:", shopDomain);

      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const query = `
     mutation AppSubscriptionCreate(
  $name: String!
  $lineItems: [AppSubscriptionLineItemInput!]!
  $returnUrl: URL!
  $test: Boolean!
  $trialDays: Int
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

    // trialDays: $trialDays
    const variables = {
      name: planName,
      returnUrl: `https://admin.shopify.com/store/${shopDomain}/apps/pc-builder-v2-bhaskar-1/app/pricing`,
      test: true,
      // trialDays: trialDays,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: planPrice, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    };

    const graphRes = await admin.graphql(query, { variables });

    const jsonRes = await graphRes.json();

    const appSubscriptionCreate = jsonRes.data?.appSubscriptionCreate;

    if (!appSubscriptionCreate) {
      console.error("❌ INVALID GRAPHQL RESPONSE | SHOP:", shopDomain);

      return new Response(
        JSON.stringify({ error: "Invalid GraphQL response" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (appSubscriptionCreate.userErrors?.length) {
      console.error(
        "❌ SHOPIFY USER ERRORS | SHOP:",
        shopDomain,
        appSubscriptionCreate.userErrors,
      );

      return new Response(
        JSON.stringify({ error: appSubscriptionCreate.userErrors }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const finalResponse = {
      confirmationUrl: appSubscriptionCreate.confirmationUrl,
      shopDomain,
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
