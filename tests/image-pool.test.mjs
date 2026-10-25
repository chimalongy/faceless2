import test from "node:test";
import assert from "node:assert/strict";

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignPoolImagesToScenes(poolImages, scenes) {
  if (!poolImages || poolImages.length === 0) {
    throw new Error("Pool is empty");
  }

  const assignmentTargets = [];
  scenes.forEach((scene, sIdx) => {
    const sNum = scene.scene_number || (sIdx + 1);
    const multiCount = Array.isArray(scene.images) && scene.images.length > 0 
      ? scene.images.length 
      : Number(scene.number_of_images) > 1 
        ? Number(scene.number_of_images) 
        : 1;

    for (let fIdx = 1; fIdx <= multiCount; fIdx++) {
      assignmentTargets.push({
        sceneNumber: sNum,
        imageIndex: fIdx,
      });
    }
  });

  let shuffledPool = shuffleArray(poolImages);
  let poolPointer = 0;

  const assignments = [];
  for (const target of assignmentTargets) {
    if (poolPointer >= shuffledPool.length) {
      shuffledPool = shuffleArray(poolImages);
      poolPointer = 0;
    }
    const chosen = shuffledPool[poolPointer];
    poolPointer++;

    const isMulti = target.imageIndex > 1;
    const imageSuffix = isMulti ? `-${target.imageIndex}` : "";
    assignments.push({
      sceneNumber: target.sceneNumber,
      imageIndex: target.imageIndex,
      fileUrl: chosen.fileUrl,
      fileKey: chosen.fileKey,
      fileName: `scene-${target.sceneNumber}${imageSuffix}.png`,
    });
  }

  return assignments;
}

test("image pool assignment distributes unique images when pool size >= scene count", () => {
  const pool = [
    { fileUrl: "https://r2.com/img1.png", fileKey: "k1" },
    { fileUrl: "https://r2.com/img2.png", fileKey: "k2" },
    { fileUrl: "https://r2.com/img3.png", fileKey: "k3" },
    { fileUrl: "https://r2.com/img4.png", fileKey: "k4" },
    { fileUrl: "https://r2.com/img5.png", fileKey: "k5" },
  ];

  const scenes = [
    { scene_number: 1 },
    { scene_number: 2 },
    { scene_number: 3 },
  ];

  const results = assignPoolImagesToScenes(pool, scenes);

  assert.equal(results.length, 3);
  const assignedKeys = results.map((r) => r.fileKey);
  const uniqueKeys = new Set(assignedKeys);

  // All 3 assigned images should be distinct
  assert.equal(uniqueKeys.size, 3);
  assert.equal(results[0].fileName, "scene-1.png");
  assert.equal(results[1].fileName, "scene-2.png");
  assert.equal(results[2].fileName, "scene-3.png");
});

test("image pool assignment cycles without leaving scenes empty when scenes > pool size", () => {
  const pool = [
    { fileUrl: "https://r2.com/img1.png", fileKey: "k1" },
    { fileUrl: "https://r2.com/img2.png", fileKey: "k2" },
  ];

  const scenes = [
    { scene_number: 1 },
    { scene_number: 2 },
    { scene_number: 3 },
    { scene_number: 4 },
    { scene_number: 5 },
  ];

  const results = assignPoolImagesToScenes(pool, scenes);

  assert.equal(results.length, 5);
  results.forEach((r, idx) => {
    assert.equal(r.sceneNumber, idx + 1);
    assert.ok(r.fileUrl.startsWith("https://r2.com/"));
    assert.equal(r.fileName, `scene-${idx + 1}.png`);
  });
});

test("image pool correctly assigns multi-frame scenes", () => {
  const pool = [
    { fileUrl: "https://r2.com/img1.png", fileKey: "k1" },
    { fileUrl: "https://r2.com/img2.png", fileKey: "k2" },
    { fileUrl: "https://r2.com/img3.png", fileKey: "k3" },
    { fileUrl: "https://r2.com/img4.png", fileKey: "k4" },
  ];

  const scenes = [
    { scene_number: 1, number_of_images: 2 },
    { scene_number: 2, number_of_images: 1 },
  ];

  const results = assignPoolImagesToScenes(pool, scenes);

  assert.equal(results.length, 3);
  assert.equal(results[0].sceneNumber, 1);
  assert.equal(results[0].imageIndex, 1);
  assert.equal(results[0].fileName, "scene-1.png");

  assert.equal(results[1].sceneNumber, 1);
  assert.equal(results[1].imageIndex, 2);
  assert.equal(results[1].fileName, "scene-1-2.png");

  assert.equal(results[2].sceneNumber, 2);
  assert.equal(results[2].imageIndex, 1);
  assert.equal(results[2].fileName, "scene-2.png");
});

test("pool empty throws explicit error", () => {
  assert.throws(() => {
    assignPoolImagesToScenes([], [{ scene_number: 1 }]);
  }, /Pool is empty/);
});
