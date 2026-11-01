export class VariableTitle {
  constructor(element, pointer, cursorAnim) {
    this.element = element;
    this.container = element.parentElement;
    this.pointer = pointer;
    this.cursorAnim = cursorAnim;
    this.text = element.textContent.trim();
    this.chars = [];
    this.wdth = 100;
    this.baseWdth = 100;
    this.baseWeight = 200;
    this.maxDist = 1;
    this.fitting = false;

    this.probe = document.createElement("span");
    this.probe.setAttribute("aria-hidden", "true");
    this.probe.style.cssText =
      "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font-family:'Google Sans Flex',sans-serif;font-optical-sizing:auto;line-height:0.82;";
    document.body.appendChild(this.probe);

    element.textContent = "";
    for (const char of this.text) {
      const span = document.createElement("span");
      span.dataset.char = char;
      span.textContent = char;
      element.appendChild(span);
      this.chars.push({ span });
    }

    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.fit(), 80);
    });
    this.resizeObserver.observe(this.container);

    document.fonts.ready.then(() => this.fit());
    this.fit();
    this.animate();
  }

  measure(fontSize, wdth, wght) {
    this.probe.style.fontSize = `${fontSize}px`;
    this.probe.style.fontWeight = `${wght}`;
    this.probe.style.fontVariationSettings = `"wght" ${wght}, "wdth" ${wdth}, "slnt" 0, "ROND" 0`;
    this.probe.textContent = this.text;
    return this.probe.getBoundingClientRect().width;
  }

  applyAxes(wdth, wght) {
    const settings = `"wght" ${wght}, "wdth" ${wdth}, "slnt" 0, "ROND" 0`;
    this.element.style.fontWeight = `${wght}`;
    this.element.style.fontVariationSettings = settings;
    for (const char of this.chars) {
      char.span.style.fontWeight = `${wght}`;
      char.span.style.fontVariationSettings = settings;
    }
  }

  fit() {
    const width = Math.floor(this.element.clientWidth);
    const height = Math.floor(this.element.clientHeight);
    if (width <= 0 || height <= 0) return;

    this.fitting = true;
    const fontSize = Math.max(8, Math.round(height / 0.82));
    this.element.style.fontSize = `${fontSize}px`;

    let low = 25;
    let high = 151;
    let best = 100;
    const target = width * 0.985;

    for (let index = 0; index < 14; index++) {
      const mid = (low + high) / 2;
      const measured = this.measure(fontSize, mid, this.baseWeight);
      if (measured > target) high = mid;
      else low = mid;
      best = mid;
    }

    this.wdth = Math.round(best);
    this.applyAxes(this.wdth, this.baseWeight);

    void this.element.offsetWidth;
    let actual = 0;
    for (const char of this.chars) {
      actual += char.span.getBoundingClientRect().width;
    }

    let safety = 0;
    while (actual > target && this.wdth > 25 && safety < 8) {
      this.wdth -= 2;
      this.applyAxes(this.wdth, this.baseWeight);
      void this.element.offsetWidth;
      actual = 0;
      for (const char of this.chars) {
        actual += char.span.getBoundingClientRect().width;
      }
      safety += 1;
    }

    this.baseWdth = this.wdth;
    this.fitting = false;
  }

  scaleFromDistance(dist) {
    const min = this.cursorAnim.letterScaleMin;
    const max = this.cursorAnim.letterScaleMax;
    const t = 1 - Math.min(dist / this.maxDist, 1);
    return min + t * t * (max - min);
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    if (this.fitting) return;

    this.maxDist = this.element.clientWidth * this.cursorAnim.letterRadius;
    const pointerX = this.pointer.smoothed.x;
    let nearestScale = this.cursorAnim.letterScaleMin;

    for (const char of this.chars) {
      const box = char.span.getBoundingClientRect();
      const dist = Math.abs(pointerX - (box.x + box.width / 1.75));
      const scaleY = this.scaleFromDistance(dist);
      char.span.style.transform = `scaleY(${scaleY})`;
      nearestScale = Math.max(nearestScale, scaleY);
    }

    this.cursorAnim.letterScale = nearestScale;
  }
}
