import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log('shop--------------------------------------------------------->', shop);
  console.log('topic-------------------------------------------------------->', topic);  

  if (topic === 'APP_SUBSCRIPTIONS_UPDATE') {
    console.log('APP_SUBSCRIPTIONS_UPDATE webhook called...');
    console.log(payload);
    
  }

  else if (topic === 'APP_UNINSTALLED') {
    console.log('app uninstalled webhook called...');
    console.log(payload);
    
  }

  return new Response();
};