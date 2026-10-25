// Every shape is a target position for the same particles. The vertex shader
// builds each target (the intro logo, London map, crystal and globe from
// attributes; office ping, the silk sheets, globe arcs, orbit and the four
// abstract backdrops procedurally), then blends them with scroll-driven
// weights.
// The fragment shader draws each point as a soft round dot.

export const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  // Intro: 0 → 1 as the drawn logo dissolves into its dots, then as they
  // drift apart a little.
  uniform float uDissolve;
  uniform float uScatter;
  // x: map→always-on silk, y: →crystal, z: →globe, w: →"how we work" silk
  uniform vec4 uMorphA;
  // →the services silk
  uniform float uMorphS;
  // x: →sea, y: →ring, z: →galaxy, w: →ribbon (the backdrops)
  uniform vec4 uMorphB;
  // →the London map again, beside the contact details
  uniform float uMorphC;
  // Intro: 1 = the dots hold the logo (where the preloader drew it), 0 = the map.
  uniform float uIntro;
  uniform vec4 uLogo;        // placement, like the others below

  // Per-shape placement: x = scale (globe: radius), yzw = offset (world units).
  uniform vec4 uMap;
  uniform vec4 uMapEnd;
  uniform vec4 uSignal;
  uniform vec4 uCrystal;
  uniform vec4 uGlobe;
  uniform vec4 uBackdrops[4];
  uniform vec4 uTilt;        // map yaw, map pitch, signal lean, crystal lean
  uniform float uBackdropYaw;
  uniform vec2 uGalaxySpin;  // extra turn of the galaxy's core, and of its rim
  uniform vec2 uGlobeRot;    // yaw, pitch
  uniform vec2 uOffice;      // office, in map coordinates
  uniform vec4 uWork;        // the "how we work" silk ribbon
  uniform vec4 uServices;    // the services silk
  uniform vec4 uSilkA;       // the services silk's form (see silk())…
  uniform vec4 uSilkB;
  uniform vec3 uSilkPose;    // …and pose: tilt, yaw, depth
  uniform vec2 uSilk;        // rows in every silk (fewer on phones, which have fewer dots), always-on depth
  uniform float uEndDim;     // brightness of the closing map (dimmer behind text on phones)
  uniform float uBackdropDim; // brightness of the backdrops behind the copy

  uniform float uTurbulence;
  uniform vec2 uPointer;     // NDC
  uniform float uPointerActive;
  uniform float uAspect;

  // Kept few: some GPUs (ANGLE on Direct3D, many phones) refuse more than
  // ~12 attributes, so spare w slots carry other data. Anything new should
  // be procedural, like the backdrops.
  attribute float aMapLuma;  // the map's brightness
  attribute vec4 aLogo;      // logo xyz; w: brightness, +2 if amber (the N, the rules)
  attribute vec4 aCrystal;   // crystal xyz; w: brightness, +2 on the inner layer
  attribute vec4 aGlobe;     // globe surface xyz; w: brightness
  attribute vec4 aArcTo;     // far end of the arc, w loops per second
  attribute vec4 aSeed;      // independent randoms
  attribute vec4 aExtra;     // x: position along paths, y: size, z: arc phase, w: arc height (0 = surface dot)

  varying float vAlpha;
  varying float vGlow;

  const float TAU = 6.28318530718;
  const float PI = 3.14159265359;

  vec3 rotateY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  }

  vec3 rotateX(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  }

  vec3 place(vec3 local, vec4 placement, float yaw) {
    return rotateY(local, yaw) * placement.x + placement.yzw;
  }

  // ~0.7% of the dots on each silk float above it as out-of-focus specks.
  float silkSpeck() {
    return step(aSeed.z, 0.007);
  }

  // Silk: a sheet of fine lines — rows of dots running along x — rolling
  // in slow swells. Every silk on the page is this one sheet with different
  // parameters:
  //   a: x swell height, y swell frequency, z ripples spreading from the
  //      centre, w twist along its length
  //   b: x pleats, y saddle, z a rising crest, w narrowing (0 = a full
  //      sheet, 1 = a ribbon)
  // Returns the point in -1..1 (x along the rows, z across them, back to
  // front); lum is how much light it catches: crests bright, far rows in
  // shadow.
  vec3 silk(vec4 a, vec4 b, out float lum) {
    float t = uTime;
    float x = aExtra.x * 2.0 - 1.0;
    float z = (floor(aSeed.y * uSilk.x) + 0.5) / uSilk.x * 2.0 - 1.0;
    float f = a.y;
    float h = a.x * (0.5 * sin(x * 3.1 * f + z * 1.3 * f + t * 0.45)
      + 0.33 * sin(x * 5.4 * f - z * 2.1 * f - t * 0.32 + 1.3)
      + 0.15 * sin((x * 1.5 + z) * 6.0 * f + t * 0.7));
    float r = length(vec2(x * 1.3, z));
    h += a.z * 0.1 * sin(r * 13.0 - t * 1.4) * exp(-r * 1.2);
    h += b.x * 0.08 * (pow(abs(sin(x * 6.0 + z * 0.8 + t * 0.25)), 0.35) - 0.6);
    h += b.y * 0.3 * (x * x - z * z);
    h += b.z * 0.3 * exp(-pow((z + 0.1 - 0.15 * sin(x * 2.0 + t * 0.35)) * 2.8, 2.0));
    vec3 p = vec3(x, h, z * mix(1.0, 0.2, b.w));
    float twist = a.w * (x + 0.3 * sin(t * 0.2));
    p.yz = vec2(p.y * cos(twist) - p.z * sin(twist), p.y * sin(twist) + p.z * cos(twist));
    float amp = max(a.x + a.z * 0.1 + b.x * 0.08 + b.y * 0.3 + b.z * 0.3, 0.01);
    lum = (0.2 + 0.8 * smoothstep(-0.5 * amp, 0.8 * amp, h)) * mix(0.35, 1.0, z * 0.5 + 0.5);
    vec3 speck = vec3(
      fract(aSeed.w * 7.31) * 2.0 - 1.0 + sin(t * 0.15 + aSeed.x * TAU) * 0.04,
      0.05 + fract(aSeed.x * 3.7) * 0.25 + sin(t * 0.2 + aSeed.w * TAU) * 0.02,
      fract(aSeed.y * 5.3) * 2.0 - 1.0);
    float isSpeck = silkSpeck();
    lum = mix(lum, 0.6, isSpeck);
    return mix(p, speck, isSpeck);
  }

  void main() {
    // London — in the hero and again at the end. A few dots ring the office
    // and pulse outward like a radar ping.
    float isPing = step(fract(aSeed.y * 23.1), 0.025);
    float ping = fract(uTime * 0.4 + step(0.5, aSeed.w) * 0.5);
    float pingAngle = aExtra.x * TAU;
    vec3 pingPos = vec3(uOffice + vec2(cos(pingAngle), sin(pingAngle)) * (0.01 + ping * 0.075), 0.02);
    float pingFade = (1.0 - ping) * smoothstep(0.0, 0.08, ping);
    vec3 mapLocal = rotateX(rotateY(mix(position, pingPos, isPing), uTilt.x), uTilt.y);
    vec3 map = mapLocal * uMap.x + uMap.yzw;
    vec3 mapEnd = mapLocal * uMapEnd.x + uMapEnd.yzw;

    // The intro logo, exactly where the preloader drew it: the drawn logo
    // dissolves into its dots in place (each dot fades in at its own moment),
    // they drift apart a little — still reading as the logo, loosened, with
    // depth — then flow into the map.
    float logoAmber = step(1.5, aLogo.w);
    float logoLuma = (aLogo.w - logoAmber * 2.0) * (1.0 - 0.2 * uScatter);
    float born = smoothstep(0.0, 1.0, (uDissolve - aSeed.x * 0.6) / 0.4);
    vec3 scatterDir = normalize(aSeed.zyx - 0.5 + 0.0001);
    // Most dots stay close (the letters still read); a long tail strays far.
    vec3 scatter = scatterDir * (0.03 + 0.6 * pow(aSeed.w, 4.0)) + vec3(aLogo.xy * 0.08, 0.0);
    vec3 logo = (aLogo.xyz + scatter * uScatter) * uLogo.x + uLogo.yzw;
    vec3 hero = mix(map, logo, uIntro);

    // Silk, shared by every silk shape: amber glints run along a few rows
    // and the specks glow amber; the sides fade off rather than end hard.
    float silkRow = floor(aSeed.y * uSilk.x);
    float isSpeck = silkSpeck();
    float glintAt = fract(uTime * 0.1 + fract(silkRow * 0.37)) * 2.6 - 1.3;
    float silkGlint = step(fract(silkRow * 0.618), 0.12) * (1.0 - isSpeck)
      * exp(-pow((aExtra.x * 2.0 - 1.0 - glintAt) / 0.08, 2.0)) + isSpeck;
    float silkEdge = mix(smoothstep(1.0, 0.82, abs(aExtra.x * 2.0 - 1.0)), 1.0, isSpeck);

    // Always on: a wide silk sheet along the bottom of the screen, rolling
    // in slow swells that never stop, seen from a low angle.
    float signalLuma;
    vec3 signalLocal = silk(vec4(0.1, 1.0, 0.0, 0.0), vec4(0.0), signalLuma) * vec3(1.0, 1.0, uSilk.y);
    vec3 signal = place(rotateX(rotateY(signalLocal, sin(uTime * 0.07) * 0.08 - 0.1), 0.35), uSignal, uTilt.z * 0.3);

    // Protected: a crystal — bright edges and vertices around an inner
    // crystal and soft core that turn the other way. A faint amber scan
    // passes down through it every few seconds.
    float crystalInner = step(1.5, aCrystal.w);
    float crystalLuma = aCrystal.w - crystalInner * 2.0;
    float crystalSpin = mix(uTime * 0.16, -uTime * 0.42, crystalInner);
    vec3 crystalLocal = rotateX(rotateY(aCrystal.xyz, crystalSpin), mix(0.36, -0.28, crystalInner));
    vec3 crystal = place(crystalLocal, uCrystal, uTilt.w);
    float scanY = 1.3 - fract(uTime * 0.18) * 3.2;
    float scan = exp(-pow((crystalLocal.y - scanY) / 0.05, 2.0));

    // Globe: arc dots fly along great circles from London, lifted off the
    // surface mid-flight; packets loop, trail dots hold still.
    float isArc = step(0.0001, aExtra.w);
    float isPacket = isArc * step(0.0001, aArcTo.w);
    float arcT = fract(aExtra.z + uTime * aArcTo.w);
    float omega = acos(clamp(dot(aGlobe.xyz, aArcTo.xyz), -1.0, 1.0));
    vec3 arc = (sin((1.0 - arcT) * omega) * aGlobe.xyz + sin(arcT * omega) * aArcTo.xyz) / max(sin(omega), 0.001);
    arc *= 1.0 + aExtra.w * sin(PI * arcT);
    vec3 g = rotateX(rotateY(mix(aGlobe.xyz, arc, isArc), uGlobeRot.x), uGlobeRot.y);
    // ~3% of the dots run a dashed orbit around it, independent of its spin.
    float isOrbit = step(fract(aSeed.x * 7.7 + aSeed.y * 1.3), 0.03) * (1.0 - isArc);
    float orbitAngle = aExtra.x * TAU + uTime * 0.22;
    vec3 orbitPos = rotateX(vec3(cos(orbitAngle), 0.0, sin(orbitAngle)) * 1.42, 0.3);
    orbitPos.xy = vec2(orbitPos.x * 0.94 + orbitPos.y * 0.34, orbitPos.y * 0.94 - orbitPos.x * 0.34);
    g = mix(g, orbitPos, isOrbit);
    vec3 globe = g * uGlobe.x + uGlobe.yzw;
    float behindGlobe = step(g.z, 0.0) * step(length(g.xy), 1.0);

    // How we work: the silk narrowed to a ribbon, twisting as it flows
    // right across the band above the pillars.
    float workLuma;
    vec3 workLocal = silk(vec4(0.07, 0.8, 0.0, 1.5), vec4(0.0, 0.0, 0.0, 1.0), workLuma);
    vec3 work = place(rotateX(rotateY(workLocal, sin(uTime * 0.05) * 0.08), 0.15), uWork, 0.0);

    // Services: a wide silk sheet low on the screen that changes form for
    // each service (uSilkA/B, set from config.serviceSilk), flowing from one
    // form into the next as you scroll. uSilkPose: tilt, yaw, depth.
    float servicesLuma;
    vec3 servicesLocal = silk(uSilkA, uSilkB, servicesLuma) * vec3(1.0, 1.0, uSilkPose.z);
    vec3 services = place(rotateX(rotateY(servicesLocal, uSilkPose.y + sin(uTime * 0.06) * 0.06), uSilkPose.x), uServices, 0.0);

    // Backdrops for the reading sections: abstract, slow-moving dot forms
    // kept dim behind the copy — nothing to read, just motion.

    // Case studies: a calm sea of dots — a lattice rippling under layered
    // swells, seen from a low angle. Crests catch the light.
    vec2 cell = (floor(vec2(aSeed.y * 180.0, aSeed.w * 72.0)) + 0.5) / vec2(180.0, 72.0);
    vec3 sea = vec3((cell.x - 0.5) * 2.0, 0.0, (cell.y - 0.5) * 1.1);
    sea.y = sin(sea.x * 5.0 + uTime * 0.6) * 0.05
      + sin(sea.z * 8.0 - uTime * 0.8) * 0.035
      + sin((sea.x + sea.z) * 11.0 + uTime * 0.45) * 0.02;
    float seaLuma = 0.25 + 0.75 * smoothstep(-0.07, 0.09, sea.y);
    vec3 back0 = place(rotateX(sea, 0.42), uBackdrops[0], uBackdropYaw * 0.3);

    // Why choose us: a wireframe ring of dots turning slowly, a ripple
    // running round it. Nearer dots are brighter.
    float ringU = aSeed.y * TAU;
    float ringV = (floor(aSeed.w * 28.0) + 0.5) / 28.0 * TAU;
    float tube = 0.36 * (1.0 + 0.12 * sin(ringU * 5.0 - uTime * 1.1));
    vec3 ring = vec3((1.0 + tube * cos(ringV)) * cos(ringU), tube * sin(ringV), (1.0 + tube * cos(ringV)) * sin(ringU));
    ring = rotateX(rotateY(ring, uTime * 0.12), 1.05);
    float ringLuma = 0.2 + 0.8 * smoothstep(-1.2, 1.2, ring.z);
    vec3 back1 = place(ring, uBackdrops[1], uBackdropYaw);

    // Testimonials: a slow spiral galaxy — three arms winding out from a
    // bright core, seen at a tilt. Each new quote turns it on a third: the
    // core leads and the rim follows (uGalaxySpin), so it swirls.
    float reach = pow(aSeed.y, 0.7);
    float arm = floor(aSeed.w * 3.0);
    float drift = (fract(aSeed.w * 3.0) - 0.5) * mix(1.5, 0.35, reach);
    float swirl = arm * TAU / 3.0 + reach * 5.0 + drift - uTime * 0.06 - mix(uGalaxySpin.x, uGalaxySpin.y, reach);
    vec3 galaxy = vec3(cos(swirl) * reach, (aSeed.z - 0.5) * 0.06 * (1.0 - reach), sin(swirl) * reach);
    float galaxyLuma = 0.25 + 0.75 * pow(1.0 - reach, 1.5);
    vec3 back2 = place(rotateX(galaxy, 1.15), uBackdrops[2], uBackdropYaw);

    // FAQs: a ribbon of dotted threads drifting and twisting across the
    // screen; faces turned to the light glow brighter.
    float ribbonS = (floor(aExtra.x * 400.0) + 0.5) / 400.0;
    float ribbonW = (floor(aSeed.y * 22.0) + 0.5) / 22.0 * 2.0 - 1.0;
    float ribbonTwist = ribbonS * TAU * 0.9 + uTime * 0.25;
    vec3 ribbon = vec3(
      (ribbonS - 0.5) * 3.2,
      sin(ribbonS * TAU * 1.1 + uTime * 0.35) * 0.28,
      cos(ribbonS * TAU * 0.7 + uTime * 0.3) * 0.25
    ) + vec3(0.0, cos(ribbonTwist), sin(ribbonTwist)) * ribbonW * 0.24;
    float ribbonLuma = 0.25 + 0.75 * (0.5 + 0.5 * sin(ribbonTwist));
    vec3 back3 = place(ribbon, uBackdrops[3], uBackdropYaw * 0.5);

    // A light sprinkle of amber through all four.
    float backAmber = step(0.965, fract(aSeed.x * 41.3));

    vec3 shape = mix(hero, signal, uMorphA.x);
    shape = mix(shape, crystal, uMorphA.y);
    shape = mix(shape, globe, uMorphA.z);
    shape = mix(shape, work, uMorphA.w);
    shape = mix(shape, services, uMorphS);
    shape = mix(shape, back0, uMorphB.x);
    shape = mix(shape, back1, uMorphB.y);
    shape = mix(shape, back2, uMorphB.z);
    shape = mix(shape, back3, uMorphB.w);
    shape = mix(shape, mapEnd, uMorphC);

    float mapLuma = mix(aMapLuma, 1.0, isPing);
    float heroLuma = mix(mapLuma, logoLuma, uIntro);
    float luma = mix(heroLuma, min(1.0, signalLuma + silkGlint * 0.6), uMorphA.x);
    luma = mix(luma, min(1.0, crystalLuma + scan * 0.6), uMorphA.y);
    luma = mix(luma, mix(aGlobe.w, 0.7, isOrbit), uMorphA.z);
    luma = mix(luma, min(1.0, workLuma + silkGlint * 0.6), uMorphA.w);
    luma = mix(luma, min(1.0, servicesLuma + silkGlint * 0.6), uMorphS);
    luma = mix(luma, seaLuma, uMorphB.x);
    luma = mix(luma, ringLuma, uMorphB.y);
    luma = mix(luma, galaxyLuma, uMorphB.z);
    luma = mix(luma, ribbonLuma, uMorphB.w);
    luma = mix(luma, mapLuma, uMorphC);

    // How much each shape currently "owns" the particle (sections come one
    // after another, so each weight is ~1 before the next starts).
    float oMap = 1.0 - uMorphA.x;
    float oSignal = uMorphA.x * (1.0 - uMorphA.y);
    float oCrystal = uMorphA.y * (1.0 - uMorphA.z);
    float oGlobe = uMorphA.z * (1.0 - uMorphA.w);
    float oWork = uMorphA.w * (1.0 - uMorphS);
    float oServices = uMorphS * (1.0 - uMorphB.x);
    float oSilk = oSignal + oWork + oServices;
    vec4 oBack = uMorphB * (1.0 - vec4(uMorphB.yzw, uMorphC));
    float oBackdrop = oBack.x + oBack.y + oBack.z + oBack.w;
    float oMapEnd = uMorphC;

    // The office ping belongs to the map, not the intro logo.
    float pinging = (oMap * (1.0 - uIntro) + oMapEnd) * isPing;
    float shapeAlpha = mix(1.0, pingFade, pinging);
    // The far side of the globe shows through (no depth test) — dim it,
    // and the stretch of orbit passing behind it.
    float globeFacing = mix(mix(0.14, 1.0, smoothstep(-0.25, 0.45, g.z)), mix(1.0, 0.15, behindGlobe), isOrbit);
    globeFacing *= mix(1.0, step(0.4, fract(aExtra.x * 90.0)), isOrbit);
    shapeAlpha *= mix(1.0, globeFacing, oGlobe);
    shapeAlpha *= mix(1.0, silkEdge, oSilk);
    // The services silk stays a touch calmer behind the service text.
    shapeAlpha *= mix(1.0, 0.8, oServices);
    // Backdrops stay subtle behind the copy.
    shapeAlpha *= mix(1.0, uBackdropDim, oBackdrop);
    shapeAlpha *= mix(1.0, uEndDim, oMapEnd);
    // Amber accents: office ping, the silks' glints and specks, scan line,
    // globe packets and the backdrops' sprinkle.
    float accent = pinging + oMap * uIntro * logoAmber + oSilk * silkGlint
      + oCrystal * scan * 0.8 + oGlobe * isPacket + oBackdrop * backAmber;

    vec3 pos = shape;
    pos.z += sin(uTime * 0.7 + aSeed.w * TAU) * 0.012;
    vec3 jitterDir = normalize(aSeed.xyz - 0.5 + 0.0001);
    pos += jitterDir * uTurbulence * 0.06 * sin(uTime * 6.0 + aSeed.w * 40.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vec4 clip = projectionMatrix * mv;

    // Cursor: nearby dots brighten, pick up the accent and lean away.
    vec2 toPointer = clip.xy / clip.w - uPointer;
    toPointer.x *= uAspect;
    float near = smoothstep(0.3, 0.0, length(toPointer)) * born * uPointerActive;
    clip.xy += normalize(toPointer + 0.00001) * 0.03 * vec2(1.0 / uAspect, 1.0) * near * clip.w;
    gl_Position = clip;

    float twinkle = 0.8 + 0.2 * sin(uTime * 1.3 + aSeed.w * 30.0);
    float nearCamera = smoothstep(0.25, 1.0, -mv.z);
    vAlpha = (0.12 + 0.88 * luma) * twinkle * shapeAlpha * nearCamera * (1.0 + near * 1.6) * born;
    vGlow = clamp(max(near, accent), 0.0, 1.0);

    // The silks' amber specks are large and soft, like out-of-focus light.
    float size = uSize * aExtra.y * (1.0 + oSilk * isSpeck * 1.3);
    gl_PointSize = min(size * uPixelRatio / max(-mv.z, 0.05), 40.0 * uPixelRatio);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uExposure;

  varying float vAlpha;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.18, 0.5, d);
    vec3 color = mix(uColor, uAccent, vGlow * 0.85);
    gl_FragColor = vec4(color, min(core * vAlpha * uExposure, 1.0));
    #include <colorspace_fragment>
  }
`;
