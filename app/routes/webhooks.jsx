import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendGoodbyeEmail } from "../utility/mail";
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log('shop--------------------------------------------------------->', shop);
  console.log('topic-------------------------------------------------------->', topic);  

  if (topic === 'APP_SUBSCRIPTIONS_UPDATE') {
    console.log('APP_SUBSCRIPTIONS_UPDATE webhook called...');
    console.log(payload);
    
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