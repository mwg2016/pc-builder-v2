import prisma from "../db.server";

export async function action({ request }) {
  try {
    const method = request.method;
    const contentType = request.headers.get("Content-Type") || "";

    const body =
      contentType.includes("application/json")
        ? await request.json()
        : {};

    if (method === "POST") {
      const { name, status = "ACTIVE", shopId } = body;

      if (!name || !shopId) {
        return new Response(
          JSON.stringify({ error: "Invalid payload" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const widget = await prisma.WidgetList.create({
        data: {
          id: crypto.randomUUID(),
          name,
          status,
          storeid: shopId,
        },
      });

      return Response.json({ success: true, widget });
    }

    if (method === "PATCH") {
      const { id, name, status } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Invalid payload" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const widget = await prisma.WidgetList.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(status !== undefined && { status }),
          updatedAt: new Date(),
        },
      });

      return Response.json({ success: true, widget });
    }

    if (method === "DELETE") {
      const id = new URL(request.url).searchParams.get("id");

      if (id) {
        await prisma.WidgetList.deleteMany({ where: { id } });
        await prisma.Widget.deleteMany({ where: { widget_id: id } });
      }

      return Response.json({ success: true });
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Widget API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
