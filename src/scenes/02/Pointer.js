export class Pointer {
  constructor(cof = 0.08) {
    this.cof = cof;
    this.raw = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
    };
    this.smoothed = { ...this.raw };
    this.normalized = { x: 0, y: 0 };

    window.addEventListener("pointermove", (event) => {
      this.raw.x = event.clientX;
      this.raw.y = event.clientY;
    });

    const loop = () => {
      this.update();
      requestAnimationFrame(loop);
    };
    loop();
  }

  update() {
    this.smoothed.x += (this.raw.x - this.smoothed.x) * this.cof;
    this.smoothed.y += (this.raw.y - this.smoothed.y) * this.cof;
    this.normalized.x = (this.smoothed.x / window.innerWidth) * 2 - 1;
    this.normalized.y = -(this.smoothed.y / window.innerHeight) * 2 + 1;
  }
}
