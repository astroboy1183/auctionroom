// The 3D auction hall — v1 (CLAUDE.md Phase 5). Everything is built from
// primitives: no GLB assets, no font fetches, nothing external (D-013).
// The scene is a stage, not a UI: it reads store state each frame and
// never dispatches. All interactive UI stays DOM, overlaid on top.

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";

// ---------------------------------------------------------------- helpers

const damp = THREE.MathUtils.damp;

/** Live game facts the animations care about, read imperatively per frame. */
function gameFacts() {
  const { auction, humanId } = useGameStore.getState();
  return {
    phase: auction.phase,
    timer: auction.timer,
    bid: auction.currentBid,
    bidderId: auction.currentBidderId,
    franchises: auction.franchises,
    humanId,
  };
}

// ------------------------------------------------------------- auctioneer

/** A low-poly auctioneer at the podium: idle sway, arm raised while a bid
 * leads, and a gavel slam the moment a lot sells. */
function Auctioneer() {
  const arm = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const slam = useRef(0); // 0..1 progress of the current slam
  const prevPhase = useRef<string>("bidding");

  useFrame((state, delta) => {
    const { phase, bid } = gameFacts();
    const t = state.clock.elapsedTime;
    // breathe
    body.current.position.y = 2.3 + Math.sin(t * 1.6) * 0.03;
    body.current.rotation.y = Math.sin(t * 0.4) * 0.12;

    if (phase === "sold" && prevPhase.current !== "sold") slam.current = 1;
    prevPhase.current = phase;

    let target = -0.35; // arm rest
    if (slam.current > 0) {
      // fast whip down, then recover
      slam.current = Math.max(0, slam.current - delta * 2.2);
      const k = slam.current;
      target = k > 0.55 ? -2.4 : -0.35 - k * 1.2;
    } else if (phase === "bidding" && bid !== null) {
      target = 0.9 + Math.sin(t * 2.4) * 0.1; // gavel up while a bid leads
    }
    arm.current.rotation.z = damp(arm.current.rotation.z, target, 12, delta);
  });

  return (
    <group position={[0, 0, -3.2]} scale={1.35}>
      {/* podium — stands in front, hiding where the body meets the floor */}
      <mesh position={[0, 1.0, 0.72]}>
        <boxGeometry args={[1.75, 2.0, 0.95]} />
        <meshStandardMaterial color="#4a3826" roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.03, 0.72]}>
        <boxGeometry args={[1.95, 0.1, 1.1]} />
        <meshStandardMaterial color="#6b4f33" roughness={0.4} />
      </mesh>
      {/* lower body, so nothing floats */}
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.34, 0.42, 1.7, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      <group ref={body} position={[0, 2.3, 0]}>
        {/* torso */}
        <mesh>
          <capsuleGeometry args={[0.34, 0.7, 6, 12]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
        </mesh>
        {/* head */}
        <mesh position={[0, 0.85, 0]}>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial color="#d4a373" roughness={0.8} />
        </mesh>
        {/* left arm resting on podium */}
        <mesh position={[-0.42, 0.05, 0.25]} rotation={[0.4, 0, -0.5]}>
          <capsuleGeometry args={[0.09, 0.55, 4, 8]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
        </mesh>
        {/* right arm + gavel */}
        <group ref={arm} position={[0.4, 0.3, 0]}>
          <mesh position={[0.3, 0, 0]} rotation={[0, 0, -1.57]}>
            <capsuleGeometry args={[0.09, 0.55, 4, 8]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
          </mesh>
          <group position={[0.68, 0.05, 0]}>
            <mesh rotation={[1.57, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.45]} />
              <meshStandardMaterial color="#8b5a2b" />
            </mesh>
            <mesh position={[0, 0, -0.22]} rotation={[0, 0, 1.57]}>
              <cylinderGeometry args={[0.11, 0.11, 0.3]} />
              <meshStandardMaterial color="#5c3a1e" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- tables

/** One franchise table with a paddle that raises while that team leads. */
function Table({ index, count }: { index: number; count: number }) {
  const paddle = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.MeshStandardMaterial>(null!);
  // Arc between stage and camera, every table facing the podium.
  const angle = ((index + 0.5) / count - 0.5) * Math.PI * 0.61;
  const radius = 5.5;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius - 2.5;

  useFrame((_, delta) => {
    const { franchises, bidderId } = gameFacts();
    const f = franchises[index];
    if (!f) return;
    const leading = bidderId === f.id;
    paddle.current.position.y = damp(paddle.current.position.y, leading ? 1.75 : 0.65, 10, delta);
    paddle.current.rotation.z = damp(paddle.current.rotation.z, leading ? 0 : 1.35, 10, delta);
    if (glow.current) {
      glow.current.emissiveIntensity = damp(glow.current.emissiveIntensity, leading ? 2.2 : 0.35, 8, delta);
      if (glow.current.color.getStyle() !== f.color) {
        glow.current.color.set(f.color);
        glow.current.emissive.set(f.color);
      }
    }
  });

  return (
    <group position={[x, 0, z]} rotation={[0, -angle + Math.PI, 0]}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.7, 0.12, 0.85]} />
        <meshStandardMaterial color="#33415c" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[1.5, 0.72, 0.7]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      {/* team-colour strip */}
      <mesh position={[0, 0.84, 0.36]}>
        <boxGeometry args={[1.7, 0.06, 0.06]} />
        <meshStandardMaterial ref={glow} emissiveIntensity={0.35} />
      </mesh>
      {/* paddle */}
      <group ref={paddle} position={[0.55, 1.05, 0.1]}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.45]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0, 0.55, 0]} rotation={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.04, 20]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      </group>
    </group>
  );
}

