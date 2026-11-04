import * as THREE from "three";

// Rippling water with glints. uGlow lays the low sun's bright path across it (the ending's sunset).
export function makeWater(deep: number, shallow: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uGlow: { value: 0 },
      uGlowColor: { value: new THREE.Color(0xffc27a) },
      uGlowFrom: { value: new THREE.Vector2() },
      uGlowDir: { value: new THREE.Vector2(1, 0) },
    },
    vertexShader: `
      varying vec2 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform float uGlow;
      uniform vec3 uGlowColor;
      uniform vec2 uGlowFrom;
      uniform vec2 uGlowDir;
      varying vec2 vWorld;
      void main() {
        vec2 p = vWorld;
        float t = uTime;
        float wave = sin(p.x * 2.6 + t * 0.9 + sin(p.y * 1.9 + t * 0.5)) * 0.5
          + sin(p.y * 3.7 - t * 0.8 + sin(p.x * 1.4 - t * 0.3)) * 0.5;
        vec3 color = mix(uDeep, uShallow, 0.5 + wave * 0.32);
        float crest = sin(p.x * 13.0 + t * 1.8 + wave * 3.0) * sin(p.y * 15.0 - t * 1.5 - wave * 2.0);
        float glint = pow(max(0.0, crest), 26.0) * smoothstep(-0.2, 0.7, wave);
        color += vec3(0.75, 0.82, 0.85) * glint * 0.42;
        vec2 rel = p - uGlowFrom;
        float side = dot(rel, vec2(-uGlowDir.y, uGlowDir.x));
        float band = exp(-side * side * 0.09);
        color = mix(color, uGlowColor, uGlow * band * (0.32 + 0.3 * wave));
        color += uGlowColor * uGlow * band * glint * 1.4;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
