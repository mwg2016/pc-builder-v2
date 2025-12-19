import prisma from "../db.server";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import PCBuilderHomePage from "../components/PCBuilderHomePage";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`query { shop { id } }`);
    const result = await response.json();
    const shopId = result?.data?.shop?.id?.split("/").pop();

    if (!shopId) throw new Error("Shop ID not found");

    const widgets = await prisma.WidgetList.findMany({
      where: { storeid: shopId },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify({ widgets, shopId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("🔥 Error fetching shop ID:", error);
    return new Response(JSON.stringify({ widgets: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};

export default function PCBuilderRoute() {
  const { widgets: loaderWidgets, shopId } = useLoaderData();
  return <PCBuilderHomePage loaderWidgets={loaderWidgets} shopId={shopId} />;
}
