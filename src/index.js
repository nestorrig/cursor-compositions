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
});
