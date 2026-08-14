import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface Scroll3DCanvasProps {
    scrollProgress: number; // 0 to 1
    customGlbUrl?: string;
    theme?: 'light' | 'dark';
}

// 1. High-Performance Particle Field (Optimized vertex count)
const ParticlesField: React.FC<{ progress: number; theme?: 'light' | 'dark' }> = ({ progress, theme = 'dark' }) => {
    const count = 120;
    const pointsRef = useRef<THREE.Points>(null);

    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const color1 = new THREE.Color(theme === 'dark' ? '#2B6AFF' : '#0284c7');
        const color2 = new THREE.Color(theme === 'dark' ? '#00A896' : '#0d9488');
        const color3 = new THREE.Color(theme === 'dark' ? '#6366f1' : '#6366f1');

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 16;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 16;

            const lerpColor = i % 3 === 0 ? color1 : i % 3 === 1 ? color2 : color3;
            col[i * 3] = lerpColor.r;
            col[i * 3 + 1] = lerpColor.g;
            col[i * 3 + 2] = lerpColor.b;
        }
        return [pos, col];
    }, [count, theme]);

    useFrame((state, delta) => {
        if (pointsRef.current) {
            pointsRef.current.rotation.y += delta * 0.05 * (1 + progress);
            pointsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.15 + progress * 0.3;
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
                size={0.05}
                vertexColors
                transparent
                opacity={theme === 'dark' ? 0.6 : 0.45}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
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

// 3. Ultra-Fast Glass Polyhedron (Single-Pass Hardware Accelerated)
const ScrollSculpture: React.FC<{ progress: number; theme?: 'light' | 'dark' }> = ({ progress, theme = 'dark' }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        const time = state.clock.getElapsedTime();

        // Smooth continuous morphing rotation
        meshRef.current.rotation.x = time * 0.25 + progress * Math.PI * 1.5;
        meshRef.current.rotation.y = time * 0.35 + progress * Math.PI * 2;
        meshRef.current.rotation.z = Math.sin(time * 0.15) * 0.3;

        // Position interpolation across scroll phases
        const targetX = progress < 0.25 
            ? 0 
            : progress < 0.5 
            ? 2.0 - (progress - 0.25) * 8.0 
            : progress < 0.75 
            ? -2.0 + (progress - 0.5) * 8.0 
            : 0;

        const targetY = progress < 0.25
            ? Math.sin(time * 1.2) * 0.15
            : Math.sin(time * 1.5) * 0.2;

        const targetScale = 1 + Math.sin(progress * Math.PI) * 0.25;

        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.05);
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.05);
        meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.05));

        if (ringRef.current) {
            ringRef.current.rotation.x = -time * 0.3 + progress * Math.PI * 2;
            ringRef.current.rotation.y = time * 0.4;
            ringRef.current.position.x = meshRef.current.position.x;
            ringRef.current.position.y = meshRef.current.position.y;
        }
    });

    const geoStage = Math.floor(progress * 4);

    return (
        <group>
            {/* Outer Cyber Ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[2.2, 0.03, 12, 64]} />
                <meshStandardMaterial
                    color={progress > 0.5 ? '#00A896' : (theme === 'dark' ? '#2B6AFF' : '#0284c7')}
                    emissive={progress > 0.5 ? '#00A896' : (theme === 'dark' ? '#2B6AFF' : '#0284c7')}
                    emissiveIntensity={theme === 'dark' ? 0.6 : 0.4}
                    wireframe
                />
            </mesh>

            {/* Main Polyhedron / High-FPS Glass Core */}
            <Float speed={1.5} rotationIntensity={0.8} floatIntensity={1.0}>
                <mesh ref={meshRef}>
                    {geoStage === 0 && <icosahedronGeometry args={[1.3, 1]} />}
                    {geoStage === 1 && <torusKnotGeometry args={[0.9, 0.3, 64, 16]} />}
                    {geoStage === 2 && <dodecahedronGeometry args={[1.2, 0]} />}
                    {geoStage >= 3 && <octahedronGeometry args={[1.3, 1]} />}

                    {/* Single-Pass High-Performance Glass / Crystal Material */}
                    <meshPhysicalMaterial
                        color={theme === 'dark' ? (progress > 0.6 ? '#dbeafe' : '#cffafe') : '#f8fafc'}
                        transmission={0.85}
                        opacity={0.85}
                        transparent
                        roughness={0.1}
                        metalness={0.1}
                        clearcoat={1.0}
                        clearcoatRoughness={0.1}
                        reflectivity={0.9}
                        ior={1.45}
                    />
                </mesh>
            </Float>
        </group>
    );
};

export const Scroll3DCanvas: React.FC<Scroll3DCanvasProps> = ({
    scrollProgress,
    customGlbUrl,
    theme = 'dark'
}) => {
    return (
        <div className="w-full h-full absolute inset-0 pointer-events-none z-0 overflow-hidden hidden sm:block">
            <Canvas
                camera={{ position: [0, 0, 5.5], fov: 45 }}
                dpr={[1, 1.5]}
                gl={{ 
                    antialias: true, 
                    alpha: true, 
                    powerPreference: 'high-performance',
                    depth: true
                }}
            >
                <ambientLight intensity={theme === 'dark' ? 0.8 : 1.2} />
                <directionalLight position={[8, 8, 4]} intensity={1.5} color={theme === 'dark' ? '#2B6AFF' : '#0284c7'} />
                <directionalLight position={[-8, -8, -4]} intensity={1.0} color="#00A896" />
                <pointLight position={[0, 0, 2.5]} intensity={1.5} color="#38bdf8" />

                <ParticlesField progress={scrollProgress} theme={theme} />

                {customGlbUrl ? (
                    <Alpha3DModel url={customGlbUrl} progress={scrollProgress} />
                ) : (
                    <ScrollSculpture progress={scrollProgress} theme={theme} />
                )}
            </Canvas>
        </div>
    );
};
