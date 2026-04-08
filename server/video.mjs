import ytsr from "ytsr";

export async function findRecipeVideo(query) {
  const results = await ytsr(`${query} recipe`, { limit: 10 });
  const video = results.items.find((item) => item.type === "video");

  if (!video || !("url" in video)) {
    return null;
  }

  return {
    id: video.id,
    title: video.title,
    url: video.url,
    thumbnailUrl: video.bestThumbnail?.url ?? "",
    channelName: video.author?.name ?? "YouTube",
    duration: video.duration ?? ""
  };
}
