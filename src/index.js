import "./lib/pixel.js";
import gsap from "gsap";

gsap.defaults({ ease: "power3.out" });

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const videos = [...document.querySelectorAll(".piece video")];

function playVideo(video) {
  video.muted = true;
  video.playsInline = true;
  return video.play().catch(() => {});
}

function playPreviews() {
  if (reduceMotion.matches) {
    videos.forEach((video) => video.pause());
    return;
  }

  videos.forEach((video) => {
    if (video.readyState >= 2) playVideo(video);
    else video.addEventListener("canplay", () => playVideo(video), { once: true });
  });
}

playPreviews();
reduceMotion.addEventListener("change", playPreviews);

const motion = gsap.matchMedia();

motion.add("(prefers-reduced-motion: no-preference)", () => {
  gsap.from("header > *", {
    y: 16,
    autoAlpha: 0,
    duration: 0.6,
    stagger: 0.08,
  });
  gsap.from(".piece", {
    y: 28,
    autoAlpha: 0,
    duration: 0.85,
    stagger: 0.12,
    delay: 0.08,
    onComplete: playPreviews,
  });
  gsap.from("footer", {
    y: 16,
    autoAlpha: 0,
    duration: 0.6,
    delay: 0.45,
  });
});

motion.add(
  "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
  () => {
    const pieces = [...document.querySelectorAll(".piece")];

    const cleanups = pieces.map((piece) => {
      const overlay = piece.querySelector(".overlay");
      const media = piece.querySelector(".media");

      gsap.set(overlay, { autoAlpha: 0, y: 14 });
      gsap.set(media, { boxShadow: "0 0 0 rgba(0, 75, 255, 0)" });

      const show = () => {
        gsap.to(overlay, {
          autoAlpha: 1,
          y: 0,
          duration: 0.4,
          overwrite: "auto",
        });
        gsap.to(media, {
          boxShadow: "0 22px 48px rgba(0, 75, 255, 0.32)",
          duration: 0.4,
          overwrite: "auto",
        });
      };

      const hide = () => {
        gsap.to(overlay, {
          autoAlpha: 0,
          y: 14,
          duration: 0.3,
          overwrite: "auto",
        });
        gsap.to(media, {
          boxShadow: "0 0 0 rgba(0, 75, 255, 0)",
          duration: 0.3,
          overwrite: "auto",
        });
      };

      piece.addEventListener("pointerenter", show);
      piece.addEventListener("pointerleave", hide);
      piece.addEventListener("focus", show);
      piece.addEventListener("blur", hide);

      return () => {
        piece.removeEventListener("pointerenter", show);
        piece.removeEventListener("pointerleave", hide);
        piece.removeEventListener("focus", show);
        piece.removeEventListener("blur", hide);
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  },
);
