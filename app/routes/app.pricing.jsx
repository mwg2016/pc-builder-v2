import { useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

/* =========================
   SERVER LOADER
========================= */
export async function loader({ request }) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const { session } = await authenticate.admin(request);
    const shopDomain = session?.shop;

    if (!shopDomain) {
      return new Response(
        JSON.stringify({ plans: [], user: null, subscriptions: [] }),
        { status: 401, headers },
      );
    }

    /* =========================
       PRICING PLANS
    ========================= */
    const plans = await prisma.pricing.findMany({
      orderBy: { id: "asc" },
    });

    /* =========================
       USER (NO include!)
    ========================= */
    const userRaw = await prisma.user.findUnique({
      where: { domain: shopDomain },
    });

    if (!userRaw) {
      return new Response(
        JSON.stringify({ plans, user: null, subscriptions: [] }),
        { status: 200, headers },
      );
    }

    /* =========================
       SUBSCRIPTIONS (SEPARATE QUERY)
    ========================= */
    const subscriptions = await prisma.subscription.findMany({
      where: {
        store_id: userRaw.storeId,
      },
      orderBy: { id: "desc" },
    });

    /* =========================
       BIGINT SAFE USER
    ========================= */
    const user = {
      ...userRaw,
      id: userRaw.id.toString(), // ✅ BigInt fix
    };

    return new Response(
      JSON.stringify({
        plans,
        user,
        subscriptions,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("🔥 LOADER ERROR:", error);

    return new Response(
      JSON.stringify({
        plans: [],
        user: null,
        subscriptions: [],
        error: error.message,
      }),
      { status: 500, headers },
    );
  }
}

export default function PricingPage() {
  const { plans = [], user, subscriptions = [] } = useLoaderData();
  const [isActive, setIsActive] = useState(false);
  console.log("ALL SUBSCRIPTIONS 👉", subscriptions);

  const activeSubscription = subscriptions.find(
    (sub) => sub.is_active === true,
  );

  console.log("ACTIVE SUBSCRIPTION 👉", {
    id: activeSubscription?.subscription_plan_id,
    is_active: activeSubscription?.is_active,
  });
  console.log("ACTIVE SUBSCRIPTION 👉", activeSubscription);
  useEffect(() => {
    const active = subscriptions.some((sub) => sub.is_active === true);
    setIsActive(active);
  }, [subscriptions]);

  const createSubscription = async (plan) => {
    try {
      const res = await fetch("/api/setSubscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName: plan.name,
          planPrice: plan.price,
          pricingId: plan.id,
          trialOrders: plan.trial_orders,
          storeId: user.storeId,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();

      if (data.confirmationUrl) {
        window.open(data.confirmationUrl, "_top");
      }
    } catch (error) {
      shopify.toast.show("Failed to create subscription", {
        duration: 4000,
      });
    }
  };

  /* =========================
     CANCEL SUBSCRIPTION
  ========================= */
  const cancelSubscription = async () => {
    const activeSub = subscriptions.find((s) => s.is_active);

    if (!activeSub) {
      shopify.toast.show("No active subscription", {
        duration: 4000,
      });
      return;
    }

    try {
      await fetch("/api/deleteSubscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: user.storeId,
          subscriptionChargeId: activeSub.subscription_charge_id,
        }),
      });

      shopify.toast.show("Subscription cancelled", {
        duration: 4000,
      });

      window.location.reload();
    } catch (error) {
      shopify.toast.show("Cancel failed", {
        duration: 4000,
      });
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <s-page title="Choose Your Plan" fullWidth>
      {/* STATUS */}
      <s-section>
        <s-box padding="large" background="subdued" align="center">
          <s-text as="h2">
            <strong>Plan Status</strong>
          </s-text>

          {isActive ? (
            <>
              <s-text tone="success">Subscription Active</s-text>
              <s-badge tone="success">Active</s-badge>
            </>
          ) : (
            <>
              <s-text tone="critical">No Active Subscription</s-text>
              <s-badge tone="critical">Inactive</s-badge>
            </>
          )}
        </s-box>
      </s-section>

      {/* PLANS */}
      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))"
        gap="large"
      >
        {plans.map((plan) => {
          const activePricingId = Number(
            activeSubscription?.subscription_plan_id,
          );
          const planId = Number(plan.id);

          const isPlanActive = activePricingId === planId;

          console.log("PLAN RENDER 👉", {
            plan_id: planId,
            plan_name: plan.name,
            frontend_plan_pricing_id: planId,
            active_subscription_pricing_id: activePricingId,
            is_active: isPlanActive,
          });

          return (
            <s-section key={plan.id}>
              <s-box padding="large" border="divider" align="center">
                <s-text as="h2">
                  <strong>{plan.name}</strong>
                </s-text>

                <s-text as="h1">
                  <strong>₹{plan.price}</strong>
                </s-text>

                <s-divider />

                <s-stack align="center">
                  {plan.trial_orders && (
                    <s-text>✔ {plan.trial_orders} Trial Orders</s-text>
                  )}
                  <s-text>✔ Unlimited Orders</s-text>
                  <s-text>✔ Priority Support</s-text>
                </s-stack>

                <s-box paddingBlockStart="base">
                  {isPlanActive ? (
                    <s-box
                      display="flex"
                      flexDirection="column"
                      align="center"
                      gap="small"
                    >
                      <s-button tone="success" disabled>
                        Current Plan
                      </s-button>

                      <s-button tone="critical" onClick={cancelSubscription}>
                        Cancel Subscription
                      </s-button>
                    </s-box>
                  ) : (
                    <s-button
                      tone="success"
                      onClick={() => createSubscription(plan)}
                    >
                      Activate Plan
                    </s-button>
                  )}
                </s-box>
              </s-box>
            </s-section>
          );
        })}
      </s-grid>
    </s-page>
  );
}
