"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface ThreeDModelProps {
  type: "heart" | "brain" | "lungs" | "kidneys";
  pulse?: boolean;
  showLabels?: boolean;
  activeStructure?: string;
  onStructureSelect?: (structure: string) => void;
  isGenerating?: boolean;
  neural4dPrompt?: string | null;
  neural4dModelUrl?: string | null;
  neural4dImageUrl?: string | null;
  pollProgress?: number;
  dynamicLabels?: any;
}

// 3D coordinates on each modular anatomy model
const nodePositionsMap = {
  heart: {
    "Left Ventricle": new THREE.Vector3(0.35, -0.65, 0.2),
    "Aorta Root": new THREE.Vector3(0.2, 1.15, -0.1),
    "Vena Cava": new THREE.Vector3(-0.55, 0.75, -0.3),
    "Myocardium Walls": new THREE.Vector3(-0.75, -0.3, 0.1)
  },
  brain: {
    "Cerebral Cortex": new THREE.Vector3(0.55, 0.7, 0.15),
    "Cerebellum": new THREE.Vector3(0, -0.85, 0.6),
    "Brainstem Loop": new THREE.Vector3(0, -1.25, 0.2),
    "Neural Synapses": new THREE.Vector3(0, 0, 0)
  },
  lungs: {
    "Pulmonary Lobes": new THREE.Vector3(1.05, -0.15, 0.1),
    "Trachea Conduit": new THREE.Vector3(0, 0.95, 0),
    "Bronchial Tree": new THREE.Vector3(0, 0.15, 0),
    "Alveoli Capillaries": new THREE.Vector3(-1.05, -0.75, 0.1)
  },
  kidneys: {
    "Renal Cortex": new THREE.Vector3(-0.75, 0.45, 0.2),
    "Renal Medulla": new THREE.Vector3(-0.55, 0, 0.1),
    "Ureter Tube": new THREE.Vector3(-0.35, -1.1, -0.1),
    "Renal Pelvis": new THREE.Vector3(-0.25, -0.2, 0)
  }
};

// Offset directions for the Sci-Fi HUD labels (in container-width percentages)
const labelOffsets: { [key: string]: { dx: number; dy: number } } = {
  // Heart
  "Left Ventricle": { dx: 18, dy: 12 },
  "Aorta Root": { dx: -18, dy: -14 },
  "Vena Cava": { dx: -18, dy: -6 },
  "Myocardium Walls": { dx: -18, dy: 10 },
  // Brain
  "Cerebral Cortex": { dx: 18, dy: -12 },
  "Cerebellum": { dx: 18, dy: 8 },
  "Brainstem Loop": { dx: -18, dy: 10 },
  "Neural Synapses": { dx: -18, dy: -12 },
  // Lungs
  "Pulmonary Lobes": { dx: 18, dy: 10 },
  "Trachea Conduit": { dx: -18, dy: -14 },
  "Bronchial Tree": { dx: 18, dy: -8 },
  "Alveoli Capillaries": { dx: -18, dy: 10 },
  // Kidneys
  "Renal Cortex": { dx: -18, dy: -12 },
  "Renal Medulla": { dx: -20, dy: 6 },
  "Ureter Tube": { dx: -15, dy: 15 },
  "Renal Pelvis": { dx: 18, dy: -5 },
  // Custom Dynamic Neural4D labels
  "External Organ Surface": { dx: -22, dy: 15 },
  "Veins & Blood Streams": { dx: 22, dy: -12 },
  "Natural Organ Coloration": { dx: 18, dy: 20 },
  "Internal Cavity & Cross-section": { dx: -20, dy: -15 }
};

