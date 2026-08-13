import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, OrbitControls, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Scroll3DCanvasProps {
    scrollProgress: number; // 0 to 1
    customGlbUrl?: string;
    themeColor?: string;
}

// 1. Dynamic Particles Field
const ParticlesField: React.FC<{ progress: number }> = ({ progress }) => {
    const count = 300;
    const pointsRef = useRef<THREE.Points>(null);

    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const color1 = new THREE.Color('#6366f1');
        const color2 = new THREE.Color('#38bdf8');
        const color3 = new THREE.Color('#f43f5e');

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20;

            const lerpColor = i % 3 === 0 ? color1 : i % 3 === 1 ? color2 : color3;
            col[i * 3] = lerpColor.r;
            col[i * 3 + 1] = lerpColor.g;
            col[i * 3 + 2] = lerpColor.b;
        }
        return [pos, col];
    }, [count]);

    useFrame((state, delta) => {
        if (pointsRef.current) {
            pointsRef.current.rotation.y += delta * 0.08 * (1 + progress);
            pointsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.2 + progress * 0.5;
        }
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-color"
                    args={[colors, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.06}
                vertexColors
                transparent
                opacity={0.7}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
};

// 2. Custom GLTF Loader Component for Alpha3D models
const Alpha3DModel: React.FC<{ url: string; progress: number }> = ({ url, progress }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF(url);

    useFrame((_, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.5;
            groupRef.current.position.y = Math.sin(progress * Math.PI * 2) * 0.8;
            groupRef.current.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.3);
        }
    });

    return <primitive ref={groupRef} object={scene} scale={1.5} />;
};

// 3. Main Procedural Sculptures (Morphing 3D Shapes based on Scroll)
const ScrollSculpture: React.FC<{ progress: number }> = ({ progress }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        const time = state.clock.getElapsedTime();

        // Rotation morph according to scroll
        meshRef.current.rotation.x = time * 0.3 + progress * Math.PI * 2;
        meshRef.current.rotation.y = time * 0.5 + progress * Math.PI * 4;
        meshRef.current.rotation.z = Math.sin(time * 0.2) * 0.5;

        // Position morphing across 4 scroll phases
        // Phase 0 (Hero): Center elevated [0, 0.2, 0]
        // Phase 1 (Services): Rotated right [2, 0, -1]
        // Phase 2 (Analytics): Zoomed left [-2.2, 0.5, 1]
        // Phase 3 (CTA): Epic spin center [0, -0.5, 2]

        const targetX = progress < 0.25 
            ? 0 
            : progress < 0.5 
            ? 2.2 - (progress - 0.25) * 8.8 
            : progress < 0.75 
            ? -2.2 + (progress - 0.5) * 8.8 
            : 0;

        const targetY = progress < 0.25
            ? Math.sin(time * 1.5) * 0.2
            : Math.sin(time * 2) * 0.3;

        const targetScale = 1 + Math.sin(progress * Math.PI * 2) * 0.4;

        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.05);
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.05);
        meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.05));

        if (ringRef.current) {
            ringRef.current.rotation.x = -time * 0.4 + progress * Math.PI * 3;
            ringRef.current.rotation.y = time * 0.6;
            ringRef.current.position.x = meshRef.current.position.x;
            ringRef.current.position.y = meshRef.current.position.y;
        }
    });

    // Dynamic Geometry morphing
    const geoStage = Math.floor(progress * 4);

    return (
        <group>
            {/* Outer Cyber Ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[2.4, 0.04, 16, 100]} />
                <meshStandardMaterial
                    color={progress > 0.5 ? '#f43f5e' : '#38bdf8'}
                    emissive={progress > 0.5 ? '#f43f5e' : '#38bdf8'}
                    emissiveIntensity={0.8}
                    wireframe
                />
            </mesh>

            {/* Main Polyhedron / Glass Core */}
            <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
                <mesh ref={meshRef}>
                    {geoStage === 0 && <icosahedronGeometry args={[1.4, 1]} />}
                    {geoStage === 1 && <torusKnotGeometry args={[1.0, 0.35, 128, 32]} />}
                    {geoStage === 2 && <dodecahedronGeometry args={[1.3, 0]} />}
                    {geoStage >= 3 && <octahedronGeometry args={[1.5, 2]} />}

                    {/* Premium Glassmorphism Material */}
                    <MeshTransmissionMaterial
                        backside
                        samples={8}
                        resolution={256}
                        transmission={0.92}
                        roughness={0.15}
                        clearcoat={1}
                        clearcoatRoughness={0.1}
                        thickness={0.8}
                        chromaticAberration={0.4}
                        anisotropy={0.3}
                        distortion={0.4}
                        distortionScale={0.3}
                        temporalDistortion={0.2}
                        color={progress > 0.6 ? '#e0e7ff' : '#c7d2fe'}
                    />
                </mesh>
            </Float>
        </group>
    );
};

export const Scroll3DCanvas: React.FC<Scroll3DCanvasProps> = ({
    scrollProgress,
    customGlbUrl
}) => {
    return (
        <div className="w-full h-full absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <Canvas
                camera={{ position: [0, 0, 6], fov: 45 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            >
                <ambientLight intensity={0.7} />
                <directionalLight position={[10, 10, 5]} intensity={1.8} color="#6366f1" />
                <directionalLight position={[-10, -10, -5]} intensity={1.2} color="#ec4899" />
                <pointLight position={[0, 0, 3]} intensity={2} color="#38bdf8" />

                <ParticlesField progress={scrollProgress} />

                {customGlbUrl ? (
                    <Alpha3DModel url={customGlbUrl} progress={scrollProgress} />
                ) : (
                    <ScrollSculpture progress={scrollProgress} />
                )}

                <Environment preset="city" />
            </Canvas>
        </div>
    );
};
