import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useActionData, useSubmit } from "react-router";
import prisma from "../db.server";

// ---------------- Loader ----------------
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
export const action = async ({ request }) => {
  const formData = await request.formData();

  const subject = formData.get("subject");
  const email = formData.get("email");
  const message = formData.get("message");
  const imageUrls = formData.getAll("imageUrls"); // Get all image URLs from the form data

  if (!subject || !email || !message) {
    return { error: "All fields are required" };
  }

  // Ensure that imageUrls is an array of strings
  const imageUrlsArray = imageUrls.map((url) => url);

  // ✅ Store the data in the Feature model, saving image URLs as an array in JSON
  await prisma.feature.create({
    data: {
      subject,
      email,
      message,
      image_url: imageUrlsArray, // Use `image_url` to match the model definition
      status: "ACTIVE",
    },
  });

  return { message: "Request submitted successfully" };
};

// ---------------- Component ----------------
export default function Faq() {
  const actionData = useActionData();
  const shopify = useAppBridge();
  const submit = useSubmit();
  const [selected, setSelected] = useState("section_request");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]); // To store the uploaded image URLs
  const [dropZoneKey, setDropZoneKey] = useState(0);
  const [imageError, setImageError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  const options = [
    { label: "Request a new feature", value: "feature_request" },
    { label: "Report an issue", value: "bug_report" },
    { label: "Customization request", value: "customization_request" },
    { label: "Engraving not working", value: "engraving_issue" },
    { label: "Engraving option missing", value: "engraving_missing" },
    { label: "Other", value: "other" },
  ];

  // Input handlers
  const handleSelectChange = useCallback(
    (event) => setSelected(event.target.value),
    [],
  );

  const handleEmailChange = useCallback(
    (event) => setEmail(event.target.value),
    [],
  );

  const handleMessageChange = useCallback(
    (event) => setMessage(event.target.value),
    [],
  );

  // Trigger toast on success
 useEffect(() => {
  if (actionData?.message || actionData?.error) {
    setIsSubmitting(false);
  }

  if (actionData?.message) {
    shopify.toast.show(actionData.message);
    setEmail("");
    setMessage("");
    setImages([]);
  }
}, [actionData, shopify]);


  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [images]);

  // const handleUpload = async () => {
  //   if (images.length === 0) {
  //     // If no images, directly submit the form
  //     handleSubmit();
  //     return;
  //   }

  //   // Simulate an image upload to a server
  //   const fileDetails = await Promise.all(
  //     images.map(async (image) => {
  //       const base64 = await new Promise((resolve, reject) => {
  //         const reader = new FileReader();
  //         reader.onloadend = () => resolve(reader.result);
  //         reader.onerror = reject;
  //         reader.readAsDataURL(image.file);
  //       });

  //       return {
  //         name: image.file.name,
  //         size: image.file.size,
  //         type: image.file.type,
  //         base64: base64,
  //       };
  //     }),
  //   );

  //   // Send the file details to the server
  //   try {
  //     const response = await fetch("/api/upload", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ files: fileDetails }),
  //     });

  //     if (response.ok) {
  //       const result = await response.json();
  //       console.log("Files uploaded successfully:", result);

  //       // Assuming result.imageUrls contains the URLs of the uploaded images
  //       const newImageUrls = result.imageUrls; // This is an array of image URLs

  //       // Store the URLs in the state (to send to the backend)
  //       setUploadedUrls(newImageUrls);

  //       // Now, submit the form after image upload
  //       await handleSubmit(newImageUrls); // Pass the URLs when submitting the form

  //       // Call handleDeleteFiles to remove the files from the server after successful upload
  //       await handleDeleteFiles(newImageUrls);
  //     } else {
  //       const errorMessage = await response.text();
  //       console.error("Upload failed:", errorMessage);
  //     }
  //   } catch (error) {
  //     console.error("Error uploading files:", error);
  //   }
  // };
