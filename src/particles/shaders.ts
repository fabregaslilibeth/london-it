// Every shape is a target position for the same particles. The vertex shader
// builds each target (London map, clock dial, shield and globe from
// attributes; office ping, clock hands, globe arcs, orbit, DNA helix and the
// four abstract backdrops procedurally), then blends them with scroll-driven
// weights.
// The fragment shader draws each point as a soft round dot.

export const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uFormation;
  // x: map→clock, y: →shield, z: →globe, w: →DNA helix
  uniform vec4 uMorphA;
  // x: →chart, y: →headset, z: →reviews, w: →question mark
  uniform vec4 uMorphB;
  // →the London map again, beside the contact details
  uniform float uMorphC;

  // Per-shape placement: x = scale (globe: radius), yzw = offset (world units).
  uniform vec4 uMap;
  uniform vec4 uMapEnd;
  uniform vec4 uClock;
  uniform vec4 uShield;
  uniform vec4 uGlobe;
  uniform vec4 uBackdrops[4];
  uniform vec4 uTilt;        // map yaw, map pitch, clock yaw, shield yaw
  uniform float uBackdropYaw;
  uniform vec2 uGlobeRot;    // yaw, pitch
  uniform vec2 uOffice;      // office, in map coordinates
  uniform vec3 uClockHands;  // hour, minute, second — radians clockwise from 12
  uniform vec4 uHelix;       // length, side-on radius, end-on radius, spin phase
  uniform vec4 uHelixPose;   // turn (0 side-on → 1 end-on), yaw, pitch, centre z
  uniform vec2 uHelixShift;  // slide along its axis (0..1 through the DNA section), lift (world units)
  uniform float uEndDim;     // brightness of the closing map (dimmer behind text on phones)
  uniform float uBackdropDim; // brightness of the backdrops behind the copy

  uniform float uTurbulence;
  uniform vec2 uPointer;     // NDC
  uniform float uPointerActive;
  uniform float uAspect;

  // Kept few: some GPUs (ANGLE on Direct3D, many phones) refuse more than
  // ~12 attributes, so spare w slots carry other data. Anything new should
  // be procedural, like the backdrops.
  attribute vec4 aClock;     // clock xyz; w: scatter origin x
  attribute vec4 aShield;    // shield xyz; w: scatter origin y
  attribute vec4 aGlobe;     // globe surface xyz; w: scatter origin z
  attribute vec4 aArcTo;     // far end of the arc, w loops per second
  attribute vec4 aLuma;      // map, clock, shield, globe
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

  void main() {
    // Intro: each particle starts on its own delay and spirals in.
    float delay = aSeed.x * 0.55;
    float t = clamp((uFormation - delay) / (1.0 - delay), 0.0, 1.0);
    float ease = 1.0 - pow(1.0 - t, 3.0);
    vec3 origin = rotateY(vec3(aClock.w, aShield.w, aGlobe.w), (1.0 - ease) * 1.8);

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

    // Clock: the dial comes from the drawing; 10% of the dots leave it to
    // form hands showing the time in London. The second hand ticks in amber.
    float isHand = step(aSeed.z, 0.1);
    float hand = fract(aSeed.y * 3.7);
    float isSecond = step(0.75, hand);
    float handAngle = hand < 0.35 ? uClockHands.x : (hand < 0.75 ? uClockHands.y : uClockHands.z);
    float handLength = hand < 0.35 ? 0.24 : (hand < 0.75 ? 0.35 : 0.41);
    float handWidth = hand < 0.35 ? 0.026 : (hand < 0.75 ? 0.016 : 0.005);
    float along = mix(-0.14, 1.0, aExtra.x);
    float taper = 1.0 - 0.55 * clamp(along, 0.0, 1.0);
    vec2 handDir = vec2(sin(handAngle), cos(handAngle));
    vec2 handSide = vec2(handDir.y, -handDir.x);
    vec2 handPos = handDir * along * handLength + handSide * (aSeed.w - 0.5) * handWidth * taper;
    vec3 clock = place(mix(aClock.xyz, vec3(handPos, 0.015), isHand), uClock, uTilt.z);

    // Shield, with a scan line sweeping down it every few seconds.
    vec3 shield = place(aShield.xyz, uShield, uTilt.w);
    float scanY = 0.62 - fract(uTime * 0.2) * 1.6;
    float scan = exp(-pow((aShield.y - scanY) / 0.022, 2.0));

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

    // DNA, as on the reference site: two strands plus rungs, spinning fast
    // across the screen and sliding along as you scroll the "how we work"
    // section. In the services it swings round a quarter turn to point at
    // the viewer, where perspective turns it into a spinning vortex.
    float rough = 1.0 + uTurbulence * 4.0;
    float isRung = step(aSeed.z, 0.15);
    float helixAlong = mix(aExtra.x, (floor(aExtra.x * 44.0) + 0.5) / 44.0, isRung);
    float twist = helixAlong * 15.0 + uHelix.w + (aSeed.w - 0.5) * 0.12 * rough;
    vec2 spoke = vec2(cos(twist), sin(twist));
    float strand = step(0.5, aSeed.y) * 2.0 - 1.0;
    vec2 across = mix(spoke * strand, spoke * (fract(aSeed.y * 7.31) * 2.0 - 1.0), isRung);
    float turn = uHelixPose.x;
    float helixRadius = mix(uHelix.y, uHelix.z, turn) * (0.9 + 0.2 * fract(aSeed.w * 13.7) * rough);
    vec3 helixLocal = vec3((helixAlong - 0.5 - uHelixShift.x * 0.15) * uHelix.x, across * helixRadius);
    // A quarter turn about the vertical axis brings the left end toward the camera.
    vec3 helix = rotateX(rotateY(helixLocal, turn * PI * 0.5 + uHelixPose.y), uHelixPose.z) + vec3(0.0, uHelixShift.y, uHelixPose.w);
    // Side-on, both ends fade; end-on, the far end dims so the vanishing
    // point behind the text stays calm.
    float helixEnds = smoothstep(0.0, 0.05, helixAlong) * smoothstep(1.0, 0.94, helixAlong);
    float helixFade = mix(helixEnds, smoothstep(0.0, 0.05, helixAlong) * mix(1.0, 0.15, smoothstep(0.1, 1.0, helixAlong)), turn);

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
    // bright core, seen at a tilt.
    float reach = pow(aSeed.y, 0.7);
    float arm = floor(aSeed.w * 3.0);
    float drift = (fract(aSeed.w * 3.0) - 0.5) * mix(1.5, 0.35, reach);
    float swirl = arm * TAU / 3.0 + reach * 5.0 + drift - uTime * 0.06;
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

    vec3 shape = mix(map, clock, uMorphA.x);
    shape = mix(shape, shield, uMorphA.y);
    shape = mix(shape, globe, uMorphA.z);
    shape = mix(shape, helix, uMorphA.w);
    shape = mix(shape, back0, uMorphB.x);
    shape = mix(shape, back1, uMorphB.y);
    shape = mix(shape, back2, uMorphB.z);
    shape = mix(shape, back3, uMorphB.w);
    shape = mix(shape, mapEnd, uMorphC);

    float mapLuma = mix(aLuma.x, 1.0, isPing);
    float luma = mix(mapLuma, mix(aLuma.y, 1.0, isHand), uMorphA.x);
    luma = mix(luma, min(1.0, aLuma.z + scan * 0.8), uMorphA.y);
    luma = mix(luma, mix(aLuma.w, 0.7, isOrbit), uMorphA.z);
    luma = mix(luma, mix(0.75 + 0.25 * aSeed.w, 0.6, isRung), uMorphA.w);
    luma = mix(luma, seaLuma, uMorphB.x);
    luma = mix(luma, ringLuma, uMorphB.y);
    luma = mix(luma, galaxyLuma, uMorphB.z);
    luma = mix(luma, ribbonLuma, uMorphB.w);
    luma = mix(luma, mapLuma, uMorphC);

    // How much each shape currently "owns" the particle (sections come one
    // after another, so each weight is ~1 before the next starts).
    float oMap = 1.0 - uMorphA.x;
    float oClock = uMorphA.x * (1.0 - uMorphA.y);
    float oShield = uMorphA.y * (1.0 - uMorphA.z);
    float oGlobe = uMorphA.z * (1.0 - uMorphA.w);
    float oHelix = uMorphA.w * (1.0 - uMorphB.x);
    vec4 oBack = uMorphB * (1.0 - vec4(uMorphB.yzw, uMorphC));
    float oBackdrop = oBack.x + oBack.y + oBack.z + oBack.w;
    float oMapEnd = uMorphC;

    float shapeAlpha = mix(1.0, pingFade, (oMap + oMapEnd) * isPing);
    // The far side of the globe shows through (no depth test) — dim it,
    // and the stretch of orbit passing behind it.
    float globeFacing = mix(mix(0.14, 1.0, smoothstep(-0.25, 0.45, g.z)), mix(1.0, 0.15, behindGlobe), isOrbit);
    globeFacing *= mix(1.0, step(0.4, fract(aExtra.x * 90.0)), isOrbit);
    shapeAlpha *= mix(1.0, globeFacing, oGlobe);
    shapeAlpha *= mix(1.0, helixFade, oHelix);
    // Backdrops stay subtle behind the copy.
    shapeAlpha *= mix(1.0, uBackdropDim, oBackdrop);
    shapeAlpha *= mix(1.0, uEndDim, oMapEnd);
    // Amber accents: office ping, second hand, scan line, globe packets,
    // DNA rungs and the backdrops' sprinkle.
    float accent = (oMap + oMapEnd) * isPing + oClock * isHand * isSecond + oShield * scan
      + oGlobe * isPacket + oHelix * isRung * 0.5 + oBackdrop * backAmber;

    vec3 pos = mix(origin, shape, ease);
    pos.z += sin(uTime * 0.7 + aSeed.w * TAU) * 0.012 * ease;
    vec3 jitterDir = normalize(aSeed.xyz - 0.5 + 0.0001);
    pos += jitterDir * uTurbulence * 0.06 * sin(uTime * 6.0 + aSeed.w * 40.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vec4 clip = projectionMatrix * mv;

    // Cursor: nearby dots brighten, pick up the accent and lean away.
    vec2 toPointer = clip.xy / clip.w - uPointer;
    toPointer.x *= uAspect;
    float near = smoothstep(0.3, 0.0, length(toPointer)) * ease * uPointerActive;
    clip.xy += normalize(toPointer + 0.00001) * 0.03 * vec2(1.0 / uAspect, 1.0) * near * clip.w;
    gl_Position = clip;

    float twinkle = 0.8 + 0.2 * sin(uTime * 1.3 + aSeed.w * 30.0);
    float nearCamera = smoothstep(0.25, 1.0, -mv.z);
    vAlpha = (0.12 + 0.88 * luma) * twinkle * shapeAlpha * nearCamera * (1.0 + near * 1.6) * smoothstep(0.0, 0.15, t);
    vGlow = clamp(max(near, accent), 0.0, 1.0);

    float size = uSize * aExtra.y * (1.0 + (1.0 - ease) * 0.6);
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
