/**
 * Everything the gallery shows. The files live in `public/gallery/` and nowhere
 * else; the page reads nothing from the API. (The architecture diagrams are repo
 * docs, in `docs/`, and are not published on the site.)
 *
 * Paintings and studio frames are stills from one real Sampling run.
 * Page copy stays product language: no run statistics,
 * playback speeds or model versions.
 */

export interface GalleryImage {
  src: string;
  title: string;
  note: string;
  width: number;
  height: number;
}

const painting = (slug: string, title: string, category: string): GalleryImage => ({
  src: `/gallery/paintings/${slug}.jpg`,
  title,
  note: category,
  width: 680,
  height: 800,
});

export const PAINTINGS: GalleryImage[] = [
  painting("orbit-diagram", "Orbit Diagram", "planets"),
  painting("ball-skirt", "Ball Skirt", "fashion"),
  painting("koi", "Koi", "animals"),
  painting("oni", "Oni", "masks"),
  painting("swallowtail", "Swallowtail", "insects"),
  painting("many-eyed-friend", "Many-Eyed Friend", "creatures"),
  painting("twin-moons", "Twin Moons", "planets"),
  painting("plague-doctor", "Plague Doctor", "masks"),
  painting("teacup", "Teacup", "objects"),
  painting("wet", "WET", "typography"),
  painting("horned-thing", "Horned Thing", "monsters"),
  painting("whale-song", "Whale Song", "animals"),
];

export const STUDIO: GalleryImage[] = [
  {
    src: "/gallery/studio/jev-decisive.jpg",
    title: "Decisive",
    note: "Cyclops, great eye: Honey Resin at 75%. A clear winner paints at once.",
    width: 2400,
    height: 1500,
  },
  {
    src: "/gallery/studio/jev-uncertain.jpg",
    title: "Uncertain",
    note: "Dancer, head: Sequin Rose 36% against Rose Bloom 27%. The panel says so, and offers Apply anyway.",
    width: 2400,
    height: 1500,
  },
  {
    src: "/gallery/studio/finished-desk.jpg",
    title: "Finished",
    note: "All fifty painted and back in the carousel.",
    width: 2400,
    height: 1500,
  },
];

export const FILM = {
  loop: { src: "/gallery/film/first-sample.mp4", poster: "/gallery/film/first-sample.jpg" },
  full: { src: "/gallery/film/esketcher-demo.mp4", poster: "/gallery/film/esketcher-demo.jpg" },
};
