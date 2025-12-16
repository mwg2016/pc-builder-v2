import { useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

/* =========================
   ✅ ✅ ✅ SERVER LOADER  
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
        JSON.stringify({
          plans: [],
          user: null,
          error: "Shop not authenticated",
        }),
        { status: 401, headers },
      );
    }

    // ✅ Fetch all pricing plans
    const plans = await prisma.pricing.findMany({
      orderBy: { id: "asc" },
    });

    // ✅ Fetch user by domain with active subscriptions
    const user = await prisma.user.findUnique({
      where: { domain: shopDomain },
      include: {
        subscriptions: {
          orderBy: { startedAt: "desc" },
        },
        subscriptionRenews: true,
      },
    });

    return new Response(
      JSON.stringify({
        plans,
        user,
        error: null,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("🔥 LOADER ERROR:", error);

    return new Response(
      JSON.stringify({
        plans: [],
        user: null,
        error: error?.message || "Internal Server Error",
      }),
      { status: 500, headers },
    );
  }
}



export default function PricingPage() {
  const data = useLoaderData();
  const plans = data?.plans || [];
  const user = data?.user;

  const [isActive, setIsActive] = useState(false);

  // ✅ ACTIVE SUBSCRIPTION CHECK
  useEffect(() => {
    if (user?.subscriptions?.length > 0) {
      const hasActiveSubscription = user.subscriptions.some(
        (sub) => sub.isActive === true,
      );

      setIsActive(hasActiveSubscription);
    } else {
      setIsActive(false);
    }

    console.log("✅ STORE ID (Frontend):", user?.storeId);
    console.log("✅ USER SUBSCRIPTIONS:", user?.subscriptions);
  }, [user]);

  const createSubscription = async (planName, planPrice, id, trialDays) => {
    console.log("Creating subscription for:", planName, planPrice);

    try {
      const res = await fetch("/api/setSubscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName,
          planPrice,
          pricingId: id,
          trialDays,
          storeId: user?.storeId, // ✅ VERY IMPORTANT
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create subscription");
      }

      const data = await res.json();
      console.log("Response from setSubscription API:", data);

      if (data.confirmationUrl) {
        window.open(data.confirmationUrl, "_top");
      }
    } catch (error) {
      console.error("Failed to create subscription:", error);
      shopify.toast.show("Failed to create subscription.", { duration: 4000 });
    }
  };

  const cancelSubscription = async () => {
    try {
      if (!user?.storeId || !user?.subscriptions?.length) {
        shopify.toast.show("No active subscription found.", { duration: 4000 });
        return;
      }

      const activeSub = user.subscriptions.find((sub) => sub.isActive);

      if (!activeSub?.subscriptionChargeId) {
        shopify.toast.show("Subscription ID not found.", { duration: 4000 });
        return;
      }

      const res = await fetch("/api/deleteSubscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: user.storeId,
          subscriptionChargeId: activeSub.subscriptionChargeId,
        }),
      });

      if (!res.ok) throw new Error("Failed to cancel subscription");

      const data = await res.json();
      console.log("Cancel response:", data);

      shopify.toast.show("Subscription cancelled successfully.", {
        duration: 4000,
      });

      window.location.reload();
    } catch (error) {
      console.error("Cancel failed:", error);
      shopify.toast.show("Failed to cancel subscription.", { duration: 4000 });
    }
  };

  return (
    <s-page title="Choose Your Plan" fullWidth>

      {/* ✅ STATUS BOX */}
      <s-section>
        <s-box padding="large" background="subdued" borderRadius="large" align="center">
          <s-text as="h2">
            <strong>Plan Status </strong>
          </s-text>

          {isActive ? (
            <>
              <s-text tone="success">Your subscription is active.</s-text>
              <s-badge tone="success">Active</s-badge>
            </>
          ) : (
            <>
              <s-text tone="critical">No active subscription.</s-text>
              <s-badge tone="critical">Inactive</s-badge>
            </>
          )}
        </s-box>
      </s-section>

      {/* ✅ PRICING CARDS */}
      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap="large">

        {plans.length === 0 && (
          <s-text tone="subdued" align="center">
            No plans found.
          </s-text>
        )}

        {plans.map((plan) => (
          <s-section key={plan.id}>
            <s-box padding="large" border="divider" borderRadius="large" align="center">

              {/* <s-badge tone="info">{plan.planType}</s-badge> */}

              <s-text as="h2">
                
                <strong>Pricing: </strong>
                {/* <strong>{plan.planName}</strong> */}
              </s-text>
              

              {/* <s-text tone="subdued">{plan.planDesc}</s-text> */}

              <s-text as="h1">
                <strong>
                  {plan.planPriceString}
                </strong>
              </s-text>

              <s-divider />

              <s-stack gap="small" align="center">
                {plan.trialDays && <s-text>✔ {plan.trialDays} Days Free Trial</s-text>}
                <s-text>✔ Unlimited orders</s-text>
                <s-text>✔ Priority support</s-text>
                <s-text>✔ Only For Checkout Plus</s-text>
              </s-stack>

              <s-box paddingBlockStart="base">
                {isActive ? (
                  <s-stack >
                    {/* <s-button disabled>Current Plan</s-button> */}
                    <s-button tone="critical" onClick={cancelSubscription}>
                      Cancel Subscription
                    </s-button>
                  </s-stack>
                ) : (
                  <s-button
                    tone="success"
                    onClick={() =>
                      createSubscription(
                        plan.planName,
                        plan.planPrice,
                        plan.id,
                        plan.trialDays,
                      )
                    }
                  >
                    Activate Plan
                  </s-button>
                )}
              </s-box>

            </s-box>
          </s-section>
        ))}
      </s-grid>

    </s-page>
  );
}
