import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders';
import type { Shapes } from './shapes';
import type { Look } from '../config';

export interface FieldOptions {
  look: Look;
  pointSize: number;
  maxPixelRatio: number;
}

/** One THREE.Points cloud on a fixed full-screen canvas. */
export class ParticleField {
  readonly uniforms = {
    uTime: { value: 0 },
    uSize: { value: 0 },
    uPixelRatio: { value: 1 },
    uDissolve: { value: 0 },
    uScatter: { value: 0 },
    uMorphA: { value: new THREE.Vector4() },
    uMorphB: { value: new THREE.Vector4() },
    uMorphC: { value: 0 },
    uMorphS: { value: 0 },
    uLogo: { value: new THREE.Vector4(1, 0, 0, 0) },
    uIntro: { value: 1 },
    uMap: { value: new THREE.Vector4(1, 0, 0, 0) },
    uMapEnd: { value: new THREE.Vector4(1, 0, 0, 0) },
    uSignal: { value: new THREE.Vector4(1, 0, 0, 0) },
    uCrystal: { value: new THREE.Vector4(1, 0, 0, 0) },
    uGlobe: { value: new THREE.Vector4(1, 0, 0, 0) },
    uBackdrops: { value: Array.from({ length: 4 }, () => new THREE.Vector4(1, 0, 0, 0)) },
    uTilt: { value: new THREE.Vector4() },
    uBackdropYaw: { value: 0 },
    uGlobeRot: { value: new THREE.Vector2() },
    uOffice: { value: new THREE.Vector2(0, 0) },
    uWork: { value: new THREE.Vector4(1, 0, 0, 0) },
    uServices: { value: new THREE.Vector4(1, 0, 0, 0) },
    uSilkA: { value: new THREE.Vector4() },
    uSilkB: { value: new THREE.Vector4() },
    uSilkPose: { value: new THREE.Vector3(0.45, 0, 0.45) },
    uSilk: { value: new THREE.Vector2(72, 0.45) },
    uEndDim: { value: 1 },
    uBackdropDim: { value: 0.5 },
    uTurbulence: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPointerActive: { value: 0 },
    uAspect: { value: 1 },
    uColor: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() },
    uExposure: { value: 1 },
  };

  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  /** Size of the z = 0 plane in world units, updated on resize. */
  readonly view = { width: 1, height: 1 };
  /** The canvas in CSS px — the viewport minus any scrollbar, so not innerWidth. */
  readonly screen = { width: 1, height: 1 };

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;

  constructor(private readonly container: HTMLElement, shapes: Shapes, private readonly options: FieldOptions) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.camera.position.z = 3;

    // Attributes are kept few (see the vertex shader): xyz shapes carry a
    // brightness in their w.
    const n = shapes.count;
    const xyzw = (xyz: Float32Array, w: Float32Array) => {
      const out = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) out.set([xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2], w[i]], i * 4);
      return out;
    };

    const seed = new Float32Array(n * 4);
    const extra = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 4; c++) seed[i * 4 + c] = Math.random();
      extra[i * 4] = Math.random();
      // Mostly even dots with a rare larger "star".
      extra[i * 4 + 1] = 0.6 + 0.25 * Math.random() + 1.1 * Math.pow(Math.random(), 8);
      extra[i * 4 + 2] = shapes.globe.arcMeta[i * 2];
      extra[i * 4 + 3] = shapes.globe.arcMeta[i * 2 + 1];
    }

    const g = this.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(shapes.map.positions, 3));
    g.setAttribute('aMapLuma', new THREE.BufferAttribute(shapes.map.luma, 1));
    g.setAttribute('aLogo', new THREE.BufferAttribute(xyzw(shapes.logo.positions, shapes.logo.luma), 4));
    g.setAttribute('aCrystal', new THREE.BufferAttribute(shapes.crystal, 4));
    g.setAttribute('aGlobe', new THREE.BufferAttribute(xyzw(shapes.globe.surface, shapes.globe.luma), 4));
    g.setAttribute('aArcTo', new THREE.BufferAttribute(shapes.globe.arcTo, 4));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aExtra', new THREE.BufferAttribute(extra, 4));
    // Shapes move far outside the base positions; never cull the cloud.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.setLook(options.look);

    const points = new THREE.Points(g, this.material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.resize();
  }

  /** Dot colour and blending for a theme; the caller drives uExposure each frame. */
  setLook(look: Look): void {
    this.uniforms.uColor.value.set(look.color);
    this.uniforms.uAccent.value.set(look.accent);
    this.material.blending = look.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    this.screen.width = width;
    this.screen.height = height;
    const ratio = Math.min(window.devicePixelRatio, this.options.maxPixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.view.height = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.view.width = this.view.height * this.camera.aspect;

    this.uniforms.uPixelRatio.value = ratio;
    this.uniforms.uAspect.value = this.camera.aspect;
    // Slightly larger dots on big screens so density reads the same.
    this.uniforms.uSize.value = this.options.pointSize * THREE.MathUtils.clamp(height / 900, 0.8, 1.3);
  }

  /** Where a world-space point lands on screen, in CSS px. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.screen.width, y: (0.5 - p.y * 0.5) * this.screen.height };
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
