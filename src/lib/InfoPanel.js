import gsap from "gsap";
import "./infoPanel.css";

export class InfoPanel {
  constructor({ title, description, moods = [], active, onMood }) {
    this.moods = moods;
    this.active = active ?? moods[0]?.id ?? null;
    this.onMood = onMood;
    this.open = false;
    this.mount(title, description);
    this.bind();
    this.anim = null;
    this.duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 0.48;
    this.setRest();
  }

  mount(title, description) {
    this.root = document.createElement("div");
    this.root.className = "info-panel";
    this.root.innerHTML = `
      <div class="info-panel__backdrop"></div>
      <div class="info-panel__cluster">
        <div class="info-panel__card" id="info-card" role="dialog" aria-modal="true" aria-labelledby="info-title">
          <h2 id="info-title">${title}</h2>
          <p>${description}</p>
          <div class="info-panel__moods" role="group" aria-label="Moods">
            ${this.moods
              .map(
                (mood) => `
              <button
                type="button"
                class="info-panel__swatch"
                data-mood="${mood.id}"
                style="--swatch:${mood.swatch}"
                aria-pressed="${mood.id === this.active}"
                aria-label="${mood.label}"
                tabindex="-1"
              ></button>`,
              )
              .join("")}
          </div>
        </div>
        <div class="info-panel__actions">
        <a class="info-panel__home" href="../">Índice</a>
        <button
          class="info-panel__toggle"
          type="button"
          aria-expanded="false"
          aria-controls="info-card"
          aria-label="Información de la composición"
        >
          <svg class="info-panel__icon info-panel__icon--i" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="4.2" r="1.15" fill="currentColor" />
            <path d="M8 7.1v5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <svg class="info-panel__icon info-panel__icon--x" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.root);
    this.backdrop = this.root.querySelector(".info-panel__backdrop");
    this.card = this.root.querySelector(".info-panel__card");
    this.toggleBtn = this.root.querySelector(".info-panel__toggle");
    this.iconI = this.root.querySelector(".info-panel__icon--i");
    this.iconX = this.root.querySelector(".info-panel__icon--x");
    this.swatches = [...this.root.querySelectorAll(".info-panel__swatch")];
    this.homeLink = this.root.querySelector(".info-panel__home");
  }

  setRest() {
    gsap.set(this.root, { pointerEvents: "none" });
    gsap.set(this.backdrop, { autoAlpha: 0 });
    gsap.set(this.card, {
      autoAlpha: 0,
      y: 18,
      scale: 0.88,
      transformOrigin: "bottom right",
    });
    gsap.set(this.card.children, { autoAlpha: 0, y: 8 });
    gsap.set(this.iconI, { autoAlpha: 1, rotate: 0 });
    gsap.set(this.iconX, { autoAlpha: 0, rotate: -70 });
  }

  killAnim() {
    this.anim?.kill();
    this.anim = null;
  }

  bind() {
    this.toggleBtn.addEventListener("click", () => this.toggle());
    this.backdrop.addEventListener("click", () => {
      if (this.open) this.close();
    });
    this.root.addEventListener("keydown", (event) => this.onTab(event));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.open) {
        event.preventDefault();
        this.close();
        this.toggleBtn.focus();
      }
    });
    this.swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => this.setMood(swatch.dataset.mood));
    });
  }

  onTab(event) {
    if (!this.open || event.key !== "Tab") return;

    const focusable = [this.homeLink, this.toggleBtn, ...this.swatches];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  setMood(id) {
    const mood = this.moods.find((item) => item.id === id);
    if (!mood) return;
    this.active = id;
    this.swatches.forEach((swatch) => {
      swatch.setAttribute("aria-pressed", String(swatch.dataset.mood === id));
    });
    this.onMood?.(mood);
  }

  setSwatchTab(enabled) {
    this.swatches.forEach((swatch) => {
      swatch.tabIndex = enabled ? 0 : -1;
    });
  }

  toggle() {
    if (this.open) this.close();
    else this.openPanel();
  }

  openPanel() {
    this.open = true;
    this.toggleBtn.setAttribute("aria-expanded", "true");
    this.toggleBtn.setAttribute("aria-label", "Cerrar información");
    this.setSwatchTab(true);
    this.killAnim();

    const d = this.duration;
    this.anim = gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .set(this.root, { pointerEvents: "auto" })
      .to(
        this.backdrop,
        { autoAlpha: 1, duration: d * 0.65, ease: "expo.out" },
        0,
      )
      .to(
        this.card,
        { autoAlpha: 1, y: 0, scale: 1, duration: d, ease: "expo.out" },
        0.04,
      )
      .to(
        this.card.children,
        {
          autoAlpha: 1,
          y: 0,
          duration: d * 0.5,
          stagger: 0.05,
          ease: "power2.out",
        },
        0.1,
      )
      .to(
        this.iconI,
        { autoAlpha: 0, rotate: 70, duration: d * 0.35, ease: "power3.out" },
        0,
      )
      .to(
        this.iconX,
        { autoAlpha: 1, rotate: 0, duration: d * 0.35, ease: "power3.out" },
        0.04,
      );
  }

  close() {
    this.open = false;
    this.toggleBtn.setAttribute("aria-expanded", "false");
    this.toggleBtn.setAttribute("aria-label", "Información de la composición");
    this.setSwatchTab(false);
    this.killAnim();

    const d = this.duration * 0.82;
    this.anim = gsap
      .timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => gsap.set(this.root, { pointerEvents: "none" }),
      })
      .to(
        this.card.children,
        {
          autoAlpha: 0,
          y: 6,
          duration: d * 0.32,
          stagger: 0.025,
          ease: "power2.in",
        },
        0,
      )
      .to(
        this.card,
        { autoAlpha: 0, y: 14, scale: 0.94, duration: d, ease: "power3.out" },
        0.05,
      )
      .to(
        this.backdrop,
        { autoAlpha: 0, duration: d * 0.7, ease: "power2.out" },
        0,
      )
      .to(
        this.iconX,
        { autoAlpha: 0, rotate: 50, duration: d * 0.38, ease: "power2.in" },
        0,
      )
      .to(
        this.iconI,
        { autoAlpha: 1, rotate: 0, duration: d * 0.38, ease: "power2.out" },
        0.06,
      );
  }
}
