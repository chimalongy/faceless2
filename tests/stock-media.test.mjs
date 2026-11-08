import test from "node:test";
import assert from "node:assert/strict";
import {
  extractKeywords,
  searchPexels,
  searchPixabay,
  searchStockMedia,
} from "../src/lib/stock-media.js";

test("extractKeywords strips boilerplate and stop words", () => {
  const prompt = "Cinematic 8k photorealistic shot of an ancient Roman colosseum in golden hour";
  const narrative = "The gladiators entered the great arena.";
  const keywords = extractKeywords(prompt, narrative, 3);
  
  assert.equal(keywords, "ancient roman colosseum");
});

test("extractKeywords handles minimal or empty input", () => {
  const keywords = extractKeywords("", "", 3);
  assert.equal(keywords, "cinematic landscape");
});

test("searchPexels searches photos with correct headers and maps response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, "mock-pexels-key");
    const u = new URL(url);
    assert.equal(u.searchParams.get("query"), "mountains");
    assert.equal(u.searchParams.get("orientation"), "landscape");

    return {
      ok: true,
      json: async () => ({
        photos: [
          {
            id: 12345,
            width: 1920,
            height: 1080,
            url: "https://www.pexels.com/photo/12345",
            photographer: "John Doe",
            photographer_url: "https://www.pexels.com/@johndoe",
            alt: "Snowy Mountain Peak",
            src: {
              original: "https://images.pexels.com/photos/12345/original.jpg",
              large2x: "https://images.pexels.com/photos/12345/large2x.jpg",
              large: "https://images.pexels.com/photos/12345/large.jpg",
              medium: "https://images.pexels.com/photos/12345/medium.jpg",
              tiny: "https://images.pexels.com/photos/12345/tiny.jpg",
            },
          },
        ],
      }),
    };
  };

  try {
    const results = await searchPexels({
      query: "mountains",
      mediaType: "photos",
      orientation: "landscape",
      apiKey: "mock-pexels-key",
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].id, "pexels-photo-12345");
    assert.equal(results[0].source, "pexels");
    assert.equal(results[0].mediaType, "photo");
    assert.equal(results[0].title, "Snowy Mountain Peak");
    assert.equal(results[0].author, "John Doe");
    assert.equal(results[0].downloadUrl, "https://images.pexels.com/photos/12345/large2x.jpg");
    assert.equal(results[0].aspectRatio, "16:9");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searchPixabay searches photos with horizontal orientation for landscape", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    assert.equal(u.searchParams.get("key"), "mock-pixabay-key");
    assert.equal(u.searchParams.get("q"), "neon city");
    assert.equal(u.searchParams.get("orientation"), "horizontal");

    return {
      ok: true,
      json: async () => ({
        hits: [
          {
            id: 67890,
            pageURL: "https://pixabay.com/photos/67890",
            tags: "neon, city, futuristic",
            imageWidth: 1920,
            imageHeight: 1080,
            user: "CyberArtist",
            user_id: 99,
            previewURL: "https://pixabay.com/preview.jpg",
            webformatURL: "https://pixabay.com/webformat.jpg",
            largeImageURL: "https://pixabay.com/large.jpg",
          },
        ],
      }),
    };
  };

  try {
    const results = await searchPixabay({
      query: "neon city",
      mediaType: "photos",
      orientation: "landscape",
      apiKey: "mock-pixabay-key",
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].id, "pixabay-photo-67890");
    assert.equal(results[0].source, "pixabay");
    assert.equal(results[0].downloadUrl, "https://pixabay.com/large.jpg");
    assert.equal(results[0].aspectRatio, "16:9");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searchStockMedia returns empty array when query is empty", async () => {
  const res = await searchStockMedia({ query: "" });
  assert.equal(res.results.length, 0);
  assert.equal(res.total, 0);
});