// ----------------------------------------------------------------- crowd

/** Bobbing silhouette crowd on risers; excitement follows the timer. */
function Crowd() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const N = 180;
  const seats = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / 36);
      const col = i % 36;
      const angle = ((col + 0.5) / 36 - 0.5) * Math.PI * 1.15;
      const radius = 9.4 + row * 1.4;
      out.push([
        Math.sin(angle) * radius,
        0.55 + row * 0.42,
        Math.cos(angle) * radius - 3,
        Math.random() * Math.PI * 2, // bob phase
      ]);
    }
    return out;
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const { phase, timer, bid } = gameFacts();
    const t = state.clock.elapsedTime;
    const excited = phase === "bidding" && bid !== null && timer <= 3 ? 0.16 : 0.05;
    for (let i = 0; i < N; i++) {
      const [x, y, z, ph] = seats[i];
      dummy.position.set(x, y + Math.sin(t * 2.1 + ph) * excited, z);
      dummy.rotation.y = -Math.atan2(x, z + 3);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]}>
      <capsuleGeometry args={[0.22, 0.5, 4, 8]} />
      <meshStandardMaterial color="#1e2a45" roughness={1} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- camera

function CameraRig() {
  useFrame((state, delta) => {
    const { phase, timer, bid } = gameFacts();
    const t = state.clock.elapsedTime;
    const closing = phase === "bidding" && bid !== null && timer <= 3;
    const sold = phase === "sold";
    const targetZ = sold ? 6.8 : closing ? 8.2 : 10;
    const targetY = sold ? 3.4 : closing ? 3.7 : 4.1;
    const cam = state.camera;
    cam.position.z = damp(cam.position.z, targetZ, 2.2, delta);
    cam.position.y = damp(cam.position.y, targetY, 2.2, delta);
    cam.position.x = damp(cam.position.x, Math.sin(t * 0.11) * 1.3, 1.5, delta);
    cam.lookAt(0, 2.5, -3.4);
  });
  return null;
}

// ------------------------------------------------------------------ hall

function Scene() {
  return (
    <>
      <fog attach="fog" args={["#050b1c", 18, 46]} />
      <hemisphereLight args={["#64748b", "#0b1120", 1.5]} />
      <ambientLight intensity={0.5} />
      <spotLight position={[0, 10, 3]} angle={0.62} penumbra={0.5} intensity={420} color="#fde68a" />
      <pointLight position={[-7, 5, 5]} intensity={110} color="#38bdf8" />
      <pointLight position={[7, 5, 5]} intensity={110} color="#f472b6" />
      <pointLight position={[0, 4, -6]} intensity={90} color="#a78bfa" />

      {/* floor + stage */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color="#16203a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.25, -3]}>
        <cylinderGeometry args={[4.6, 4.9, 0.5, 40]} />
        <meshStandardMaterial color="#25314f" roughness={0.45} />
      </mesh>
      {/* backdrop: dark screen in a lit frame */}
      <mesh position={[0, 4.2, -7.5]}>
        <planeGeometry args={[13, 5.6]} />
        <meshStandardMaterial color="#0a1226" emissive="#1e3a8a" emissiveIntensity={0.16} roughness={0.9} />
      </mesh>
      {[-2.85, 2.85].map((y) => (
        <mesh key={y} position={[0, 4.2 + y, -7.45]}>
          <boxGeometry args={[13.4, 0.12, 0.12]} />
          <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {[-6.6, 6.6].map((x) => (
        <mesh key={x} position={[x, 4.2, -7.45]}>
          <boxGeometry args={[0.12, 5.8, 0.12]} />
          <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={1.2} />
        </mesh>
      ))}
      {/* stage lip glow */}
      <mesh position={[0, 0.52, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.55, 4.85, 44]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} />
      </mesh>

      {/* volumetric-ish spotlight cone over the podium */}
      <mesh position={[0, 5.4, -3.2]}>
        <coneGeometry args={[2.4, 6.2, 28, 1, true]} />
        <meshBasicMaterial
          color="#fde68a" transparent opacity={0.055} side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>

      <Auctioneer />
      {Array.from({ length: 8 }, (_, i) => (
        <Table key={i} index={i} count={8} />
      ))}
      <Crowd />
      <CameraRig />
    </>
  );
}

export default function Hall() {
  return (
    <div className="fixed inset-0 -z-10" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 4.1, 10], fov: 54 }}
      >
        <color attach="background" args={["#020617"]} />
        <Scene />
      </Canvas>
    </div>
  );
}