export function ThreeDModel({
  type,
  pulse = true,
  showLabels = true,
  activeStructure = "",
  onStructureSelect,
  isGenerating = false,
  neural4dPrompt = null,
  neural4dModelUrl = null,
  neural4dImageUrl = null,
  pollProgress = 0,
  dynamicLabels = null
}: ThreeDModelProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = React.useState<Array<{ name: string; x: number; y: number; dx: number; dy: number }>>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = Math.max(300, mount.clientWidth);
    const height = Math.max(300, mount.clientHeight);

    // Create Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Create Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 7;

    // Create Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Add Lights - Standard studio white rig to show the true organic colors and textures
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    directionalLight1.position.set(6, 10, 6);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.85);
    directionalLight2.position.set(-6, -4, -6);
    scene.add(directionalLight2);

    const group = new THREE.Group();
    scene.add(group);

    let mainMesh: any;
    let particles: any;

    // Helper: Add Particle Cloud
    const createParticles = (count: number, radius: number, color: number) => {
      const pGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const r = (0.5 + Math.random() * 0.5) * radius;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      pGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      
      const pMaterial = new THREE.PointsMaterial({
        color: color,
        size: 0.08,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      return new THREE.Points(pGeometry, pMaterial);
    };

    const renderProcedural = () => {
      if (type === "heart") {
        const heartMat = new THREE.MeshPhongMaterial({
          color: 0xef4444,
          emissive: 0x3b0712,
          wireframe: true,
          transparent: true,
          opacity: 0.8
        });
        const ventGeo = new THREE.SphereGeometry(1.6, 24, 24);
        const posAttr = ventGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const z = posAttr.getZ(i);
          if (y < 0) {
            posAttr.setX(i, x * (1 + y * 0.3));
            posAttr.setZ(i, z * (1 + y * 0.3));
          }
        }
        ventGeo.computeVertexNormals();

        const ventricles = new THREE.Mesh(ventGeo, heartMat);
        ventricles.scale.set(1, 1.25, 0.95);
        mainMesh.add(ventricles);

        const aortaMat = new THREE.MeshPhongMaterial({ color: 0x06b6d4, wireframe: true });
        const aortaGeo = new THREE.TorusGeometry(0.8, 0.22, 12, 32, Math.PI);
        const aorta = new THREE.Mesh(aortaGeo, aortaMat);
        aorta.position.set(0.3, 1.2, -0.2);
        aorta.rotation.z = -Math.PI / 6;
        mainMesh.add(aorta);

        particles = createParticles(100, 2.4, 0xef4444);
        mainMesh.add(particles);

      } else if (type === "brain") {
        const brainMat = new THREE.MeshPhongMaterial({
          color: 0x06b6d4,
          emissive: 0x083344,
          wireframe: true,
          transparent: true,
          opacity: 0.85
        });

        const leftH = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 24), brainMat);
        leftH.scale.set(1.35, 1.05, 0.8);
        leftH.position.set(-0.55, 0.15, 0);
        mainMesh.add(leftH);

        const rightH = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 24), brainMat);
        rightH.scale.set(1.35, 1.05, 0.8);
        rightH.position.set(0.55, 0.15, 0);
        mainMesh.add(rightH);

        const cbMat = new THREE.MeshPhongMaterial({ color: 0xffffff, wireframe: true, opacity: 0.5, transparent: true });
        const cerebellum = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), cbMat);
        cerebellum.position.set(0, -0.9, 0.65);
        cerebellum.scale.set(1.15, 0.65, 0.95);
        mainMesh.add(cerebellum);

        particles = createParticles(120, 2.6, 0xffffff);
        mainMesh.add(particles);

      } else if (type === "lungs") {
        const lungMat = new THREE.MeshPhongMaterial({
          color: 0x14b8a6,
          emissive: 0x042f2e,
          wireframe: true,
          transparent: true,
          opacity: 0.8
        });

        const leftLung = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), lungMat);
        leftLung.scale.set(0.85, 1.75, 0.8);
        leftLung.position.set(-1.05, 0, 0);
        leftLung.rotation.z = Math.PI / 16;
        mainMesh.add(leftLung);

        const rightLung = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), lungMat);
        rightLung.scale.set(0.85, 1.75, 0.8);
        rightLung.position.set(1.05, 0, 0);
        rightLung.rotation.z = -Math.PI / 16;
        mainMesh.add(rightLung);

        const tracheaMat = new THREE.MeshPhongMaterial({ color: 0xffffff, wireframe: true });
        const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.0, 12, 4, true), tracheaMat);
        trachea.position.set(0, 1.0, 0);
        mainMesh.add(trachea);

        particles = createParticles(100, 2.6, 0x06b6d4);
        mainMesh.add(particles);

      } else if (type === "kidneys") {
        const kidneyMat = new THREE.MeshPhongMaterial({
          color: 0x8b5cf6,
          emissive: 0x2e1065,
          wireframe: true,
          transparent: true,
          opacity: 0.85
        });

        const leftKidneyGeo = new THREE.SphereGeometry(1.0, 24, 24);
        const posAttr = leftKidneyGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          if (x > 0) posAttr.setX(i, x * 0.3);
        }
        leftKidneyGeo.computeVertexNormals();

        const leftKidney = new THREE.Mesh(leftKidneyGeo, kidneyMat);
        leftKidney.scale.set(0.85, 1.4, 0.7);
        leftKidney.position.set(-0.65, 0, 0);
        leftKidney.rotation.z = Math.PI / 16;
        mainMesh.add(leftKidney);

        const rightKidney = new THREE.Mesh(leftKidneyGeo, kidneyMat);
        rightKidney.scale.set(-0.85, 1.4, 0.7);
        rightKidney.position.set(0.65, -0.2, 0);
        rightKidney.rotation.z = -Math.PI / 16;
        mainMesh.add(rightKidney);

        const ureterMat = new THREE.MeshPhongMaterial({ color: 0xc4b5fd, wireframe: true, opacity: 0.5, transparent: true });
        const ureterGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.8, 12, 4, true);
        
        const leftUreter = new THREE.Mesh(ureterGeo, ureterMat);
        leftUreter.position.set(-0.35, -1.0, -0.1);
        leftUreter.rotation.z = -Math.PI / 18;
        mainMesh.add(leftUreter);

        const rightUreter = new THREE.Mesh(ureterGeo, ureterMat);
        rightUreter.position.set(0.35, -1.2, -0.1);
        rightUreter.rotation.z = Math.PI / 18;
        mainMesh.add(rightUreter);

        particles = createParticles(90, 2.4, 0x8b5cf6);
        mainMesh.add(particles);
      }
    };

    mainMesh = new THREE.Group();
    group.add(mainMesh);

    // Organ-specific color palettes for the loaded GLB model
    const organColors: Record<string, { primary: number; emissive: number; particle: number }> = {
      heart:   { primary: 0xc0392b, emissive: 0x4a0000, particle: 0xef4444 },
      brain:   { primary: 0x06b6d4, emissive: 0x083344, particle: 0x22d3ee },
      lungs:   { primary: 0x14b8a6, emissive: 0x042f2e, particle: 0x2dd4bf },
      kidneys: { primary: 0x8b5cf6, emissive: 0x2e1065, particle: 0xa78bfa },
    };
    const colors = organColors[type] || organColors.kidneys;

    if (neural4dModelUrl && neural4dModelUrl !== 'fallback') {
      const loader = new GLTFLoader();
      console.log("[ThreeDModel] Loading Neural4D model:", neural4dModelUrl);
      loader.load(
        neural4dModelUrl,
        (gltf: any) => {
          console.log("[ThreeDModel] Neural4D GLTF loaded successfully!");
          const loadedModel = gltf.scene;

          // Auto-center and scale to fit viewport
          const box = new THREE.Box3().setFromObject(loadedModel);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          loadedModel.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 3.2 / maxDim : 1.0;
          loadedModel.scale.set(scale, scale, scale);

          // Keep original photorealistic Neural4D colors, textures, and materials!
          loadedModel.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              if (child.material) {
                // Ensure textures are rendered clearly on both sides and responsive to light
                child.material.side = THREE.DoubleSide;
                child.material.transparent = false;
                
                // If it is standard material, make sure organic details pop under studio lights
                if (child.material.metalness !== undefined) {
                  child.material.metalness = 0.15;
                }
                if (child.material.roughness !== undefined) {
                  child.material.roughness = 0.75;
                }
              }
            }
          });

          mainMesh.add(loadedModel);
          particles = createParticles(150, 2.8, colors.particle);
          mainMesh.add(particles);
        },
        undefined,
        (err: any) => {
          console.error("[ThreeDModel] GLTF load error:", err);
        }
      );
    } else {
      console.log("[ThreeDModel] No custom model url, leaving canvas clean.");
    }


    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const handleMouseDown = () => { isDragging = true; };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      if (isDragging) {
        group.rotation.y += (currentX - previousMousePosition.x) * 0.007;
        group.rotation.x += (currentY - previousMousePosition.y) * 0.007;
      }
      previousMousePosition = { x: currentX, y: currentY };
    };
    const handleMouseUp = () => { isDragging = false; };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(3.5, Math.min(15, camera.position.z + e.deltaY * 0.005));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", handleMouseDown);
    domElement.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    domElement.addEventListener("wheel", handleWheel);

    let clock = new THREE.Clock();
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      if (!isDragging) group.rotation.y += 0.0065;
      if (pulse && mainMesh) {
        let pulseScale = 1.0;
        if (type === "heart") pulseScale = 1.0 + Math.sin((elapsedTime * 1.5) % Math.PI * 2) * 0.08 * Math.pow(Math.sin((elapsedTime * 1.5) % Math.PI), 2);
        else if (type === "lungs") pulseScale = 1.0 + Math.sin(elapsedTime * 1.25) * 0.06;
        else if (type === "kidneys") pulseScale = 1.0 + Math.sin(elapsedTime * 0.8) * 0.04;
        else pulseScale = 1.0 + Math.sin(elapsedTime * 1.0) * 0.03;
        mainMesh.scale.set(pulseScale, pulseScale, pulseScale);
      }
      if (particles) particles.rotation.y -= 0.004;
      renderer.render(scene, camera);

      let activePositions = nodePositionsMap[type] as Record<string, any>;
      
      if (neural4dModelUrl && neural4dModelUrl !== 'fallback') {
        if (dynamicLabels && dynamicLabels.positions) {
          // Map dynamic Grok JSON labels to THREE Vectors
          activePositions = {};
          Object.keys(dynamicLabels.positions).forEach(key => {
            const p = dynamicLabels.positions[key];
            activePositions[key] = new THREE.Vector3(p.x, p.y, p.z);
          });
        } else {
          activePositions = {
            "External Organ Surface": new THREE.Vector3(-1.2, 0.8, 0.5),
            "Veins & Blood Streams": new THREE.Vector3(1.0, -0.4, 0.4),
            "Natural Organ Coloration": new THREE.Vector3(0.0, 1.2, -0.3),
            "Internal Cavity & Cross-section": new THREE.Vector3(-0.4, -1.0, 0.2)
          };
        }
      }
      
      const positionsArray: Array<{ name: string; x: number; y: number; dx: number; dy: number }> = [];
      Object.entries(activePositions).forEach(([name, localPos]: [string, any]) => {
        const tempV = new THREE.Vector3().copy(localPos).applyMatrix4(group.matrixWorld).project(camera);
        const x = (tempV.x * 0.5 + 0.5) * mount.clientWidth;
        const y = (-(tempV.y * 0.5) + 0.5) * mount.clientHeight;
        
        let offset = labelOffsets[name] || { dx: 15, dy: 10 };
        // Override with dynamic offsets if provided by Grok
        if (dynamicLabels && dynamicLabels.offsets && dynamicLabels.offsets[name]) {
          offset = dynamicLabels.offsets[name];
        }
        
        positionsArray.push({ name, x, y, dx: (offset.dx / 100) * mount.clientWidth, dy: (offset.dy / 100) * mount.clientHeight });
      });
      setNodePositions(positionsArray);
    };
    animate();

    const handleResize = () => {
      const newWidth = Math.max(300, mount.clientWidth);
      const newHeight = Math.max(300, mount.clientHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener("mousedown", handleMouseDown);
      domElement.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      domElement.removeEventListener("wheel", handleWheel);
      mount.removeChild(renderer.domElement);
      scene.clear();
      renderer.dispose();
    };
  }, [type, pulse, showLabels, activeStructure, isGenerating, neural4dModelUrl]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-transparent">
      {/* 1. Large High-Res 2D generated image preview (Only show if 3D model is not loaded yet) */}
      {neural4dImageUrl && !neural4dModelUrl && !isGenerating && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0d0d0d] p-6 text-center select-none">
          <div className="relative max-w-md w-full bg-[#171717]/95 border border-cyan-800/40 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col items-center gap-4 group">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              Neural4D Diagnostic Telemetry
            </p>
            
            {/* Clinical Crosshair Scanner Box */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[#2f2f2f] bg-black/50 group-hover:border-cyan-800/50 transition-all duration-300">
              <img
                src={neural4dImageUrl}
                alt="Neural4D High-Resolution Synthesis"
                className="w-full h-full object-cover select-none"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
              
              {/* Sci-Fi crosshairs in corners */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-500/40" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-500/40" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-500/40" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-500/40" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-white font-extrabold text-base capitalize">{type} Synthesis Complete</h4>
              <p className="text-xs text-[#8e8e8e] leading-relaxed">
                Diagnostic snapshot of your chat history successfully loaded. The interactive 3D model is active and rendering.
              </p>
            </div>
            
            {neural4dPrompt && (
              <div className="w-full bg-black/40 border border-[#2f2f2f] rounded-xl p-3 text-left">
                <span className="text-[9px] text-[#5f5f5f] font-mono block mb-1">ENGINEERED PROMPT:</span>
                <p className="text-[10px] text-[#b4b4b4] italic leading-relaxed line-clamp-3">"{neural4dPrompt}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Floating mini snapshot card (Only show when 3D model is active) */}
      {neural4dImageUrl && neural4dModelUrl && !isGenerating && (
        <div className="absolute top-16 right-4 z-30 pointer-events-auto bg-[#171717]/95 border border-cyan-800/40 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md max-w-[130px] transition-all duration-300 hover:scale-105 hover:border-cyan-500/80 group">
          <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest mb-1.5 text-center flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            Neural4D Snapshot
          </p>
          <div className="relative rounded-lg overflow-hidden border border-[#2f2f2f] bg-[#0a0a0a]">
            <img
              src={neural4dImageUrl}
              alt="Neural4D Generated Preview"
              className="w-28 h-28 object-cover select-none"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0d]/90 backdrop-blur-md rounded-xl overflow-hidden border border-cyan-900/40">
          {/* Spinning ring */}
          <div className="relative w-36 h-36 mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-900/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-cyan-600/60 animate-spin" style={{animationDuration:'1.5s', animationDirection:'reverse'}}></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-cyan-400 font-black tracking-widest text-xs">NEURAL4D</span>
              <span className="text-cyan-300 font-bold text-lg">{pollProgress > 0 ? `${pollProgress}%` : '...'}</span>
            </div>
          </div>

          <h3 className="text-white font-semibold text-base mb-1">Generating 3D Model</h3>
          <p className="text-[#6b6b6b] text-[11px] uppercase tracking-widest mb-4 font-mono">AI Text-to-3D Synthesis · ~90s</p>

          {/* Progress bar */}
          <div className="w-64 h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, pollProgress)}%` }}
            />
          </div>

          {/* Grok-engineered prompt */}
          {neural4dPrompt ? (
            <div className="mx-6 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-3 max-w-sm w-full">
              <span className="text-cyan-500 text-[9px] font-bold uppercase tracking-widest block mb-1.5">Grok Prompt Engineering</span>
              <p className="text-[10px] text-[#888] italic leading-relaxed line-clamp-3">"{neural4dPrompt}"</p>
            </div>
          ) : (
            <div className="flex gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
            </div>
          )}
        </div>
      )}
      
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing outline-none" tabIndex={0} />
      
      {!isGenerating && !neural4dModelUrl && (
        <div className="absolute bottom-4 right-4 pointer-events-none opacity-50 flex items-center gap-1.5 border border-[#3f3f3f] px-2 py-1 rounded bg-[#111]">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] text-white font-mono tracking-wider">PROCEDURAL MESH ACTIVE</span>
        </div>
      )}
      {!isGenerating && neural4dModelUrl && (
        <div className="absolute bottom-4 right-4 pointer-events-none flex items-center gap-1.5 border border-cyan-800 px-2 py-1 rounded bg-cyan-950">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
          <span className="text-[10px] text-cyan-400 font-bold tracking-wider">NEURAL4D MODEL LOADED</span>
        </div>
      )}

      {showLabels && nodePositions.length > 0 && (
        <div className="absolute inset-0 pointer-events-none w-full h-full overflow-hidden z-20">
          <svg className="w-full h-full absolute inset-0 pointer-events-none">
            {nodePositions.map((pos) => {
              const active = pos.name === activeStructure;
              const x2 = pos.x + pos.dx;
              const y2 = pos.y + pos.dy;
              const xMid = pos.x + pos.dx * 0.45;
              return (
                <g key={pos.name} className="transition-all duration-300">
                  {/* Dotted HUD pointer line with Sci-Fi elbow */}
                  <path
                    d={`M ${pos.x} ${pos.y} L ${xMid} ${y2} L ${x2} ${y2}`}
                    stroke={active ? "#06b6d4" : "#4b5563"}
                    strokeWidth={active ? 2 : 1}
                    strokeDasharray={active ? "none" : "3,3"}
                    fill="none"
                    opacity={active ? 0.95 : 0.4}
                    className="transition-all duration-300"
                  />
                  {/* Interactive glowing anchor ring at the 3D node center */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={active ? 5 : 3}
                    fill={active ? "#06b6d4" : "#6b7280"}
                    opacity={active ? 1.0 : 0.5}
                    className="transition-all duration-300"
                  />
                  {active && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={10}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth={1}
                      opacity={0.6}
                      className="animate-ping"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive Floating HTML Label tags */}
          {nodePositions.map((pos) => {
            const active = pos.name === activeStructure;
            const x2 = pos.x + pos.dx;
            const y2 = pos.y + pos.dy;

            return (
              <button
                key={pos.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onStructureSelect?.(pos.name);
                }}
                style={{
                  left: `${x2}px`,
                  top: `${y2}px`,
                  transform: `translate(${pos.dx > 0 ? "0%" : "-100%"}, -50%)`,
                }}
                className={`absolute pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 shadow-lg ${
                  active
                    ? "bg-cyan-950/95 border-cyan-500 text-white scale-105 shadow-cyan-950/40"
                    : "bg-[#171717]/85 border-[#2f2f2f] text-[#b4b4b4] hover:text-white hover:border-[#4f4f4f]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-cyan-400 animate-pulse" : "bg-neutral-600"}`} />
                <span className="truncate">{pos.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
