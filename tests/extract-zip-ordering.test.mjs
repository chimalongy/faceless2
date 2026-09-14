import assert from "node:assert";
import { parseImageFileName, getImageIndex, sortSceneImages } from "../src/lib/scene-images.js";

console.log("Running comprehensive scene image ordering verification...");

const testFiles = [
  "3_2.png_20260913055847", // Intentionally out of order as in real ZIPs
  "1_2.png_20260913055849",
  "2_2.png_20260913055849",
  "1_1.png_20260913055849",
  "3_1.png_20260913055849",
  "2_1.png_20260913055850"
];

// Step 1: Parse and count scenes
const sceneCounts = new Map();
const parsedCandidates = [];

for (const fileName of testFiles) {
  const parsed = parseImageFileName(fileName);
  assert.ok(parsed.sceneIndex != null, `Must have sceneIndex for ${fileName}`);
  assert.ok(parsed.imageIndex != null, `Must have imageIndex for ${fileName}`);
  
  const count = sceneCounts.get(parsed.sceneIndex) || 0;
  sceneCounts.set(parsed.sceneIndex, count + 1);

  parsedCandidates.push({
    fullFileName: fileName,
    ...parsed,
  });
}

// Step 2: Sort candidates (ExtractZipImages logic)
parsedCandidates.sort((a, b) => {
  if (a.isThumbnail && !b.isThumbnail) return -1;
  if (!a.isThumbnail && b.isThumbnail) return 1;
  if (a.isThumbnail && b.isThumbnail) return 0;
  if (a.sceneIndex !== b.sceneIndex) return a.sceneIndex - b.sceneIndex;
  return a.imageIndex - b.imageIndex;
});

// Verify candidate ordering
const orderedFileNames = parsedCandidates.map(c => c.fullFileName);
assert.deepStrictEqual(orderedFileNames, [
  "1_1.png_20260913055849",
  "1_2.png_20260913055849",
  "2_1.png_20260913055850",
  "2_2.png_20260913055849",
  "3_1.png_20260913055849",
  "3_2.png_20260913055847"
]);
console.log("✓ Step 1 & 2: ZIP candidate sorting passed.");

// Step 3: Simulate ExtractZipImages results generation
const extractionResults = [];
for (const item of parsedCandidates) {
  const hasMultiple = (sceneCounts.get(item.sceneIndex) || 0) > 1 || item.isMultiIndexed || item.imageIndex > 1;
  const assetFileName = hasMultiple ? `scene-${item.sceneIndex}-${item.imageIndex}.${item.ext}` : `scene-${item.sceneIndex}.${item.ext}`;
  extractionResults.push({
    sceneIndex: item.sceneIndex,
    imageIndex: item.imageIndex,
    fileName: assetFileName,
    publicUrl: `https://r2.example.com/${assetFileName}`,
    key: `channels/demo/topics/demo/images/${assetFileName}`,
  });
}

assert.strictEqual(extractionResults[0].fileName, "scene-1-1.png");
assert.strictEqual(extractionResults[1].fileName, "scene-1-2.png");
assert.strictEqual(extractionResults[2].fileName, "scene-2-1.png");
assert.strictEqual(extractionResults[3].fileName, "scene-2-2.png");
assert.strictEqual(extractionResults[4].fileName, "scene-3-1.png");
assert.strictEqual(extractionResults[5].fileName, "scene-3-2.png");
console.log("✓ Step 3: Asset file naming passed.");

// Step 4: Simulate page.jsx handleUploadZipImages mapping
const sceneImages = {};
const extractedScenes = new Set(extractionResults.map(img => Number(img.sceneIndex)).filter(Boolean));
extractedScenes.forEach(sNum => {
  delete sceneImages[sNum];
});

extractionResults.forEach((img) => {
  const sIdx = Number(img.sceneIndex);
  const frameIdx = img.imageIndex || getImageIndex(img.fileName, sIdx);
  const imgObj = {
    url: img.publicUrl,
    key: img.key,
    name: img.fileName,
    imageIndex: frameIdx,
  };

  if (!sceneImages[sIdx]) {
    sceneImages[sIdx] = {
      url: img.publicUrl,
      key: img.key,
      name: img.fileName,
      images: [imgObj],
    };
  } else {
    sceneImages[sIdx].images.push(imgObj);
  }
});

Object.keys(sceneImages).forEach((sIdx) => {
  if (Array.isArray(sceneImages[sIdx]?.images) && sceneImages[sIdx].images.length > 1) {
    sceneImages[sIdx].images = sortSceneImages(sceneImages[sIdx].images, sIdx);
    if (sceneImages[sIdx].images[0]) {
      sceneImages[sIdx].url = sceneImages[sIdx].images[0].url;
      sceneImages[sIdx].key = sceneImages[sIdx].images[0].key;
      sceneImages[sIdx].name = sceneImages[sIdx].images[0].name;
    }
  }
});

// Verify scene 1, 2, 3 frames in sceneImages state
for (let s = 1; s <= 3; s++) {
  assert.strictEqual(sceneImages[s].images.length, 2);
  assert.strictEqual(sceneImages[s].images[0].name, `scene-${s}-1.png`);
  assert.strictEqual(sceneImages[s].images[0].imageIndex, 1);
  assert.strictEqual(sceneImages[s].images[1].name, `scene-${s}-2.png`);
  assert.strictEqual(sceneImages[s].images[1].imageIndex, 2);
  assert.strictEqual(sceneImages[s].url, `https://r2.example.com/scene-${s}-1.png`);
}
console.log("✓ Step 4: page.jsx sceneImages state mapping passed.");

// Step 5: Simulate ImagesTab.jsx frame mapping to prompts
const scenesJson = [
  {
    scene_number: 1,
    images: [
      { image_number: 1, image_prompt: "Extreme macro kiwi in palm" },
      { image_number: 2, image_prompt: "Molecular enzyme cleavage" }
    ]
  },
  {
    scene_number: 2,
    images: [
      { image_number: 1, image_prompt: "Macro cross-section crushed kiwi" },
      { image_number: 2, image_prompt: "Digestive-tract cutaway" }
    ]
  },
  {
    scene_number: 3,
    images: [
      { image_number: 1, image_prompt: "Lower colon cutaway" },
      { image_number: 2, image_prompt: "Wide transparent torso" }
    ]
  }
];

scenesJson.forEach((scene) => {
  const sNum = scene.scene_number;
  const imgData = sceneImages[sNum];
  const uploadedImagesList = sortSceneImages(imgData?.images || [], sNum);

  const frames = scene.images.map((promptObj, idx) => {
    const frameNum = idx + 1;
    const asset = uploadedImagesList[idx] || null;
    return {
      frameNumber: frameNum,
      url: asset?.url,
      name: asset?.name,
      prompt: promptObj.image_prompt,
    };
  });

  assert.strictEqual(frames[0].frameNumber, 1);
  assert.strictEqual(frames[0].name, `scene-${sNum}-1.png`);
  assert.strictEqual(frames[0].prompt, scene.images[0].image_prompt);

  assert.strictEqual(frames[1].frameNumber, 2);
  assert.strictEqual(frames[1].name, `scene-${sNum}-2.png`);
  assert.strictEqual(frames[1].prompt, scene.images[1].image_prompt);
});

console.log("✓ Step 5: ImagesTab.jsx frame-to-prompt 1:1 mapping verified.");
console.log("ALL TESTS PASSED SUCCESSFULLY!");
