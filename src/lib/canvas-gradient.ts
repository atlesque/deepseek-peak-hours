/**
 * Animated mesh gradient background using overlapping radial gradients
 * ("orbs") that drift across a fullscreen canvas.
 */

/* ── Palettes ──────────────────────────────────────────────────────────── */

const PEAK_COLORS = [
  "#c0392b",
  "#e74c3c",
  "#922b21",
  "#ff6b6b",
  "#ff4757",
  "#b71c1c",
  "#e53935",
  "#ff1744",
];

const OFF_COLORS = [
  "#1565c0",
  "#1e88e5",
  "#0d47a1",
  "#42a5f5",
  "#2979ff",
  "#0288d1",
  "#039be5",
  "#1976d2",
];

const SOLID_BG_PEAK = "#4a0000";
const SOLID_BG_OFF = "#001a3a";

/* ── Orb ───────────────────────────────────────────────────────────────── */

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
}

function createOrb(canvasW: number, canvasH: number, color: string): Orb {
  return {
    x: Math.random() * canvasW,
    y: Math.random() * canvasH,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    r: Math.min(canvasW, canvasH) * (0.35 + Math.random() * 0.3),
    color,
  };
}

/* ── GradientCanvas ────────────────────────────────────────────────────── */

export class GradientCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private orbs: Orb[] = [];
  private peak: boolean;

  constructor(canvas: HTMLCanvasElement, peak: boolean) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.peak = peak;
    this.resize();
    this.initOrbs();
  }

  /** Resize canvas to fill the viewport. */
  resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /** (Re-)initialise orbs for the current peak/off mode. */
  initOrbs(): void {
    const colors = this.peak ? PEAK_COLORS : OFF_COLORS;
    this.orbs = colors.map((c) =>
      createOrb(this.canvas.width, this.canvas.height, c),
    );
  }

  /** Switch palette and recreate orbs when peak state changes. */
  setPeak(peak: boolean): void {
    if (peak === this.peak) return;
    this.peak = peak;
    this.initOrbs();
  }

  /** Advance orb positions (wrapping around edges). */
  private moveOrbs(): void {
    const { width: w, height: h } = this.canvas;
    const { orbs } = this;
    for (const orb of orbs) {
      orb.x += orb.vx;
      orb.y += orb.vy;
      if (orb.x < -orb.r) orb.x = w + orb.r;
      if (orb.x > w + orb.r) orb.x = -orb.r;
      if (orb.y < -orb.r) orb.y = h + orb.r;
      if (orb.y > h + orb.r) orb.y = -orb.r;
    }
  }

  /** Draw one frame. */
  draw(): void {
    const { ctx, canvas, orbs } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Solid dark base
    ctx.fillStyle = this.peak ? SOLID_BG_PEAK : SOLID_BG_OFF;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render orbs with screen blending
    ctx.globalCompositeOperation = "screen";
    for (const orb of orbs) {
      const grad = ctx.createRadialGradient(
        orb.x,
        orb.y,
        0,
        orb.x,
        orb.y,
        orb.r,
      );
      grad.addColorStop(0, orb.color + "cc");
      grad.addColorStop(1, orb.color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** Advance + draw a single frame. */
  tick(): void {
    this.moveOrbs();
    this.draw();
  }
}
