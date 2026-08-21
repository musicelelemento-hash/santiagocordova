import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Fondo generativo por GLSL: noise fractal fluido que muta de color según el
// progreso de la narrativa (rojo/alerta -> teal/blindaje -> dorado/marca).
// 100% procedural, sin imágenes ni llamadas a API — cero costo, cero latencia.

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uProgress;
    uniform vec2 uResolution;

    vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    vec3 palette(float t) {
        vec3 navy = vec3(0.03, 0.05, 0.13);
        vec3 red  = vec3(0.55, 0.16, 0.10);
        vec3 teal = vec3(0.0, 0.66, 0.59);
        vec3 gold = vec3(0.79, 0.66, 0.43);

        vec3 stage1 = mix(navy, red, 0.4);
        vec3 stage2 = mix(navy, teal, 0.55);
        vec3 stage3 = mix(navy, gold, 0.55);

        vec3 a = mix(stage1, stage2, smoothstep(0.0, 0.5, t));
        vec3 b = mix(stage2, stage3, smoothstep(0.5, 1.0, t));
        return t < 0.5 ? a : b;
    }

    void main() {
        vec2 uv = vUv;
        vec2 p = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);

        float n1 = snoise(vec3(p * 1.6, uTime * 0.045));
        float n2 = snoise(vec3(p * 3.2 + 4.0, uTime * 0.03));
        float flow = n1 * 0.65 + n2 * 0.35;

        vec3 base = vec3(0.008, 0.012, 0.03);
        vec3 accent = palette(uProgress);

        float glow = smoothstep(0.15, 0.9, flow);
        vec3 color = mix(base, accent, glow * 0.85);

        float vign = smoothstep(1.05, 0.35, length(p));
        color *= mix(0.6, 1.0, vign);

        gl_FragColor = vec4(color, 1.0);
    }
`;

const ShaderPlane: React.FC<{ progressRef: React.MutableRefObject<number> }> = ({ progressRef }) => {
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uProgress: { value: 0 },
            uResolution: { value: new THREE.Vector2(1, 1) },
        }),
        []
    );

    useFrame((state) => {
        uniforms.uTime.value = state.clock.getElapsedTime();
        uniforms.uProgress.value = progressRef.current;
        uniforms.uResolution.value.set(state.size.width, state.size.height);
    });

    return (
        <mesh frustumCulled={false}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                depthTest={false}
                depthWrite={false}
            />
        </mesh>
    );
};

export const ShaderBackdrop: React.FC<{ progressRef: React.MutableRefObject<number> }> = ({ progressRef }) => (
    <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas
            gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
            dpr={[1, 1.5]}
        >
            <ShaderPlane progressRef={progressRef} />
        </Canvas>
    </div>
);

export default ShaderBackdrop;
