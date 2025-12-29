import { useEffect, useState, useRef } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { useLoaderData, useRevalidator } from "react-router";

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
    let subscriptions = await prisma.subscription.findMany({
      where: {
        store_id: userRaw.storeId,
      },
      orderBy: { id: "desc" },
    });

    /* ------------------------------------------------
   FALLBACK: NO SUBSCRIPTION → FREE ACTIVE
------------------------------------------------ */
    if (!subscriptions || subscriptions.length === 0) {
      subscriptions = [
        {
          id: "free",
          store_id: userRaw.storeId,
          subscription_plan_id: "FREE",
          subscription_charge_id: null,
          is_active: true,
        },
      ];
    }

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
  const [isLoading, setIsLoading] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const revalidator = useRevalidator();
  const cancelModalRef = useRef(null);
  const activeSubscription = subscriptions.find(
    (sub) => sub.is_active === true,
  ) || {
    subscription_plan_id: "FREE",
    subscription_charge_id: null,
    is_active: true,
  };

  useEffect(() => {
    const active = subscriptions.some((sub) => sub.is_active === true);
    setIsActive(active);
  }, [subscriptions]);

  // const createSubscription = async (plan) => {
  //   try {
  //     const res = await fetch("/api/setSubscription", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         planName: plan.name,
  //         planPrice: plan.price,
  //         pricingId: plan.id,
  //         trialOrders: plan.trial_orders,
  //         storeId: user.storeId,
  //       }),
  //     });

  //     if (!res.ok) throw new Error("Failed");

  //     const data = await res.json();

  //     if (data.confirmationUrl) {
  //       window.open(data.confirmationUrl, "_top");
  //     }
  //   } catch (error) {
  //     shopify.toast.show("Failed to create subscription", {
  //       duration: 4000,
  //     });
  //   }
  // };
  const createSubscription = async (plan) => {
    if (isLoading) return;

    setIsLoading(true);
    setProcessingPlanId(plan.id);

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
        return;
      }

      // ✅ FREE PLAN OR DIRECT SUCCESS
      await revalidator.revalidate(); // 👈 loader re-run
      setIsLoading(false);
      setProcessingPlanId(null);
    } catch (error) {
      shopify.toast.show("Failed to create subscription", { duration: 4000 });
      setIsLoading(false);
      setProcessingPlanId(null);
    }
  };

  const confirmCancelSubscription = async () => {
    if (isLoading) return;

    const activeSub = subscriptions.find((s) => s.is_active);
    if (!activeSub) return;

    // 🔹 Modal turant close
    cancelModalRef.current?.hide();

    setIsLoading(true);
    setProcessingPlanId("cancel");

    // 🔹 Immediate feedback
    shopify.toast.show("Cancelling subscription…", { duration: 3000 });

    try {
      await fetch("/api/deleteSubscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: user.storeId,
          subscriptionChargeId: activeSub.subscription_charge_id,
        }),
      });

      // 🔹 Success toast
      shopify.toast.show("Subscription cancelled successfully", {
        duration: 4000,
      });

      await revalidator.revalidate(); // loader re-run
    } catch (error) {
      shopify.toast.show("Cancel failed. Please try again.", {
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
      setProcessingPlanId(null);
    }
  };

  /* =========================
     CANCEL SUBSCRIPTION
  ========================= */
  // const cancelSubscription = async () => {
  //   const activeSub = subscriptions.find((s) => s.is_active);

  //   if (!activeSub) {
  //     shopify.toast.show("No active subscription", {
  //       duration: 4000,
  //     });
  //     return;
  //   }

  //   try {
  //     await fetch("/api/deleteSubscription", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         storeId: user.storeId,
  //         subscriptionChargeId: activeSub.subscription_charge_id,
  //       }),
  //     });

  //     shopify.toast.show("Subscription cancelled", {
  //       duration: 4000,
  //     });

  //     window.location.reload();
  //   } catch (error) {
  //     shopify.toast.show("Cancel failed", {
  //       duration: 4000,
  //     });
  //   }
  // };
  const cancelSubscription = async () => {
    if (isLoading) return;

    const activeSub = subscriptions.find((s) => s.is_active);
    if (!activeSub) return;

    setIsLoading(true);
    setProcessingPlanId("cancel");

    try {
      await fetch("/api/deleteSubscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: user.storeId,
          subscriptionChargeId: activeSub.subscription_charge_id,
        }),
      });

      shopify.toast.show("Subscription cancelled", { duration: 4000 });

      await revalidator.revalidate(); // 👈 loader re-run
      setIsLoading(false);
      setProcessingPlanId(null);
    } catch (error) {
      shopify.toast.show("Cancel failed", { duration: 4000 });
      setIsLoading(false);
      setProcessingPlanId(null);
    }
  };

  return (
    <>
      <s-page title="Choose Your Plan" fullWidth>
        {/* PLANS */}
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))"
          gap="large" paddingBlockStart="large-500"
        >
          {plans.map((plan) => {
            const activePricingId =
              activeSubscription?.subscription_plan_id === "FREE"
                ? 0
                : Number(activeSubscription?.subscription_plan_id);

            const planId = Number(plan.id);
            const isFreePlan = plan.price === 0;

            const isPlanActive =
              (isFreePlan &&
                activeSubscription.subscription_plan_id === "FREE") ||
              activePricingId === planId;

            return (
              <s-section key={plan.id}>
                <s-box padding="large" border="divider">
                  {/* HEADER ROW */}
                  <s-box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    width="100%"
                  >
                    <s-grid
                      gridTemplateColumns="1fr auto"
                      alignItems="center"
                      gap="base"
                      paddingBlockEnd="base"
                    >
                      {/* LEFT */}
                      <s-grid-item>
                        <s-text as="h2" type="strong">
                          <strong>{plan.name}</strong>{" "}
                          <strong>₹{plan.price}</strong>
                        </s-text>
                      </s-grid-item>

                      {/* RIGHT */}
                      {isPlanActive && (
                        <s-grid-item>
                          <s-badge tone="success">Active</s-badge>
                        </s-grid-item>
                      )}
                    </s-grid>
                  </s-box>

                  <s-divider />

                  {/* FEATURES */}
                  <s-stack align="center" paddingBlockStart="base">
                    {plan.pricing_features?.split(",").map((feature, index) => (
                      <s-text key={index}>✔ {feature.trim()}</s-text>
                    ))}
                  </s-stack>

                  {/* ACTIONS */}
                  <s-box paddingBlockStart="base">
                    {/* CASE 1: PAID PLAN ACTIVE → Show Cancel */}
                    {isPlanActive && !isFreePlan && (
                      <s-box
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        gap="small"
                      >
                        {/* <s-button
             
                         tone="critical" variant="primary"
                          disabled={isLoading}
                          onClick={cancelSubscription}
                        >
                          {processingPlanId === "cancel"
                            ? "Processing…"
                            : "Cancel Subscription"}
                        </s-button> */}
                        <s-button
                          tone="critical"
                          variant="primary"
                          disabled={isLoading}
                          onClick={() => cancelModalRef.current?.show()}
                        >
                          Cancel Subscription
                        </s-button>
                      </s-box>
                    )}

                    {/* CASE 2: PLAN NOT ACTIVE → Show Activate */}
                    {!isPlanActive && (
                      <s-button
                        variant="primary"
                        tone="success"
                        disabled={isLoading}
                        onClick={() => createSubscription(plan)}
                      >
                        {processingPlanId === plan.id
                          ? "Processing…"
                          : "Activate Plan"}
                      </s-button>
                    )}

                    {/* CASE 3: FREE PLAN ACTIVE → NOTHING (only badge) */}
                  </s-box>
                </s-box>
              </s-section>
            );
          })}
        </s-grid>
        <ui-modal ref={cancelModalRef} id="cancel-subscription-modal">
          <ui-title-bar title="Cancel Subscription">
            <button
              variant="primary"
              tone="critical"
              onClick={confirmCancelSubscription}
            >
              Yes, Cancel
            </button>
            <button onClick={() => cancelModalRef.current?.hide()}>
              Keep Subscription
            </button>
          </ui-title-bar>

          <s-box padding="large">
            <s-text>
              Are you sure you want to cancel your subscription? Your plan
              benefits will be removed immediately.
            </s-text>
          </s-box>
        </ui-modal>
      </s-page>
    </>
  );
}