const handleUpload = async () => {
  if (isSubmitting) return;

  setIsSubmitting(true);

  try {
    if (images.length === 0) {
      handleSubmit();
      return;
    }

    const fileDetails = await Promise.all(
      images.map(async (image) => {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(image.file);
        });

        return {
          name: image.file.name,
          size: image.file.size,
          type: image.file.type,
          base64,
        };
      })
    );

    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: fileDetails }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    const newImageUrls = result.imageUrls || [];

    await handleSubmit(newImageUrls);
    await handleDeleteFiles(newImageUrls);

  } catch (error) {
    console.error(error);
    shopify.toast.show("Something went wrong", { isError: true });
  }
};

  const handleDeleteFiles = async (imageUrls) => {
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          delete: true,
          imageUrls: imageUrls, // Pass the URLs to delete the corresponding files from the server
        }),
      });

      if (response.ok) {
        console.log("Files deleted successfully.");
      } else {
        const errorMessage = await response.text();
        console.error("Failed to delete files:", errorMessage);
      }
    } catch (error) {
      console.error("Error deleting files:", error);
    }
  };

  const handleSubmit = (imageUrls = []) => {
    const formData = new FormData();
    formData.append("subject", selected);
    formData.append("email", email);
    formData.append("message", message);

    // Append image URLs to form data if images exist
    imageUrls.forEach((url) => {
      formData.append("imageUrls", url);
    });

    // Submit the form with image URLs
    submit(formData, { method: "post" });
  };

  // Handle file input
  const handleInput = (event) => {
    console.log("onInput", event.currentTarget?.files);
  };

  // Handle change in file selection
  // const handleChange = (event) => {
  //   const files = Array.from(event.currentTarget.files || []);
  //   console.log("onChange - Files selected:", files);

  //   // Limit to 10 files
  //   if (files.length + images.length > 5) {
  //     alert("You can upload up to 5 images only.");
  //     return;
  //   }

  //   // Create image previews
  //   const imagePreviews = files.map((file) => ({
  //     id: crypto.randomUUID(),
  //     file,
  //     url: URL.createObjectURL(file),
  //   }));

  //   // Update state with new images
  //   setImages((prev) => [...prev, ...imagePreviews]);
  // };
  const MAX_IMAGES = 5;

  const handleChange = (event) => {
    const files = Array.from(event.currentTarget.files || []);

    if (files.length + images.length > MAX_IMAGES) {
      setImageError(`You can upload up to ${MAX_IMAGES} images only.`);
      return;
    }

    // clear error when valid
    setImageError("");

    const imagePreviews = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...imagePreviews]);
  };

  // Handle image upload to server (optional step)
  // const handleUpload = async () => {
  //   if (images.length === 0) {
  //     // If no images, directly submit the form
  //     handleSubmit();
  //     return;
  //   }

  //   // Simulating an image upload to a server
  //   const fileDetails = await Promise.all(
  //     images.map(async (image) => {
  //       const base64 = await new Promise((resolve, reject) => {
  //         const reader = new FileReader();
  //         reader.onloadend = () => resolve(reader.result);
  //         reader.onerror = reject;
  //         reader.readAsDataURL(image.file);
  //       });

  //       return {
  //         name: image.file.name,
  //         size: image.file.size,
  //         type: image.file.type,
  //         base64: base64,
  //       };
  //     })
  //   );

  //   // Send the file details to the server
  //   try {
  //     const response = await fetch("/api/upload", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ files: fileDetails }),
  //     });

  //     if (response.ok) {
  //       const result = await response.json();
  //       console.log("Files uploaded successfully:", result);

  //       // Update images list with the URLs returned from the server
  //       const newImageUrls = result.imageUrls.map((url) => ({
  //         id: crypto.randomUUID(),
  //         url,
  //       }));

  //       setUploadedUrls(newImageUrls.map((img) => img.url)); // Store URLs
  //       setImages((prevImages) => [...prevImages, ...newImageUrls]);

  //       // Log the URLs
  //       console.log("Uploaded image URLs:", newImageUrls.map((img) => img.url));

  //       // Now, submit the form after image upload
  //       handleSubmit();
  //     } else {
  //       const errorMessage = await response.text();
  //       console.error("Upload failed:", errorMessage);
  //     }
  //   } catch (error) {
  //     console.error("Error uploading files:", error);
  //   }
  // };

  // Remove an image from the list
  const handleRemove = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <s-page>
      <s-section narrowWidth>
        <s-stack gap="base">
          {/* Header */}
          <s-box paddingBlockEnd="400">
            <s-stack gap="100">
              <s-text variant="headingXl" as="h2" alignment="center">
                <strong>
                Request a Feature
                </strong>
              </s-text>
              <s-text alignment="center" tone="subdued">
                Tell us what you need or report an issue — we usually respond
                within 24 hours.
              </s-text>
            </s-stack>
          </s-box>

          {/* Form Card */}
          <s-box
            background="bg-surface"
            padding="600"
            borderRadius="400"
            shadow="200"
          >
            <s-stack gap="base">
              <s-select
                label="Request type"
                name="subject"
                value={selected}
                disabled={isSubmitting}
                onChange={handleSelectChange}
                required
              >
                {options.map((option) => (
                  <s-option key={option.value} value={option.value}>
                    {option.label}
                  </s-option>
                ))}
              </s-select>

              <s-text-field
                label="Email address"
                type="email"
                name="email"
                value={email}
                disabled={isSubmitting}
                onChange={handleEmailChange}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
              <s-text-area
                label="Message"
                name="message"
                value={message}
                disabled={isSubmitting}
                onChange={handleMessageChange}
                multiline={5}
                placeholder="Describe your request or issue in detail..."
                required
              />
              <s-box>
                <s-text as="p" tone="subdued" paddingBlockEnd="200">
                  Optional attachment (screenshot or image)
                </s-text>

                <s-drop-zone
                  key={dropZoneKey}
                  label="Upload"
                  accessibilityLabel="Upload image of type jpg, png, or gif"
                  accept=".jpg,.png,.gif"
                  multiple
                  disabled={isSubmitting || images.length >= 5}
                  onInput={handleInput}
                  onChange={handleChange}
                />
                {imageError && (
                  <s-text as="span" tone="critical">
                    {imageError}
                  </s-text>
                )}
                {/* Image Preview Section */}
                <s-grid
                  gridTemplateColumns="repeat(5, 1fr)" // 2 images per row
                  gap="small"
                  justifyContent="center"
                  padding="base"
                >
                  {images.map((img) => (
                    <s-grid-item key={img.id}>
                      <s-section>
                        <s-box block-size="150px">
                          <s-stack
                            gap="base"
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                          >
                            <s-image
                              objectFit="cover"
                              src={img.url}
                              alt={img.file ? img.file.name : "Image"}
                              aspectRatio="1"
                              borderRadius="small"
                            />

                            {/* Remove Button */}
                            <s-button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleRemove(img.id)}
                              aria-label="Remove image"
                            >
                              Delete
                            </s-button>
                          </s-stack>
                        </s-box>
                      </s-section>
                    </s-grid-item>
                  ))}
                </s-grid>
              </s-box>

              {/* Error */}
              {actionData?.error && (
                <s-text tone="critical" variant="headingSm">
                  {actionData.error}
                </s-text>
              )}

              {/* Submit */}
              <s-box alignment="center">
                <s-button
  variant="primary"
  size="large"
  disabled={isSubmitting}
  onClick={handleUpload}
>
  {isSubmitting ? "Processing…" : "Submit Request"}
</s-button>

              </s-box>
            </s-stack>
          </s-box>

          {/* Support Card */}
        </s-stack>
      </s-section>
      <s-box background="bg-fill" padding="600" borderRadius="400">
        <s-stack display="flex" justifyContent="center" alignItems="center">
          <s-text variant="headingMd" alignment="center">
            <strong>Need immediate support?</strong>
          </s-text>

          <s-box>
            <s-text alignment="center">
              📧{" "}
              <s-link href="mailto:reach.miraclewebsoft@gmail.com">
                reach.miraclewebsoft@gmail.com
              </s-link>
            </s-text>

            <s-text alignment="center">
              💬{" "}
              <s-link href="https://wa.me/916223926976">
                WhatsApp: +91 62239 26976
              </s-link>
            </s-text>
          </s-box>
        </s-stack>
      </s-box>
    </s-page>
  );
}
