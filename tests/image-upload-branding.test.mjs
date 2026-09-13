import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { saveUploadedExecutiveImage } from "../lib/image-upload.ts";

const validPng = await sharp({
  create: { width: 10, height: 10, channels: 3, background: "green" },
})
  .png()
  .toBuffer();

function createDummyFile(buffer, type = "image/png", name = "test.png") {
  return new File([buffer], name, { type });
}

test("missing CDN credentials error mentions Party CDN and not WordPress", async () => {
  const originalEnv = { ...process.env };
  delete process.env.WORDPRESS_URL;
  delete process.env.WORDPRESS_USERNAME;
  delete process.env.WORDPRESS_APPLICATION_PASSWORD;
  delete process.env.EXECUTIVE_IMAGE_STORAGE;

  try {
    const file = createDummyFile(validPng);
    await assert.rejects(
      async () => {
        await saveUploadedExecutiveImage(file, "V12345");
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Party CDN image storage is not configured"));
        assert.ok(!/wordpress/i.test(err.message), `Message should not mention wordpress: ${err.message}`);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});

test("invalid URL or non-HTTPS error mentions Party CDN and not WordPress", async () => {
  const originalEnv = { ...process.env };
  process.env.WORDPRESS_URL = "http://not-https.example.com";
  process.env.WORDPRESS_USERNAME = "admin";
  process.env.WORDPRESS_APPLICATION_PASSWORD = "app-password";
  delete process.env.EXECUTIVE_IMAGE_STORAGE;

  try {
    const file = createDummyFile(validPng);
    await assert.rejects(
      async () => {
        await saveUploadedExecutiveImage(file, "V12345");
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Party CDN URL must use HTTPS"));
        assert.ok(!/wordpress/i.test(err.message), `Message should not mention wordpress: ${err.message}`);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});

test("Vercel local storage prohibition error mentions Party CDN and not WordPress", async () => {
  const originalEnv = { ...process.env };
  process.env.EXECUTIVE_IMAGE_STORAGE = "local";
  process.env.VERCEL = "1";

  try {
    const file = createDummyFile(validPng);
    await assert.rejects(
      async () => {
        await saveUploadedExecutiveImage(file, "V12345");
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Party CDN storage"));
        assert.ok(!/wordpress/i.test(err.message), `Message should not mention wordpress: ${err.message}`);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});

test("upload failure details containing WordPress are scrubbed to Party CDN", async (t) => {
  const originalEnv = { ...process.env };
  process.env.WORDPRESS_URL = "https://cdn.example.com";
  process.env.WORDPRESS_USERNAME = "admin";
  process.env.WORDPRESS_APPLICATION_PASSWORD = "secret";
  delete process.env.EXECUTIVE_IMAGE_STORAGE;
  delete process.env.VERCEL;

  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ message: "WordPress media error: upload forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  });

  try {
    const file = createDummyFile(validPng);
    await assert.rejects(
      async () => {
        await saveUploadedExecutiveImage(file, "V12345");
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Party CDN image upload failed"));
        assert.ok(!/wordpress/i.test(err.message), `Message should not mention wordpress: ${err.message}`);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});
