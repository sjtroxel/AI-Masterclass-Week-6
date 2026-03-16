import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  effect,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { type AsteroidDetail } from '../../core/api.service.js';
import { orbitEllipsePoints, orbitPositionAtMeanAnomaly, type OrbitalElements } from './orbit-math.js';
import { INNER_PLANETS, orbitClassColor } from './planet-positions.js';

export interface OrbitalAsteroid {
  id: string;
  name: string;
  orbitClass: string;
  elements: OrbitalElements | null;
  /** Current epoch mean anomaly (degrees) — used to show current position marker */
  meanAnomalyDeg?: number | null;
}

@Component({
  selector: 'app-orbital-canvas',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full overflow-hidden rounded-xl bg-space-950"
         [style.height.px]="canvasHeight()">
      <!-- Three.js or Canvas 2D mounts here -->
      <div #canvasHost class="absolute inset-0"></div>

      <!-- Loading overlay -->
      @if (!sceneReady()) {
        <div class="absolute inset-0 flex items-center justify-center bg-space-950">
          <div class="w-5 h-5 rounded-full border-2 border-nebula-500 border-t-transparent
                      animate-spin"></div>
        </div>
      }

      <!-- Legend (desktop only) -->
      @if (sceneReady()) {
        <div class="absolute top-3 right-3 hidden md:flex flex-col gap-1.5
                    bg-space-950/80 backdrop-blur-sm rounded-lg p-3">
          @for (p of planetLegend; track p.name) {
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full shrink-0"
                    [style.background-color]="p.color"></span>
              <span class="text-[9px] text-space-400">{{ p.name }}</span>
            </div>
          }
        </div>
      }

      <!-- Interaction hints (2D mode only) -->
      @if (sceneReady() && canvas2dMode()) {
        <div class="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <span class="text-[9px] text-space-600 bg-space-950/80 rounded px-2 py-1">
            Scroll to zoom · drag to pan · click orbit to select
          </span>
        </div>
      }

      <!-- Tap hint (Three.js mobile) -->
      @if (sceneReady() && !canvas2dMode()) {
        <div class="absolute bottom-3 left-0 right-0 flex justify-center md:hidden pointer-events-none">
          <span class="text-[9px] text-space-600 bg-space-950/80 rounded px-2 py-1">
            Tap orbit to select asteroid
          </span>
        </div>
      }

      <!-- Selection popup -->
      @if (selectedPopup()) {
        <div class="absolute z-20 bg-space-900/95 backdrop-blur-sm border border-space-700
                    rounded-lg shadow-xl p-2.5 w-40"
             [style.left.px]="selectedPopup()!.left"
             [style.top.px]="selectedPopup()!.top">
          <div class="flex items-start justify-between gap-1.5 mb-2">
            <span class="text-[11px] font-semibold text-white leading-tight line-clamp-2">
              {{ selectedPopup()!.name }}
            </span>
            <button (click)="selectedPopup.set(null)"
                    class="text-space-400 hover:text-white shrink-0 w-5 h-5
                           flex items-center justify-center text-xs"
                    aria-label="Close">✕</button>
          </div>
          @if (selectedPopup()!.hasDossier) {
            <a [routerLink]="['/dossier', selectedPopup()!.id]"
               (click)="onPopupDossierClick()"
               class="flex items-center text-[11px] text-stellar-400 hover:text-stellar-300
                      transition-colors min-h-9">
              View dossier →
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class OrbitalCanvasComponent implements AfterViewInit {
  /** Asteroids to render. Changing this triggers a scene rebuild. */
  readonly asteroids = input<OrbitalAsteroid[]>([]);
  /** When set, this asteroid's orbit and marker are highlighted (brighter + larger). */
  readonly highlightId = input<string | undefined>(undefined);
  /** Fired when user clicks/taps an asteroid marker. */
  readonly asteroidSelected = output<string>();

  @ViewChild('canvasHost', { static: false }) private canvasHost?: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly sceneReady = signal(false);
  readonly canvasHeight = signal(320);
  /** True when running Canvas 2D fallback (WebGL unavailable) */
  readonly canvas2dMode = signal(false);

  // ── Three.js scene objects ───────────────────────────────────────────────────

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls?: OrbitControls;
  private rafId?: number;

  /** Map asteroidId → mesh for raycasting (Three.js mode only) */
  private asteroidMeshes = new Map<string, THREE.Mesh>();
  /** Planet + Sun meshes — persistent across asteroid rebuilds */
  private nonAsteroidMeshes = new Map<string, THREE.Mesh>();

  // ── Canvas 2D fallback (used when WebGL is unavailable) ─────────────────────

  private canvas2d?: HTMLCanvasElement;
  /** Marker hit-targets for click detection in 2D mode */
  private markers2d: { id: string; name: string; cx: number; cy: number; r: number; hasDossier: boolean }[] = [];
  /** Currently selected popup (null = hidden) */
  readonly selectedPopup = signal<{ id: string; name: string; left: number; top: number; hasDossier: boolean } | null>(null);
  /** 2D pan/zoom view state */
  private view2d = { panX: 0, panY: 0, scale: 1 };
  /** Mouse drag state */
  private drag2d?: { startX: number; startY: number; panX: number; panY: number };

  readonly planetLegend = INNER_PLANETS.map((p) => ({ name: p.name, color: p.color }));

  constructor() {
    // Rebuild orbits whenever the asteroid list or highlight changes
    effect(() => {
      const asteroids = this.asteroids();
      const highlightId = this.highlightId();
      void highlightId; // consumed for signal tracking
      if (this.scene || this.canvas2d) {
        this.rebuildAsteroidOrbits(asteroids);
      }
    });

    this.destroyRef.onDestroy(() => this.teardown());
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    // Adjust canvas height for desktop, then initialise the renderer.
    // setTimeout(0) defers past the current change-detection cycle so the
    // host div is fully laid out and @ViewChild is guaranteed to be populated.
    this.canvasHeight.set(window.innerWidth >= 768 ? 520 : 320);
    setTimeout(() => this.initScene(), 0);
  }

  // ── Scene init ───────────────────────────────────────────────────────────────

  private isWebGLAvailable(): boolean {
    try {
      const testCanvas = document.createElement('canvas');
      return !!(
        testCanvas.getContext('webgl2') ??
        testCanvas.getContext('webgl') ??
        (testCanvas.getContext as (id: string) => unknown)('experimental-webgl')
      );
    } catch {
      return false;
    }
  }

  private initScene(): void {
    const host = this.canvasHost?.nativeElement;
    if (!host) {
      console.warn('[OrbitalCanvas] canvasHost not available — scene init skipped');
      return;
    }

    if (!this.isWebGLAvailable()) {
      console.warn('[OrbitalCanvas] WebGL unavailable — using Canvas 2D fallback');
      this.initScene2D(host);
      return;
    }

    this.zone.runOutsideAngular(() => {
      try {
        const width = host.clientWidth || 375;
        const height = this.canvasHeight();

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x030712, 1); // space-950
        host.appendChild(renderer.domElement);
        this.renderer = renderer;

        // Scene
        const scene = new THREE.Scene();
        this.scene = scene;

        // Camera — same perspective setup on all screen sizes
        const cam = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
        cam.position.set(0, 3.5, 5);
        cam.lookAt(0, 0, 0);
        this.camera = cam;

        // Orbit controls — full rotation enabled on all screen sizes
        const controls = new OrbitControls(this.camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 0.5;
        controls.maxDistance = 20;
        this.controls = controls;

        // Sun
        const sunGeo = new THREE.SphereGeometry(0.06, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.userData = { name: 'The Sun', hasDossier: false };
        scene.add(sunMesh);
        this.nonAsteroidMeshes.set('sun', sunMesh);

        // Ambient fill
        scene.add(new THREE.AmbientLight(0xffffff, 0.15));

        // Stars (simple point field)
        this.addStarField(scene);

        // Inner planets
        this.addPlanetOrbits(scene);

        // Asteroids (if already provided)
        this.rebuildAsteroidOrbits(this.asteroids());

        // Click / tap raycasting
        renderer.domElement.addEventListener('click', (e: MouseEvent) => this.onCanvasClick(e));
        renderer.domElement.addEventListener('touchend', (e: TouchEvent) => this.onCanvasTouch(e), { passive: true });

        // Resize observer
        const ro = new ResizeObserver(() => {
          const w = host.clientWidth;
          const h = this.canvasHeight();
          renderer.setSize(w, h);
          if (this.camera instanceof THREE.PerspectiveCamera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
          }
        });
        ro.observe(host);
        this.destroyRef.onDestroy(() => ro.disconnect());

        // Animation loop
        const animate = () => {
          this.rafId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, this.camera!);
        };
        animate();

        this.zone.run(() => this.sceneReady.set(true));
      } catch (err) {
        console.error('[OrbitalCanvas] Three.js init failed — falling back to Canvas 2D:', err);
        this.initScene2D(host);
      }
    });
  }

  // ── Canvas 2D fallback ───────────────────────────────────────────────────────

  private initScene2D(host: HTMLDivElement): void {
    const canvas = document.createElement('canvas');
    canvas.width = host.clientWidth || 375;
    canvas.height = this.canvasHeight() || 320;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);
    this.canvas2d = canvas;

    // Draw immediately AND after the next frame so any post-init layout
    // changes (resize observer firing, canvasHeight signal update) don't leave
    // the canvas blank.
    this.draw2D();
    requestAnimationFrame(() => this.draw2D());

    // Zoom: mouse wheel
    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.view2d.scale = Math.max(0.3, Math.min(6, this.view2d.scale * zoomFactor));
      this.draw2D();
    }, { passive: false });

    // Pan: mouse drag
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.drag2d = { startX: e.clientX, startY: e.clientY, panX: this.view2d.panX, panY: this.view2d.panY };
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.drag2d) return;
      this.view2d.panX = this.drag2d.panX + (e.clientX - this.drag2d.startX);
      this.view2d.panY = this.drag2d.panY + (e.clientY - this.drag2d.startY);
      this.draw2D();
    });
    canvas.addEventListener('mouseup', () => { this.drag2d = undefined; });
    canvas.addEventListener('mouseleave', () => { this.drag2d = undefined; });

    // Click / tap selection
    canvas.addEventListener('click', (e: MouseEvent) => this.onCanvas2DClick(e));
    canvas.addEventListener('touchend', (e: TouchEvent) => this.onCanvas2DTouch(e), { passive: true });

    // Resize observer — only reset canvas dimensions if they actually changed,
    // so we avoid unnecessarily clearing the canvas.
    const ro = new ResizeObserver(() => {
      const newW = host.clientWidth || 375;
      const newH = this.canvasHeight() || 320;
      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW;
        canvas.height = newH;
      }
      this.draw2D();
    });
    ro.observe(host);
    this.destroyRef.onDestroy(() => ro.disconnect());

    this.zone.run(() => {
      this.canvas2dMode.set(true);
      this.sceneReady.set(true);
    });
  }

  private draw2D(): void {
    const canvas = this.canvas2d;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const { panX, panY, scale } = this.view2d;
    // Logical center after pan/zoom
    const cx = w / 2 + panX;
    const cy = h / 2 + panY;
    // Base scale: fit 4 AU into 45% of the shorter canvas dimension, then apply zoom
    const auPx = Math.min(w, h) * 0.45 / 4 * scale;

    this.markers2d = [];

    // Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Pseudo-random star field (deterministic so it doesn't flicker on redraw)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 300; i++) {
      const sx = ((i * 7919 + 31) % (w - 4)) + 2;
      const sy = ((i * 6271 + 53) % (h - 4)) + 2;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Helper: draw a closed polyline from orbit points (project x,z to canvas)
    const drawOrbit = (pts: { x: number; y: number; z: number }[], color: string, alpha: number) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + pts[0]!.x * auPx, cy - pts[0]!.z * auPx);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(cx + pts[i]!.x * auPx, cy - pts[i]!.z * auPx);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    // Inner planet orbits
    for (const planet of INNER_PLANETS) {
      const pts = orbitEllipsePoints(planet.elements, 128);
      drawOrbit(pts, planet.color, 0.45);
      // Planet dot
      const p0 = pts[0]!;
      const pdotR = Math.max(4, 4 * Math.min(scale, 2));
      const pdx = cx + p0.x * auPx;
      const pdy = cy - p0.z * auPx;
      ctx.beginPath();
      ctx.arc(pdx, pdy, Math.max(2, 3 * scale), 0, Math.PI * 2);
      ctx.fillStyle = planet.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      this.markers2d.push({ id: planet.name, name: planet.name, cx: pdx, cy: pdy, r: pdotR, hasDossier: false });
    }

    // Asteroid orbits
    const isMobile = w < 768;
    const toRender = isMobile ? this.asteroids().slice(0, 5) : this.asteroids();
    const highlightId = this.highlightId();

    for (const ast of toRender) {
      if (!ast.elements) continue;

      const isHighlighted = highlightId === ast.id;
      const color = isHighlighted ? '#ffffff' : orbitClassColor(ast.orbitClass);
      const pts = orbitEllipsePoints(ast.elements, 96);
      drawOrbit(pts, color, isHighlighted ? 0.9 : 0.5);

      // Perihelion marker (selectable)
      const p0 = pts[0]!;
      const markerR = Math.max(2, (isHighlighted ? 5 : 3) * Math.min(scale, 2));
      const mx = cx + p0.x * auPx;
      const my = cy - p0.z * auPx;
      ctx.beginPath();
      ctx.arc(mx, my, markerR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      this.markers2d.push({ id: ast.id, name: ast.name, cx: mx, cy: my, r: markerR, hasDossier: true });

      // Current epoch position marker
      if (ast.meanAnomalyDeg !== null && ast.meanAnomalyDeg !== undefined) {
        const pos = orbitPositionAtMeanAnomaly(ast.elements, ast.meanAnomalyDeg);
        const emx = cx + pos.x * auPx;
        const emy = cy - pos.z * auPx;
        ctx.beginPath();
        ctx.arc(emx, emy, markerR * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = isHighlighted ? '#fbbf24' : '#6ee7b7';
        ctx.fill();
        this.markers2d.push({ id: ast.id, name: ast.name, cx: emx, cy: emy, r: markerR * 0.75 + 4, hasDossier: true });
      }
    }

    // Sun (drawn last so it sits on top of everything)
    const sunGradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
    sunGradient.addColorStop(0, 'rgba(254,240,138,0.6)');
    sunGradient.addColorStop(1, 'rgba(254,240,138,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = sunGradient;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    this.markers2d.push({ id: 'sun', name: 'The Sun', cx, cy, r: 18, hasDossier: false });
  }

  private onCanvas2DClick(event: MouseEvent): void {
    const canvas = this.canvas2d;
    if (!canvas) return;
    // Ignore clicks that were part of a drag
    if (this.drag2d) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (event.clientX - rect.left) * scaleX;
    const my = (event.clientY - rect.top) * scaleY;
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    this.pick2D(mx, my, cssX, cssY, rect.width, rect.height);
  }

  private onCanvas2DTouch(event: TouchEvent): void {
    const t = event.changedTouches[0];
    if (!t || !this.canvas2d) return;
    const rect = this.canvas2d.getBoundingClientRect();
    const scaleX = this.canvas2d.width / rect.width;
    const scaleY = this.canvas2d.height / rect.height;
    const mx = (t.clientX - rect.left) * scaleX;
    const my = (t.clientY - rect.top) * scaleY;
    const cssX = t.clientX - rect.left;
    const cssY = t.clientY - rect.top;
    this.pick2D(mx, my, cssX, cssY, rect.width, rect.height);
  }

  private pick2D(mx: number, my: number, cssX: number, cssY: number, hostW: number, hostH: number): void {
    for (const marker of this.markers2d) {
      const dx = mx - marker.cx;
      const dy = my - marker.cy;
      if (Math.sqrt(dx * dx + dy * dy) <= marker.r + 8) {
        const popup = this.calcPopupPos(cssX, cssY, hostW, hostH);
        this.zone.run(() => {
          this.selectedPopup.set({ id: marker.id, name: marker.name, ...popup, hasDossier: marker.hasDossier });
          if (marker.hasDossier) this.asteroidSelected.emit(marker.id);
        });
        return;
      }
    }
    this.zone.run(() => this.selectedPopup.set(null));
  }

  // ── Three.js scene helpers ───────────────────────────────────────────────────

  private addStarField(scene: THREE.Scene): void {
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 18 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, sizeAttenuation: true });
    scene.add(new THREE.Points(geo, mat));
  }

  private addPlanetOrbits(scene: THREE.Scene): void {
    for (const planet of INNER_PLANETS) {
      const pts = orbitEllipsePoints(planet.elements, 128);
      const verts = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => {
        verts[i * 3] = p.x; verts[i * 3 + 1] = p.y; verts[i * 3 + 2] = p.z;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(planet.color),
        opacity: 0.35,
        transparent: true,
      });
      scene.add(new THREE.LineLoop(geo, mat));

      // Planet sphere at perihelion position
      const sGeo = new THREE.SphereGeometry(planet.displayRadius, 8, 8);
      const sMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(planet.color) });
      const sphere = new THREE.Mesh(sGeo, sMat);
      sphere.position.set(pts[0]!.x, pts[0]!.y, pts[0]!.z);
      sphere.userData = { name: planet.name, hasDossier: false };
      scene.add(sphere);
      this.nonAsteroidMeshes.set(planet.name, sphere);
    }
  }

  private rebuildAsteroidOrbits(asteroids: OrbitalAsteroid[]): void {
    // 2D mode: just redraw the canvas
    if (this.canvas2d) {
      this.draw2D();
      return;
    }

    if (!this.scene) return;

    // Remove old asteroid objects (orbit lines + markers)
    for (const mesh of this.asteroidMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.asteroidMeshes.clear();

    const isMobile = window.innerWidth < 768;
    const toRender = isMobile ? asteroids.slice(0, 5) : asteroids;
    const highlightId = this.highlightId();

    for (const ast of toRender) {
      if (!ast.elements) continue;

      const isHighlighted = highlightId === ast.id;
      const color = isHighlighted ? '#ffffff' : orbitClassColor(ast.orbitClass);
      const orbitOpacity = isHighlighted ? 0.9 : 0.55;
      const markerRadius = isHighlighted ? 0.04 : 0.025;

      const pts = orbitEllipsePoints(ast.elements, 96);

      // Orbit line
      const verts = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => {
        verts[i * 3] = p.x; verts[i * 3 + 1] = p.y; verts[i * 3 + 2] = p.z;
      });
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        opacity: orbitOpacity,
        transparent: true,
      });
      this.scene.add(new THREE.LineLoop(lineGeo, lineMat));

      // Perihelion marker (always shown — selectable)
      const periGeo = new THREE.SphereGeometry(markerRadius, 8, 8);
      const periMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      const periMarker = new THREE.Mesh(periGeo, periMat);
      const p0 = pts[0];
      if (p0) periMarker.position.set(p0.x, p0.y, p0.z);
      periMarker.userData = { asteroidId: ast.id, asteroidName: ast.name, hasDossier: true };
      this.scene.add(periMarker);
      this.asteroidMeshes.set(ast.id, periMarker);

      // Current epoch position marker
      if (ast.meanAnomalyDeg !== null && ast.meanAnomalyDeg !== undefined) {
        const epochPos = orbitPositionAtMeanAnomaly(ast.elements, ast.meanAnomalyDeg);
        const epochGeo = new THREE.SphereGeometry(markerRadius * 0.8, 8, 8);
        const epochMat = new THREE.MeshBasicMaterial({ color: isHighlighted ? 0xfbbf24 : 0x6ee7b7 });
        const epochMarker = new THREE.Mesh(epochGeo, epochMat);
        epochMarker.position.set(epochPos.x, epochPos.y, epochPos.z);
        epochMarker.userData = { asteroidId: ast.id, asteroidName: ast.name };
        this.scene.add(epochMarker);
      }
    }
  }

  // ── Three.js raycasting ──────────────────────────────────────────────────────

  private onCanvasClick(event: MouseEvent): void {
    this.pickAt(event.clientX, event.clientY);
  }

  private onCanvasTouch(event: TouchEvent): void {
    const t = event.changedTouches[0];
    if (t) this.pickAt(t.clientX, t.clientY);
  }

  private pickAt(clientX: number, clientY: number): void {
    const host = this.canvasHost?.nativeElement;
    if (!host || !this.camera || !this.renderer) return;

    const rect = host.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const x = (cssX / rect.width) * 2 - 1;
    const y = -(cssY / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.1 };
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    const allMeshes = [...this.asteroidMeshes.values(), ...this.nonAsteroidMeshes.values()];
    const hits = raycaster.intersectObjects(allMeshes);
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit) {
        const hasDossier = (hit.object.userData['hasDossier'] as boolean | undefined) ?? false;
        const popup = this.calcPopupPos(cssX, cssY, rect.width, rect.height);
        if (hasDossier) {
          const id = hit.object.userData['asteroidId'] as string | undefined;
          const name = hit.object.userData['asteroidName'] as string | undefined;
          if (id && name) {
            this.zone.run(() => {
              this.selectedPopup.set({ id, name, ...popup, hasDossier: true });
              this.asteroidSelected.emit(id);
            });
          }
        } else {
          const name = hit.object.userData['name'] as string | undefined;
          if (name) {
            this.zone.run(() => {
              this.selectedPopup.set({ id: '', name, ...popup, hasDossier: false });
            });
          }
        }
      }
    } else {
      this.zone.run(() => this.selectedPopup.set(null));
    }
  }

  // ── Popup helpers ────────────────────────────────────────────────────────────

  private calcPopupPos(cssX: number, cssY: number, hostW: number, hostH: number): { left: number; top: number } {
    const POPUP_W = 160;
    const POPUP_H = 80;
    const left = Math.max(4, Math.min(cssX - POPUP_W / 2, hostW - POPUP_W - 4));
    const top = cssY > POPUP_H + 20 ? cssY - POPUP_H - 10 : cssY + 14;
    return { left, top: Math.max(4, Math.min(top, hostH - POPUP_H - 4)) };
  }

  onPopupDossierClick(): void {
    const popup = this.selectedPopup();
    if (popup) {
      this.asteroidSelected.emit(popup.id);
      this.selectedPopup.set(null);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  private teardown(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }
    this.controls?.dispose();

    if (this.scene) {
      this.scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            for (const m of obj.material) m.dispose();
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    this.nonAsteroidMeshes.clear();
    this.renderer?.dispose();

    const host = this.canvasHost?.nativeElement;
    if (host && this.renderer) {
      host.removeChild(this.renderer.domElement);
    }

    if (this.canvas2d && host) {
      host.removeChild(this.canvas2d);
      this.canvas2d = undefined;
    }
  }
}

// Helper to convert AsteroidDetail → OrbitalAsteroid
export function asteroidDetailToOrbital(detail: AsteroidDetail): OrbitalAsteroid {
  const hasElements =
    detail.semi_major_axis_au !== null &&
    detail.eccentricity !== null &&
    detail.inclination_deg !== null;

  const a = detail.semi_major_axis_au;
  const orbitClass =
    a === null ? 'Apollo' :
    a < 1.0 ? 'Aten' :
    a < 2.0 ? 'Apollo' :
    a < 2.5 ? 'Amor' :
    a < 4.2 ? 'MBA' : 'OMB';

  return {
    id: detail.nasa_id,
    name: detail.name ?? detail.designation ?? detail.nasa_id,
    orbitClass,
    meanAnomalyDeg: detail.mean_anomaly_deg,
    elements: hasElements
      ? {
          semiMajorAxis: detail.semi_major_axis_au!,
          eccentricity: detail.eccentricity!,
          inclination: detail.inclination_deg!,
          longitudeAscNode: detail.longitude_asc_node_deg ?? 0,
          argPerihelion: detail.argument_perihelion_deg ?? 0,
        }
      : null,
  };
}
