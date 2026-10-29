/** Validate a complete timing plan; invalid plans use equal image durations. */
export function resolveImageDurations(rawTimings, imageCount, totalDuration) {
  if (!Number.isInteger(imageCount) || imageCount < 1 ||
      !Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw new Error("A positive audio duration and image count are required.");
  }
  const fallback = () => Array(imageCount).fill(totalDuration / imageCount);
  let list = Array.isArray(rawTimings) ? rawTimings
    : rawTimings && typeof rawTimings === "object" ? Object.values(rawTimings) : [];
  if (list.length !== imageCount) return fallback();
  // Respect explicit image numbers, including out-of-order planner responses.
  if (list.some((item) => item?.image_number != null)) {
    const numbered = new Map(list.map((item) => [Number(item?.image_number), item]));
    if (numbered.size !== imageCount) return fallback();
    list = Array.from({ length: imageCount }, (_, i) => numbered.get(i + 1));
  }
  const durations = list.map((item) => {
    if (!item || typeof item !== "object") return NaN;
    if (item.duration != null) return Number(item.duration);
    if (item.end_time == null || item.start_time == null) return NaN;
    return Number(item.end_time) - Number(item.start_time);
  });
  const minimum = Math.min(0.5, totalDuration / imageCount);
  const sum = durations.reduce((a, b) => a + b, 0);
  const tolerance = Math.max(0.05, imageCount * 0.011);
  if (durations.some((d) => !Number.isFinite(d) || d <= 0 || d < minimum - 0.011) ||
      !Number.isFinite(sum) || Math.abs(sum - totalDuration) > tolerance) return fallback();
  // Correct only small decimal rounding drift, never stretch a stale plan.
  return durations.map((d) => d * totalDuration / sum);
}

/** Allocate an exact frame budget, reserving at least two frames per image. */
export function allocateImageFrames(rawTimings, imageCount, totalFrames, fps) {
  if (!Number.isInteger(totalFrames) || totalFrames < imageCount * 2 ||
      !Number.isFinite(fps) || fps <= 0) {
    throw new Error("Scene is too short to render every image (two frames per image required).");
  }
  const durations = resolveImageDurations(rawTimings, imageCount, totalFrames / fps);
  const frames = [];
  let allocated = 0;
  let cumulative = 0;
  for (let i = 0; i < imageCount; i++) {
    cumulative += durations[i] * fps;
    const remainingImages = imageCount - i - 1;
    const target = i === imageCount - 1 ? totalFrames
      : Math.min(totalFrames - remainingImages * 2, Math.max(allocated + 2, Math.round(cumulative)));
    frames.push(target - allocated);
    allocated = target;
  }
  return frames;
}
