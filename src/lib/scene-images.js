/**
 * Robust image filename parsing and sorting helpers for multi-image scenes.
 */

export function parseImageFileName(fullFileName) {
  const lowerFull = (fullFileName || "").toLowerCase();

  // Determine extension and MIME type
  let ext = "png";
  let mimeType = "image/png";
  if (lowerFull.includes(".jfif")) {
    ext = "jfif";
    mimeType = "image/jpeg";
  } else if (lowerFull.includes(".jpg") || lowerFull.includes(".jpeg")) {
    ext = "jpg";
    mimeType = "image/jpeg";
  } else if (lowerFull.includes(".webp")) {
    ext = "webp";
    mimeType = "image/webp";
  } else if (lowerFull.includes(".gif")) {
    ext = "gif";
    mimeType = "image/gif";
  }

  // Thumbnail detection
  if (lowerFull.includes("thumbnail") || lowerFull.includes("thumb")) {
    return {
      isThumbnail: true,
      sceneIndex: null,
      imageIndex: null,
      isMultiIndexed: false,
      ext,
      mimeType,
    };
  }

  // Strip file extensions and trailing timestamps (e.g. .png_20260913055849 or .png)
  let cleanName = fullFileName.replace(/\.[a-zA-Z0-9]+(?:_\d+)?$/i, "");
  cleanName = cleanName.replace(/\.[a-zA-Z0-9]+$/i, "");

  const baseName = cleanName.toLowerCase().replace(/^scene[-_]?/i, "");

  // Match multi-part numbers like "1_2", "1-2", "1_image_2", "scene_1_2"
  const multiMatch = baseName.match(/^(\d+)[-_](?:image[-_]?)?(\d+)/i);
  let sceneIndex = null;
  let imageIndex = 1;
  let isMultiIndexed = false;

  if (multiMatch) {
    sceneIndex = parseInt(multiMatch[1], 10);
    const secondNum = multiMatch[2];
    // If the second number has 6+ digits (e.g. timestamp 20260821), treat it as timestamp, not image index
    if (secondNum.length >= 6) {
      imageIndex = 1;
      isMultiIndexed = false;
    } else {
      imageIndex = parseInt(secondNum, 10);
      isMultiIndexed = true;
    }
  } else {
    // Fallback to primary scene number extraction
    const primaryPart = baseName.split("_")[0];
    const numberMatch = primaryPart.match(/(\d+)/) || baseName.match(/(\d+)/) || fullFileName.match(/(\d+)/);
    if (numberMatch) {
      sceneIndex = parseInt(numberMatch[1], 10);
      imageIndex = 1;
      isMultiIndexed = false;
    }
  }

  return {
    isThumbnail: false,
    sceneIndex,
    imageIndex,
    isMultiIndexed,
    ext,
    mimeType,
  };
}

export function getImageIndex(item, sceneNum = null) {
  if (item?.imageIndex !== undefined && item?.imageIndex !== null) {
    return Number(item.imageIndex);
  }
  const name = item?.name || (typeof item === "string" ? item : "");
  if (!name) return 1;

  // Check if name has format: scene-X-Y or X_Y or scene_X_image_Y
  const multiMatch = name.match(/scene[-_](\d+)[-_](?:image[-_]?)?(\d+)/i) ||
                     name.match(/^(\d+)[-_](?:image[-_]?)?(\d+)/i);
  if (multiMatch) {
    return parseInt(multiMatch[2], 10);
  }

  // Check if "Image Y" or "Frame Y"
  const labelMatch = name.match(/(?:image|frame)\s*(\d+)/i);
  if (labelMatch) {
    return parseInt(labelMatch[1], 10);
  }

  // Check format: scene-X.ext (where X is the scene number) -> this is frame 1!
  const singleSceneMatch = name.match(/scene[-_](\d+)\.[a-zA-Z0-9]+$/i);
  if (singleSceneMatch) {
    return 1;
  }

  // If just a number followed by extension: e.g. "1.png"
  const numOnlyMatch = name.match(/^(\d+)\.[a-zA-Z0-9]+$/i);
  if (numOnlyMatch) {
    if (sceneNum && parseInt(numOnlyMatch[1], 10) === Number(sceneNum)) {
      return 1;
    }
  }

  return 1;
}

export function sortSceneImages(imagesList = [], sceneNum = null) {
  if (!Array.isArray(imagesList)) return [];
  return [...imagesList].sort((a, b) => {
    const idxA = getImageIndex(a, sceneNum);
    const idxB = getImageIndex(b, sceneNum);
    return idxA - idxB;
  });
}
