export type LoadedPost = {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  year: number | null;
  createdAt: Date | null;
};

export type SnapshotLike = {
  docs: Array<{ id: string; data: () => unknown }>;
};
