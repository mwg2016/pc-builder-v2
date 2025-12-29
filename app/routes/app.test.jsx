import { useState, useEffect } from "react";

const ImageUploader = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadedUrls, setUploadedUrls] = useState([]); // New state to store the uploaded image URLs


  // Handle file selection via drag or file input (but don't upload yet)
  const handleChange = (event) => {
    const files = Array.from(event.currentTarget.files || []);
    console.log("onChange - Files selected:", files);

    // Limit to 10 files
    if (files.length + images.length > 10) {
      alert("You can upload up to 10 images only.");
      return;
    }

    // Create image previews
    const imagePreviews = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));

    // Update state with new images
    setImages((prev) => [...prev, ...imagePreviews]);
  };

  const handleUpload = async () => {
  if (images.length === 0) {
    setUploadMessage("No images selected.");
    return;
  }

  setLoading(true);
  setUploadMessage("Uploading...");

  // Convert files to base64 for upload (optional, can be adjusted to your needs)
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
        base64: base64,
      };
    })
  );

  // Send the file details to the server
  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: fileDetails }), // Send files as JSON
    });

    if (response.ok) {
      const result = await response.json();
      console.log("Files uploaded successfully:", result);
      setUploadMessage("Upload successful!");

      // Update images list (using URLs returned from the server)
      const newImageUrls = result.imageUrls.map((url) => ({
        id: crypto.randomUUID(),
        url,
      }));

      // Update state with new images and the URLs
      setImages((prevImages) => [...prevImages, ...newImageUrls]);

      // Store the uploaded URLs in the state
      setUploadedUrls(newImageUrls.map((img) => img.url));

      // Log the URLs
      console.log("Uploaded image URLs:", newImageUrls.map((img) => img.url));

      // Trigger the file deletion after uploading
      await handleDeleteFiles();  // Delete files from server after successful upload
    } else {
      const errorMessage = await response.text();
      console.error("Upload failed:", errorMessage);
      setUploadMessage(`Upload failed: ${errorMessage}`);
    }
  } catch (error) {
    console.error("Error uploading files:", error);
    setUploadMessage("An error occurred. Please try again.");
  } finally {
    setLoading(false);
  }
};


  // Delete all files in the uploads folder
  const handleDeleteFiles = async () => {
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ delete: true }),
      });

      if (response.ok) {
        console.log("Files deleted successfully.");
      } else {
        console.error("Failed to delete files.");
      }
    } catch (error) {
      console.error("Error deleting files:", error);
    }
  };

  // Remove an image from the list
  const handleRemove = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Clean up URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [images]);

  return (
    <div>
      <div>
        <input
          type="file"
          accept=".jpg,.png,.gif"
          multiple
          onChange={handleChange}
        />
      </div>

      {loading ? (
        <div style={{ marginTop: "20px" }}>
          <p>{uploadMessage}</p>
          <div className="loader"></div>
        </div>
      ) : (
        <p>{uploadMessage}</p>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={loading || images.length === 0}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#3498db",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Upload
      </button>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        {images.map((img) => (
          <div key={img.id} style={{ position: "relative", width: "150px" }}>
            <img
              src={img.url}
              alt={img.file?.name || "Uploaded Image"}
              style={{
                width: "150px",
                height: "150px",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid #ddd",
              }}
            />
            <button
              type="button"
              onClick={() => handleRemove(img.id)}
              style={{
                position: "absolute",
                top: "6px",
                right: "6px",
                background: "rgba(0, 0, 0, 0.6)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                cursor: "pointer",
                fontSize: "14px",
                lineHeight: "24px",
              }}
              aria-label="Remove image"
            >
              ×
            </button>
            <p style={{ fontSize: "12px", marginTop: "4px" }}>
              {img.file?.name || "Uploaded Image"}
            </p>
          </div>
        ))}
      </div>

      {/* Display the uploaded URLs */}
      <div>
        <h3>Uploaded Image URLs:</h3>
        <ul>
          {uploadedUrls.map((url, index) => (
            <li key={index}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <style>
        {`
          .loader {
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 2s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ImageUploader;
