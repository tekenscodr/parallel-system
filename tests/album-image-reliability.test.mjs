import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import sharp from "sharp";
import { resolveAlbumImage } from "../lib/album-images.ts";
import { ALBUM_PRINT_SCRIPT } from "../lib/album-print.ts";

const sample = await sharp({ create: { width: 30, height: 40, channels: 3, background: "red" } }).png().toBuffer();
const imageUrl = () => `https://photos.example.test/${crypto.randomUUID()}.jpg`;
const cacheFile = (url) => path.join(process.cwd(), ".cache/albums/webp", crypto.createHash("sha256").update(`v2_${url}_240_300_80`).digest("hex") + ".webp");

test("remote portraits retry transient HTTP failures and share concurrent downloads", async (t) => {
  const url = imageUrl();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1 ? new Response("temporary", { status: 503 }) : new Response(sample));
  const [first, second] = await Promise.all([resolveAlbumImage(url), resolveAlbumImage(url)]);
  assert.equal(calls, 2);
  assert.deepEqual(first, second);
  assert.equal((await sharp(first).metadata()).format, "webp");
  await fs.unlink(cacheFile(url));
});

test("interrupted response bodies retry; permanent failures are not cached", async (t) => {
  const url = imageUrl();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1) return { ok: true, arrayBuffer: async () => { throw new Error("connection reset"); } };
    return new Response(sample);
  });
  assert.ok(await resolveAlbumImage(url));
  assert.equal(calls, 2);
  await fs.unlink(cacheFile(url));
  const missing = imageUrl();
  t.mock.method(globalThis, "fetch", async () => new Response("missing", { status: 404 }));
  assert.equal(await resolveAlbumImage(missing), null);
  t.mock.method(globalThis, "fetch", async () => new Response(sample));
  assert.ok(await resolveAlbumImage(missing));
  await fs.unlink(cacheFile(missing));
});

test("corrupt cached images are rebuilt and invalid WebP data is rejected", async (t) => {
  const url = imageUrl();
  await fs.mkdir(path.dirname(cacheFile(url)), { recursive: true });
  await fs.writeFile(cacheFile(url), "broken image");
  t.mock.method(globalThis, "fetch", async () => new Response(sample));
  const result = await resolveAlbumImage(url);
  assert.equal((await sharp(result).metadata()).width, 240);
  assert.deepEqual(await fs.readFile(cacheFile(url)), result);
  assert.equal(await resolveAlbumImage("data:image/webp;base64,YnJva2Vu"), null);
  await fs.unlink(cacheFile(url));
});

test("public photo paths support escaped names, queries and relative URLs", async () => {
  const name = `album test ${crypto.randomUUID()}.png`;
  const filename = path.join(process.cwd(), "public", name);
  await fs.writeFile(filename, sample);
  const urls = [`/${encodeURIComponent(name)}?v=2#photo`, encodeURIComponent(name)];
  try {
    for (const url of urls) assert.equal((await sharp(await resolveAlbumImage(url)).metadata()).format, "webp");
  } finally {
    await fs.unlink(filename);
    for (const url of urls) await fs.unlink(cacheFile(url));
  }
});

test("printing waits for every portrait and font, including offscreen images", async () => {
  let finishImage, finishFonts;
  const delayed = new Promise((resolve) => { finishImage = resolve; });
  const fonts = new Promise((resolve) => { finishFonts = resolve; });
  const images = [
    { loading: "lazy", complete: true, naturalWidth: 240, decode: async () => {}, dataset: {} },
    { loading: "lazy", complete: false, naturalWidth: 0, decode: () => delayed, dataset: {} },
  ];
  const button = { disabled: true };
  let prints = 0;
  const context = { window: { print: () => { prints++; } }, document: { images, fonts: { ready: fonts }, documentElement: { dataset: {} }, getElementById: () => button } };
  vm.runInNewContext(ALBUM_PRINT_SCRIPT, context);
  const printing = context.window.printAlbum();
  assert.equal(prints, 0);
  assert.ok(images.every((image) => image.loading === "eager"));
  images[1].complete = true;
  images[1].naturalWidth = 240;
  finishImage();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(prints, 0, "fonts must finish before printing");
  finishFonts();
  await printing;
  assert.equal(prints, 1);
  assert.equal(button.disabled, false);
});

test("unrecoverable images keep printing disabled", async () => {
  const image = { complete: true, naturalWidth: 0, decode: async () => { throw new Error("decode failed"); }, dataset: {} };
  const button = {};
  let prints = 0;
  const context = { window: { print: () => { prints++; } }, document: { images: [image], fonts: { ready: Promise.resolve() }, documentElement: { dataset: {} }, getElementById: () => button } };
  vm.runInNewContext(ALBUM_PRINT_SCRIPT, context);
  await context.window.printAlbum();
  assert.equal(prints, 0);
  assert.equal(button.disabled, true);
});
