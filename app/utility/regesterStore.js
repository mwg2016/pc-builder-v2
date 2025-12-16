import prisma from "../db.server";
import { sendWelcomeEmail } from "./mail";

export async function registerStore(session, admin) {
  console.log('====================================');
  console.log('checking');
  console.log('====================================');
  try {

    const {
      id,
      shop,
      state,
      isOnline,
      scope,
      expires,
      accessToken = "",
    } = session;

    console.log("📦 Session Data:", {
      id,
      shop,
      isOnline,
      scope,
      expires,
    });

    // ✅ Fetch shop data using authenticated admin
    console.log("📡 Fetching shop data via GraphQL...");

    const response = await admin.graphql(`
      query {
        shop {
          id
          name
          url
          email
          myshopifyDomain
          currencyCode
          createdAt
        }
      }
    `);

    const result = await response.json();
    const shopInfo = result?.data?.shop;

    if (!shopInfo) {
      console.error("❌ Shop info not found:", result);
      return;
    }

    console.log("🏪 Shop Info Fetched:", shopInfo);

    // ✅ Register or Update User
    console.log("👤 Checking user in DB...");

    let user = await prisma.user.findUnique({
      where: { storeId: shopInfo.id },
    });

    if (!user) {
      console.log("➕ Creating new user...");

      user = await prisma.user.create({
        data: {
          storeId: shopInfo.id,
          storeName: shopInfo.name,
          domain: shopInfo.myshopifyDomain,
          currency: shopInfo.currencyCode,
          email: shopInfo.email,
          storeCreatedAt: shopInfo.createdAt,
          userStatus: "ACTIVE",
          updatedAt: new Date(),
        },
      });

      console.log("✅ New user created:", user.id);
    } else {
      console.log("♻️ Updating existing user...");

      user = await prisma.user.update({
        where: { storeId: shopInfo.id },
        data: {
          storeName: shopInfo.name,
          domain: shopInfo.myshopifyDomain,
          currency: shopInfo.currencyCode,
          email: shopInfo.email,
          userStatus: "ACTIVE",
          updatedAt: new Date(),
        },
      });

      console.log("✅ User updated:", user.id);
    }

    const userId = user.id;

    // ✅ Register or Update Session
    console.log("🗂️ Checking session in DB...");

    let userSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!userSession) {
      console.log("➕ Creating session...");

      userSession = await prisma.session.create({
        data: {
          id,
          shop,
          state,
          isOnline,
          scope,
          userId,
          expires,
          accessToken,
        },
      });

      console.log("✅ Session created");
    } else {
      console.log("♻️ Updating session...");

      userSession = await prisma.session.update({
        where: { id },
        data: {
          shop,
          state,
          isOnline,
          scope,
          userId,
          expires,
          accessToken,
        },
      });

      console.log("✅ Session updated");
    }

    console.log("🎉 Store registration completed successfully");
 // --- Send welcome email ---
    console.log("emial for sendWelcomeEmail", shopInfo.name,"----", shopInfo?.email, "-----", import.meta.env.APP_NAME )
    await sendWelcomeEmail(shopInfo.name, shopInfo?.email, import.meta.env.APP_NAME);
  } catch (error) {
    console.error("🔥 Register Store Error:", error);
  }
}
