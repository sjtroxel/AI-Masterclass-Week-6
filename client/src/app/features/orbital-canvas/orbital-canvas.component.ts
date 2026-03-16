import {
  Component,
  ElementRef,
  NgZone,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  effect,
  afterNextRender,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full overflow-hidden rounded-xl bg-space-950"
         [style.height.px]="canvasHeight()">
      <!-- Three.js mounts here -->
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

      <!-- Tap hint (mobile) -->
      @if (sceneReady()) {
        <div class="absolute bottom-3 left-0 right-0 flex justify-center md:hidden pointer-events-none">
          <span class="text-[9px] text-space-600 bg-space-950/80 rounded px-2 py-1">
            Tap orbit to select asteroid
          </span>
        </div>
      }
    </div>
  `,
})
export class OrbitalCanvasComponent {
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

  // ── Three.js scene objects ───────────────────────────────────────────────────

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls?: OrbitControls;
  private rafId?: number;

  /** Map asteroidId → mesh for raycasting */
  private asteroidMeshes = new Map<string, THREE.Mesh>();

  readonly planetLegend = INNER_PLANETS.map((p) => ({ name: p.name, color: p.color }));

  constructor() {
    // Adjust canvas height for desktop
    afterNextRender(() => {
      if (typeof window !== 'undefined') {
        this.canvasHeight.set(window.innerWidth >= 768 ? 520 : 320);
        this.initScene();
      }
    });

    // Rebuild orbits when asteroid list or highlight changes
    effect(() => {
      const asteroids = this.asteroids();
      const highlightId = this.highlightId();  // tracked so effect re-runs on change
      void highlightId; // consumed for signal tracking
      if (this.scene) {
        this.rebuildAsteroidOrbits(asteroids);
      }
    });

    this.destroyRef.onDestroy(() => this.teardown());
  }

  // ── Scene init ───────────────────────────────────────────────────────────────

  private initScene(): void {
    const host = this.canvasHost?.nativeElement;
    if (!host) return;

    this.zone.runOutsideAngular(() => {
      const width = host.clientWidth || 375;
      const height = this.canvasHeight();
      const isMobile = window.innerWidth < 768;

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

      // Camera
      if (isMobile) {
        const aspect = width / height;
        const frustum = 3.5;
        const cam = new THREE.OrthographicCamera(
          -frustum * aspect, frustum * aspect,
          frustum, -frustum,
          0.01, 100,
        );
        cam.position.set(0, 6, 0);
        cam.lookAt(0, 0, 0);
        this.camera = cam;
      } else {
        const cam = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
        cam.position.set(0, 3.5, 5);
        cam.lookAt(0, 0, 0);
        this.camera = cam;
      }

      // Orbit controls
      const controls = new OrbitControls(this.camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.5;
      controls.maxDistance = 20;
      if (isMobile) {
        controls.enableRotate = false; // top-down locked on mobile
      }
      this.controls = controls;

      // Sun
      const sunGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      scene.add(new THREE.Mesh(sunGeo, sunMat));

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
    });
  }

  // ── Scene helpers ────────────────────────────────────────────────────────────

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

      // Planet sphere at mean position (perihelion for simplicity)
      const sGeo = new THREE.SphereGeometry(planet.displayRadius, 8, 8);
      const sMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(planet.color) });
      const sphere = new THREE.Mesh(sGeo, sMat);
      sphere.position.set(pts[0]!.x, pts[0]!.y, pts[0]!.z);
      scene.add(sphere);
    }
  }

  private rebuildAsteroidOrbits(asteroids: OrbitalAsteroid[]): void {
    if (!this.scene) return;

    // Remove old asteroid objects (orbit lines + markers)
    for (const mesh of this.asteroidMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.asteroidMeshes.clear();

    // On mobile, limit to first 5 asteroids to keep the view readable
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
      periMarker.userData = { asteroidId: ast.id, asteroidName: ast.name };
      this.scene.add(periMarker);
      this.asteroidMeshes.set(ast.id, periMarker);

      // Current epoch position marker — shown when mean anomaly is known from DB
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

  // ── Raycasting ───────────────────────────────────────────────────────────────

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
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.1 };
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    const meshes = Array.from(this.asteroidMeshes.values());
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit) {
        const id = hit.object.userData['asteroidId'] as string | undefined;
        if (id) {
          this.zone.run(() => this.asteroidSelected.emit(id));
        }
      }
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

    this.renderer?.dispose();

    const host = this.canvasHost?.nativeElement;
    if (host && this.renderer) {
      host.removeChild(this.renderer.domElement);
    }
  }
}

// Helper to convert AsteroidDetail → OrbitalAsteroid
export function asteroidDetailToOrbital(detail: AsteroidDetail): OrbitalAsteroid {
  const hasElements =
    detail.semi_major_axis_au !== null &&
    detail.eccentricity !== null &&
    detail.inclination_deg !== null;

  // Derive orbit class from semi-major axis as a rough approximation
  // (proper class from DB not available in AsteroidDetail API type)
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
