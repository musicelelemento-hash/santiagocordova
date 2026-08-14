import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface Scroll3DCanvasProps {
    scrollProgress: number; // 0 to 1
    customGlbUrl?: string;
    theme?: 'light' | 'dark';
}

// 1. High-Performance Holographic Particle Field
const ParticlesField: React.FC<{ progress: number; theme?: 'light' | 'dark' }> = ({ progress, theme = 'dark' }) => {
    const count = typeof window !== 'undefined' && window.innerWidth < 768 ? 70 : 130;
    const pointsRef = useRef<THREE.Points>(null);

    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const color1 = new THREE.Color(theme === 'dark' ? '#00A896' : '#0d9488');
        const color2 = new THREE.Color(theme === 'dark' ? '#2B6AFF' : '#0284c7');
        const color3 = new THREE.Color(theme === 'dark' ? '#C9A96E' : '#d97706');

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 18;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 18;

            const lerpColor = i % 3 === 0 ? color1 : i % 3 === 1 ? color2 : color3;
            col[i * 3] = lerpColor.r;
            col[i * 3 + 1] = lerpColor.g;
            col[i * 3 + 2] = lerpColor.b;
        }
        return [pos, col];
    }, [count, theme]);

    useFrame((state, delta) => {
        if (pointsRef.current) {
            pointsRef.current.rotation.y += delta * 0.04 * (1 + progress * 1.5);
            pointsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.15 + progress * 0.4;
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
                size={typeof window !== 'undefined' && window.innerWidth < 768 ? 0.06 : 0.045}
                vertexColors
                transparent
                opacity={theme === 'dark' ? 0.7 : 0.5}
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

// 3. Pointer-Responsive Interactive 3D Crystal Sculpture
const ScrollSculpture: React.FC<{ progress: number; theme?: 'light' | 'dark' }> = ({ progress, theme = 'dark' }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const innerCoreRef = useRef<THREE.Mesh>(null);
    const { pointer, viewport } = useThree();

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        const time = state.clock.getElapsedTime();

        // Target positions based on viewport and scroll progress
        let targetX = 0;
        if (!isMobile) {
            targetX = progress < 0.25 
                ? (pointer.x * viewport.width * 0.05) 
                : progress < 0.5 
                ? 1.8 - (progress - 0.25) * 7.0 
                : progress < 0.75 
                ? -1.8 + (progress - 0.5) * 7.0 
                : (pointer.x * viewport.width * 0.05);
        } else {
            // Mobile centered with gentle breathing motion
            targetX = (pointer.x * 0.3);
        }

        const targetY = (isMobile ? -0.2 : 0) + (progress < 0.25 ? Math.sin(time * 1.2) * 0.15 : Math.sin(time * 1.5) * 0.2) + (pointer.y * 0.1);
        const targetScale = (isMobile ? 0.85 : 1.1) + Math.sin(progress * Math.PI) * 0.2;

        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.06);
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.06);
        meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.06));

        // Smooth rotation with pointer reaction
        meshRef.current.rotation.x = time * 0.2 + progress * Math.PI * 1.5 + (pointer.y * 0.4);
        meshRef.current.rotation.y = time * 0.28 + progress * Math.PI * 2 + (pointer.x * 0.4);
        meshRef.current.rotation.z = Math.sin(time * 0.15) * 0.25;

        if (ringRef.current) {
            ringRef.current.rotation.x = -time * 0.25 + progress * Math.PI * 2;
            ringRef.current.rotation.y = time * 0.35;
            ringRef.current.position.x = meshRef.current.position.x;
            ringRef.current.position.y = meshRef.current.position.y;
            ringRef.current.scale.setScalar(meshRef.current.scale.x * 1.15);
        }

        if (innerCoreRef.current) {
            innerCoreRef.current.rotation.x = -time * 0.5;
            innerCoreRef.current.rotation.y = -time * 0.6;
            innerCoreRef.current.position.x = meshRef.current.position.x;
            innerCoreRef.current.position.y = meshRef.current.position.y;
        }
    });

    const geoStage = Math.floor(progress * 4);

    return (
        <group>
            {/* Outer Quantum Torus Ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[isMobile ? 1.8 : 2.2, 0.025, 16, 64]} />
                <meshStandardMaterial
                    color={progress > 0.5 ? '#00A896' : (theme === 'dark' ? '#2B6AFF' : '#0284c7')}
                    emissive={progress > 0.5 ? '#00A896' : (theme === 'dark' ? '#2B6AFF' : '#0284c7')}
                    emissiveIntensity={theme === 'dark' ? 0.7 : 0.4}
                    wireframe
                />
            </mesh>

            {/* Glowing Inner Core */}
            <mesh ref={innerCoreRef}>
                <octahedronGeometry args={[isMobile ? 0.4 : 0.5, 0]} />
                <meshStandardMaterial
                    color={theme === 'dark' ? '#00A896' : '#0d9488'}
                    emissive={theme === 'dark' ? '#00A896' : '#0d9488'}
                    emissiveIntensity={1.2}
                    roughness={0.2}
                />
            </mesh>

            {/* Main Polyhedron / High-FPS Obsidian Glass Sculpture */}
            <Float speed={1.8} rotationIntensity={0.6} floatIntensity={0.8}>
                <mesh ref={meshRef}>
                    {geoStage === 0 && <icosahedronGeometry args={[1.3, 1]} />}
                    {geoStage === 1 && <torusKnotGeometry args={[0.9, 0.3, 64, 16]} />}
                    {geoStage === 2 && <dodecahedronGeometry args={[1.2, 0]} />}
                    {geoStage >= 3 && <octahedronGeometry args={[1.3, 1]} />}

                    <meshPhysicalMaterial
                        color={theme === 'dark' ? (progress > 0.6 ? '#cffafe' : '#e0f2fe') : '#ffffff'}
                        transmission={0.88}
                        opacity={0.9}
                        transparent
                        roughness={0.12}
                        metalness={0.15}
                        clearcoat={1.0}
                        clearcoatRoughness={0.1}
                        reflectivity={0.95}
                        ior={1.5}
                        attenuationColor={theme === 'dark' ? '#00A896' : '#0284c7'}
                        attenuationDistance={1.2}
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
        <div className="w-full h-full absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <Canvas
                camera={{ position: [0, 0, typeof window !== 'undefined' && window.innerWidth < 768 ? 6.5 : 5.5], fov: 45 }}
                dpr={[1, typeof window !== 'undefined' && window.innerWidth < 768 ? 1.2 : 1.5]}
                gl={{ 
                    antialias: true, 
                    alpha: true, 
                    powerPreference: 'high-performance',
                    depth: true
                }}
            >
                <ambientLight intensity={theme === 'dark' ? 0.9 : 1.4} />
                <directionalLight position={[8, 8, 4]} intensity={1.8} color={theme === 'dark' ? '#2B6AFF' : '#0284c7'} />
                <directionalLight position={[-8, -8, -4]} intensity={1.4} color="#00A896" />
                <pointLight position={[0, 0, 3]} intensity={1.6} color={theme === 'dark' ? '#38bdf8' : '#0284c7'} />

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

export default Scroll3DCanvas;
