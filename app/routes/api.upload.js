import path from "path";
import { json } from "@remix-run/node";
import fs from "fs/promises";
import { Buffer } from "buffer";
import fetch from 'node-fetch';

const SHOPIFY_API_URL = `${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-10/graphql.json`;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const SHOPIFY_DIR_URL = process.env.SHOPIFY_DIR_URL_1;

console.log('====================================');
console.log(SHOPIFY_DIR_URL);
console.log(SHOPIFY_ACCESS_TOKEN);
console.log(SHOPIFY_API_URL);
console.log('====================================');

export const action = async ({ request }) => {
  console.log("Received upload request");

  const uploadDirectory = path.resolve("app", "uploads");
  console.log("Upload directory set to:", uploadDirectory);

  // Ensure the upload directory exists
  try {
    await fs.mkdir(uploadDirectory, { recursive: true });
    console.log("Upload directory verified/created");
  } catch (error) {
    console.error("Error creating upload directory:", error);
    return json({ error: "Failed to create upload directory" }, { status: 500 });
  }

  // Parse incoming JSON body
  let formData;
  try {
    formData = await request.json(); // Parse JSON body
    console.log("Form data parsed successfully.");
  } catch (error) {
    console.error("Error parsing form data:", error);
    return json({ error: "Failed to parse form data" }, { status: 400 });
  }

  // Check for the 'delete' flag in the payload
  if (formData.delete) {
    console.log("Delete flag is set to true. Deleting files...");

    try {
      await handleDeleteFiles(uploadDirectory); // Delete files in the upload folder
      console.log("Files deleted successfully.");

      // Respond with a success message
      return json({ message: "Files deleted successfully." }, { status: 200 });
    } catch (error) {
      console.error("Error deleting files:", error);
      return json({ error: "Failed to delete files" }, { status: 500 });
    }
  }

  // If 'delete' flag is not set, proceed with file upload
  const fileDetails = formData.files;

  // If no files are provided
  if (!fileDetails || fileDetails.length === 0) {
    console.error("No valid image files uploaded");
    return json({ error: "No valid files uploaded" }, { status: 400 });
  }

  console.log(`Found ${fileDetails.length} file(s). Verifying file paths...`);

  const fileIds = [];
  const imageUrls = []; // Store image URLs

  // Start the upload process for each file
  for (const file of fileDetails) {
    const filePath = path.join(uploadDirectory, file.name);
    console.log(`Checking if file exists at path: ${filePath}`);

    try {
      // Decode base64 string to binary data and save the file
      const base64Data = file.base64.split(",")[1]; // Remove the prefix (data:image/jpeg;base64,)
      const buffer = Buffer.from(base64Data, "base64");

      await fs.writeFile(filePath, buffer); // Save the file
      console.log(`File successfully saved: ${file.name}`);

      // Create the file in Shopify using the external URL
      const fileUrl = `${SHOPIFY_DIR_URL}/app/uploads/${file.name}`;

      console.log("Creating file in Shopify with URL:", fileUrl);

      const fileId = await createFileInShopify(fileUrl, file.name);

      fileIds.push(fileId); // Add the file id (gid) to the array

    } catch (error) {
      console.error(`Failed to save file: ${file.name}`, error);
      return json({ error: `Failed to save file: ${file.name}` }, { status: 500 });
    }
  }

  console.log("File(s) uploaded successfully, returning URLs:", imageUrls);

  // Fetch media details by gids after files are created
  if (fileIds.length > 0) {
    try {
      let retries = 0;
      const maxRetries = 20; // Retry 20 times

      for (const fileId of fileIds) {
        let mediaDetails = null;
        let urlFound = false;

        while (retries < maxRetries && !urlFound) {
          mediaDetails = await getMediaByGids([fileId]);
          console.log(`Attempt #${retries + 1}: Fetched media details:`, mediaDetails);

          // Check if a valid image URL is found
          const validMedia = mediaDetails.find((media) => media.preview?.image?.url);
          if (validMedia) {
            console.log("URL found:", validMedia.preview.image.url);
            imageUrls.push(validMedia.preview.image.url); // Add the URL to the array
            urlFound = true; // URL found, stop retrying
          }

          retries++;
          if (!urlFound) {
            console.log("No valid image URL found, retrying...");
            await new Promise((resolve) => setTimeout(resolve, 500)); // Wait before retrying
          }
        }

        if (retries === maxRetries) {
          console.log("Max retries reached. No valid image URL found.");
        }
      }

    } catch (error) {
      console.error("Error fetching media details:", error);
    }
  }

  // Return the final array of image URLs
  return json({
    imageUrls,
    message: "Upload successful!",
    filesUploaded: fileDetails.length,
  }, { status: 200 });
};

// Function to delete files from the upload directory
async function handleDeleteFiles(uploadDirectory) {
  const files = await fs.readdir(uploadDirectory);

  for (const file of files) {
    const filePath = path.join(uploadDirectory, file);
    try {
      await fs.unlink(filePath);
      console.log(`File deleted: ${file}`);
    } catch (error) {
      console.error(`Error deleting file ${file}:`, error);
    }
  }
}

async function createFileInShopify(fileUrl, fileName) {
  try {
    const graphqlQuery = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            alt
            createdAt
            ... on MediaImage {
              image {
                width
                height
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;

    const variables = {
      files: [{
        alt: "Uploaded file from external URL",  // Alt text for the file
        contentType: "IMAGE",  // Change to FILE for non-image files
        originalSource: fileUrl,  // URL of the file
        filename: fileName,  // File name
      }]
    };

    const response = await fetch(SHOPIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: graphqlQuery, variables: variables })
    });

    const data = await response.json();
    if (data.errors) {
      console.error("GraphQL Errors:", data.errors);
      throw new Error("Error creating file in Shopify");
    }

    // Extract file id (gid) from the response
    const fileId = data.data.fileCreate.files[0]?.id;
    if (!fileId) {
      throw new Error("Failed to get file ID from Shopify");
    }

    console.log(`File successfully created in Shopify. File ID: ${fileId}`);
    return fileId;
  } catch (error) {
    console.error("Error creating file in Shopify:", error);
    throw new Error("Error creating file in Shopify");
  }
}

// Function to fetch media details by gids
async function getMediaByGids(ids) {
  const graphqlQuery = `
    query GetMediaByGids($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Media {
          alt
          id
          preview {
            image {
              url
              altText
              width
              height
            }
          }
        }
      }
    }`;

  const variables = { ids };

  try {
    const response = await fetch(SHOPIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: graphqlQuery, variables: variables })
    });

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL Errors:", data.errors);
      throw new Error("Error fetching media details");
    }

    // Return the media nodes fetched
    return data.data.nodes;
  } catch (error) {
    console.error("Error fetching media details:", error);
    throw new Error("Error fetching media details");
  }
}
