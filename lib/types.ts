export type Webtoon = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string;
  main_image_url: string | null;
  deleted: boolean;
  updated_at: string | null;
  created_at: string | null;
};

export type Episode = {
  id: number;
  webtoon_id: number;
  title: string | null;
  episode_no: number;
  cover_url: string | null;
  deleted: boolean;
};

export type EpisodeImage = {
  id: number;
  episode_id: number;
  image_url: string;
  image_order: number;
};

export type ImageItem = {
  id: number;
  url: string;
};
