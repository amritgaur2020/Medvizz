"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeDModelProps {
  type: "heart" | "brain" | "lungs" | "kidneys";
  pulse?: boolean;
  showLabels?: boolean;
  activeStructure?: string;
  onStructureSelect?: (structure: string) => void;
  isGenerating?: boolean;
  neural4dPrompt?: string | null;
  neural4dModelUrl?: string | null;
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
  "Renal Pelvis": { dx: 18, dy: -5 }
};

export function ThreeDModel({
  type,
  pulse = true,
  showLabels = true,
  activeStructure = "",
  onStructureSelect,
  isGenerating = false,
  neural4dPrompt = null,
  neural4dModelUrl = null
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

    // Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x06b6d4, 2.5, 50); // cyan/teal light
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 50);
    pointLight2.position.set(-5, -5, -5);
    scene.add(pointLight2);

    const group = new THREE.Group();
    scene.add(group);

    let mainMesh: THREE.Object3D;
    let particles: THREE.Points;

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

    if (type === "heart") {
      mainMesh = new THREE.Group();
      
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

      group.add(mainMesh);
      particles = createParticles(100, 2.4, 0xef4444);
      mainMesh.add(particles);

    } else if (type === "brain") {
      mainMesh = new THREE.Group();
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

      group.add(mainMesh);
      particles = createParticles(120, 2.6, 0xffffff);
      mainMesh.add(particles);

    } else if (type === "lungs") {
      mainMesh = new THREE.Group();
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

      group.add(mainMesh);
      particles = createParticles(100, 2.6, 0x06b6d4);
      mainMesh.add(particles);

    } else if (type === "kidneys") {
      mainMesh = new THREE.Group();
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

      group.add(mainMesh);
      particles = createParticles(90, 2.4, 0x8b5cf6);
      mainMesh.add(particles);
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

      const activePositions = nodePositionsMap[type];
      const positionsArray: Array<{ name: string; x: number; y: number; dx: number; dy: number }> = [];
      Object.entries(activePositions).forEach(([name, localPos]) => {
        const tempV = new THREE.Vector3().copy(localPos).applyMatrix4(group.matrixWorld).project(camera);
        const x = (tempV.x * 0.5 + 0.5) * mount.clientWidth;
        const y = (-(tempV.y * 0.5) + 0.5) * mount.clientHeight;
        const offset = labelOffsets[name] || { dx: 15, dy: 10 };
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
      {isGenerating && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#171717]/80 backdrop-blur-md rounded-xl overflow-hidden border border-cyan-900/50">
          <div className="relative w-48 h-48 mb-6">
            <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full animate-spin-slow"></div>
            <div className="absolute inset-0 border-t-4 border-cyan-400 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-cyan-400 font-bold tracking-widest text-sm animate-pulse">Neural4D</span>
            </div>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Generating 3D Anatomy...</h3>
          <div className="max-w-md w-full px-6 text-center">
            <p className="text-xs text-[#8e8e8e] mb-3 uppercase tracking-widest font-mono">Real-Time Text-to-3D Synthesis</p>
            {neural4dPrompt ? (
              <div className="bg-[#111] border border-[#2f2f2f] rounded p-3 text-left">
                <span className="text-cyan-500 text-[10px] font-bold block mb-1">AI PROMPT ENGINERING:</span>
                <p className="text-[11px] text-[#b4b4b4] italic leading-relaxed">"{neural4dPrompt}"</p>
              </div>
            ) : (
              <div className="h-12 flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
          </div>
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
          <span className="text-[10px] text-cyan-400 font-bold tracking-wider">NEURAL4D ASSET LOADED</span>
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
