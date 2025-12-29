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

// ---------------- Action ----------------
export const action = async ({ request }) => {
  const formData = await request.formData();

  const subject = formData.get("subject");
  const email = formData.get("email");
  const message = formData.get("message");
  const image = formData.get("image");

  if (!subject || !email || !message) {
    return { error: "All fields are required" };
  }

  //   let imageUrl = null;

  //   if (image && image.size > 0) {
  //     imageUrl = `/uploads/${image.name}`;
  //   }

  // ✅ Correct Prisma model usage
  await prisma.feature.create({
    data: {
      subject,
      email,
      message,
      //   imageUrl,
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
  const [imageFile, setImageFile] = useState(null);

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
    if (actionData?.message) {
      shopify.toast.show(actionData.message);
      setEmail("");
      setMessage("");
    }
  }, [actionData, shopify]);

  const handleSubmit = () => {
    const formData = new FormData();

    formData.append("subject", selected);
    formData.append("email", email);
    formData.append("message", message);

    if (imageFile) {
      formData.append("image", imageFile);
    }

    submit(formData, { method: "post" });
  };

  return (
    <s-page>
      <s-section narrowWidth>
        <s-stack gap="base">
          {/* Header */}
          <s-box paddingBlockEnd="400">
            <s-stack gap="100">
              <s-text variant="headingXl" as="h2" alignment="center">
                Request a Feature
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
                onChange={handleSelectChange}
                requiredIndicator
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
                onChange={handleEmailChange}
                autoComplete="email"
                placeholder="you@example.com"
                requiredIndicator
              />

              <s-text-field
                label="Message"
                name="message"
                value={message}
                onChange={handleMessageChange}
                multiline={5}
                placeholder="Describe your request or issue in detail..."
                requiredIndicator
              />

              {/* Upload */}
              <s-box>
                <s-text as="p" tone="subdued" paddingBlockEnd="200">
                  Optional attachment (screenshot or image)
                </s-text>

                <s-drop-zone
                  accessibilityLabel="Upload image"
                  accept=".jpg,.png,.gif"
                  multiple={false}
                  onDrop={(files) => setImageFile(files[0])}
                />
              </s-box>

              {/* Error */}
              {actionData?.error && (
                <s-text tone="critical" variant="headingSm">
                  {actionData.error}
                </s-text>
              )}

              {/* Submit */}
              <s-box alignment="center">
                <s-button variant="primary" size="large" onClick={handleSubmit}>
                  Submit request
                </s-button>
              </s-box>
            </s-stack>
          </s-box>

          {/* Support Card */}
          <s-box background="bg-fill" padding="600" borderRadius="400">
            <s-stack>
              <s-text variant="headingMd" alignment="center">
                Need immediate support?
              </s-text>

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
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}
