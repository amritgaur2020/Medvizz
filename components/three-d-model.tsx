"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeDModelProps {
  type: "heart" | "brain" | "lungs";
  pulse?: boolean;
}

export function ThreeDModel({ type, pulse = true }: ThreeDModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

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
    container.appendChild(renderer.domElement);

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
      
      // Heart Ventricles (Deformed wireframe sphere)
      const heartMat = new THREE.MeshPhongMaterial({
        color: 0xef4444, // vibrant clinical red
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

      // Aorta vascular arch
      const aortaMat = new THREE.MeshPhongMaterial({ color: 0x06b6d4, wireframe: true });
      const aortaGeo = new THREE.TorusGeometry(0.8, 0.22, 12, 32, Math.PI);
      const aorta = new THREE.Mesh(aortaGeo, aortaMat);
      aorta.position.set(0.3, 1.2, -0.2);
      aorta.rotation.z = -Math.PI / 6;
      mainMesh.add(aorta);

      group.add(mainMesh);

      // Blood flow particle sparkle
      particles = createParticles(100, 2.4, 0xef4444);
      mainMesh.add(particles);

    } else if (type === "brain") {
      mainMesh = new THREE.Group();
      
      const brainMat = new THREE.MeshPhongMaterial({
        color: 0x06b6d4, // glowing brain cyan
        emissive: 0x083344,
        wireframe: true,
        transparent: true,
        opacity: 0.85
      });

      // Left & Right Hemispheres
      const leftH = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 24), brainMat);
      leftH.scale.set(1.35, 1.05, 0.8);
      leftH.position.set(-0.55, 0.15, 0);
      mainMesh.add(leftH);

      const rightH = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 24), brainMat);
      rightH.scale.set(1.35, 1.05, 0.8);
      rightH.position.set(0.55, 0.15, 0);
      mainMesh.add(rightH);

      // Cerebellum / Brainstem
      const cbMat = new THREE.MeshPhongMaterial({ color: 0xffffff, wireframe: true, opacity: 0.5, transparent: true });
      const cerebellum = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), cbMat);
      cerebellum.position.set(0, -0.9, 0.65);
      cerebellum.scale.set(1.15, 0.65, 0.95);
      mainMesh.add(cerebellum);

      group.add(mainMesh);

      // Neural firing particles
      particles = createParticles(120, 2.6, 0xffffff);
      mainMesh.add(particles);

    } else {
      // Lungs
      mainMesh = new THREE.Group();
      
      const lungMat = new THREE.MeshPhongMaterial({
        color: 0x14b8a6, // beautiful soft teal
        emissive: 0x042f2e,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });

      // Left Lung Lobe
      const leftLung = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), lungMat);
      leftLung.scale.set(0.85, 1.75, 0.8);
      leftLung.position.set(-1.05, 0, 0);
      leftLung.rotation.z = Math.PI / 16;
      mainMesh.add(leftLung);

      // Right Lung Lobe
      const rightLung = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), lungMat);
      rightLung.scale.set(0.85, 1.75, 0.8);
      rightLung.position.set(1.05, 0, 0);
      rightLung.rotation.z = -Math.PI / 16;
      mainMesh.add(rightLung);

      // Trachea Conduit
      const tracheaMat = new THREE.MeshPhongMaterial({ color: 0xffffff, wireframe: true });
      const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.0, 12, 4, true), tracheaMat);
      trachea.position.set(0, 1.0, 0);
      mainMesh.add(trachea);

      group.add(mainMesh);

      // Oxygen particles
      particles = createParticles(100, 2.6, 0x06b6d4);
      mainMesh.add(particles);
    }

    // Drag to Rotate logic
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = () => {
      isDragging = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const deltaMove = {
        x: currentX - previousMousePosition.x,
        y: currentY - previousMousePosition.y
      };

      if (isDragging) {
        group.rotation.y += deltaMove.x * 0.007;
        group.rotation.x += deltaMove.y * 0.007;
      }

      previousMousePosition = {
        x: currentX,
        y: currentY
      };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(3.5, Math.min(15, camera.position.z + e.deltaY * 0.005));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", handleMouseDown);
    domElement.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    domElement.addEventListener("wheel", handleWheel);

    // Animation Loop
    let clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Idle Rotation
      if (!isDragging) {
        group.rotation.y += 0.0065;
      }

      // Breathing / Pulsing Effect
      if (pulse) {
        let pulseScale = 1.0;
        if (type === "heart") {
          // heartbeat double-beat pulse
          const pulseCycle = (elapsedTime * 1.5) % Math.PI;
          pulseScale = 1.0 + Math.sin(pulseCycle * 2) * 0.08 * Math.pow(Math.sin(pulseCycle), 2);
        } else if (type === "lungs") {
          // lung deep inhalation cycle
          pulseScale = 1.0 + Math.sin(elapsedTime * 1.25) * 0.06;
        } else {
          // brain slow pulsing
          pulseScale = 1.0 + Math.sin(elapsedTime * 1.0) * 0.03;
        }
        mainMesh.scale.set(pulseScale, pulseScale, pulseScale);
      }

      // Rotate particle systems
      if (particles) {
        particles.rotation.y -= 0.004;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      
      domElement.removeEventListener("mousedown", handleMouseDown);
      domElement.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      domElement.removeEventListener("wheel", handleWheel);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
    };
  }, [type, pulse]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[300px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
    />
  );
}
