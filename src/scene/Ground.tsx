// The cricket ground. Eleven fielders, two batters, a bowler and an umpire on
// a real-sized oval, playing back the deliveries the engine simulated.
//
// Everything is primitives, like the auction hall — no downloaded assets.

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BOUNDARY_RADIUS, FIELD_SETTING, PITCH_HALF, positionOf } from "../engine/field";
import type { BallEvent } from "../engine/match";

const damp = THREE.MathUtils.damp;

/** One low-poly cricketer. */
function Figure({
  color, skin = "#d9a271", scale = 1,
}: { color: string; skin?: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.62, 5, 10]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.9, 8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.22, 14, 14]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** A fielder who drifts toward the ball when it comes their way. */
function Fielder({
  index, color, ballTarget, active,
}: { index: number; color: string; ballTarget: [number, number] | null; active: boolean }) {
  const ref = useRef<THREE.Group>(null!);
  const home = useMemo(() => positionOf(FIELD_SETTING[index]), [index]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + index;
    const [hx, hz] = home;
    const [tx, tz] = active && ballTarget ? ballTarget : home;
    ref.current.position.x = damp(ref.current.position.x, tx, active ? 2.4 : 1.2, delta);
    ref.current.position.z = damp(ref.current.position.z, tz, active ? 2.4 : 1.2, delta);
    // idle shuffle so the field never looks like a diagram
    ref.current.position.y = Math.abs(Math.sin(t * 1.6)) * 0.05;
    ref.current.rotation.y = Math.atan2(-ref.current.position.x, PITCH_HALF - ref.current.position.z);
    void hx; void hz;
  });

  return (
    <group ref={ref} position={[home[0], 0, home[1]]}>
      <Figure color={color} scale={1.35} />
    </group>
  );
}

/** The ball: flies along the shot, arcing when the shot was aerial. */
function Ball({ ball, phase }: { ball: BallEvent | null; phase: number }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!ball) return;
    const { shot } = ball;
    const rad = (shot.angle * Math.PI) / 180;

    if (phase < 0.4) {
      // Delivery: bowler's end to the striker.
      const k = phase / 0.4;
      ref.current.position.set(0, 1.6 - k * 0.9 + Math.sin(k * Math.PI) * 0.35, -PITCH_HALF + k * (PITCH_HALF * 2));
      return;
    }
    // The shot.
    const k = Math.min(1, (phase - 0.4) / 0.6);
    const dist = shot.distance * k;
    ref.current.position.set(
      Math.sin(rad) * dist,
      shot.aerial ? Math.sin(k * Math.PI) * (shot.distance / 7) + 0.3 : 0.3,
      PITCH_HALF - Math.cos(rad) * dist,
    );
  });

  return (
    <mesh ref={ref} position={[0, 0.3, 0]}>
      <sphereGeometry args={[0.36, 12, 12]} />
      <meshStandardMaterial color="#b91c1c" roughness={0.5} />
    </mesh>
  );
}

/** Bowler: runs in, delivers, follows through. */
function Bowler({ color, phase }: { color: string; phase: number }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    // Run-up from deep, release at the crease, follow through past it.
    const z = phase < 0.4
      ? -PITCH_HALF - 14 + (phase / 0.4) * 14
      : -PITCH_HALF + (phase - 0.4) * 6;
    ref.current.position.z = z;
    ref.current.rotation.z = phase > 0.3 && phase < 0.5 ? -0.5 : 0;
  });
  return (
    <group ref={ref} position={[0.8, 0, -PITCH_HALF - 14]}>
      <Figure color={color} />
    </group>
  );
}

/** Striker: plays the shot as the ball arrives. */
function Striker({ color, phase, ball }: { color: string; phase: number; ball: BallEvent | null }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    const swinging = phase > 0.36 && phase < 0.62;
    const target = swinging ? (ball?.shot.aerial ? -1.1 : -0.6) : 0;
    ref.current.rotation.x = damp(ref.current.rotation.x, target, 12, delta);
    // Turn into the shot.
    const rad = ball ? (ball.shot.angle * Math.PI) / 180 : 0;
    ref.current.rotation.y = damp(ref.current.rotation.y, swinging ? rad * 0.4 : 0, 8, delta);
  });
  return (
    <group ref={ref} position={[0.7, 0, PITCH_HALF]}>
      <Figure color={color} />
      {/* bat */}
      <mesh position={[0.42, 0.9, 0.1]} rotation={[0.3, 0, -0.4]}>
        <boxGeometry args={[0.16, 0.9, 0.06]} />
        <meshStandardMaterial color="#e8d5a8" />
      </mesh>
    </group>
  );
}

function Stumps({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      {[-0.11, 0, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.71, 6]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
    </group>
  );
}

function Scene({
  ball, phase, battingColor, bowlingColor,
}: { ball: BallEvent | null; phase: number; battingColor: string; bowlingColor: string }) {
  const activeFielder = ball?.shot.fielder ?? null;
  const target: [number, number] | null = ball
    ? [
        Math.sin((ball.shot.angle * Math.PI) / 180) * ball.shot.distance,
        PITCH_HALF - Math.cos((ball.shot.angle * Math.PI) / 180) * ball.shot.distance,
      ]
    : null;

  return (
    <>
      <fog attach="fog" args={["#0a1628", 90, 190]} />
      <hemisphereLight args={["#cbd5e1", "#1e3a2f", 1.5]} />
      <directionalLight position={[30, 60, 20]} intensity={2.2} color="#fff7e0" />
      <ambientLight intensity={0.45} />

      {/* outfield, inner ring and the square */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[BOUNDARY_RADIUS + 6, 64]} />
        <meshStandardMaterial color="#1f5c34" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[BOUNDARY_RADIUS - 0.7, BOUNDARY_RADIUS, 64]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[29.5, 30, 64]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={[3.05, 20.12]} />
        <meshStandardMaterial color="#c8b48a" roughness={1} />
      </mesh>

      <Stumps z={PITCH_HALF} />
      <Stumps z={-PITCH_HALF} />

      {/* the eleven */}
      {FIELD_SETTING.map((_, i) => (
        <Fielder
          key={i}
          index={i}
          color={bowlingColor}
          ballTarget={target}
          active={i === activeFielder && phase > 0.5}
        />
      ))}

      <Bowler color={bowlingColor} phase={phase} />
      <Striker color={battingColor} phase={phase} ball={ball} />
      {/* non-striker + umpire at the bowler's end */}
      <group position={[-1.4, 0, -PITCH_HALF]}>
        <Figure color={battingColor} />
      </group>
      <group position={[2.6, 0, -PITCH_HALF - 1.5]}>
        <Figure color="#0f172a" skin="#c98f52" scale={1.02} />
      </group>

      <Ball ball={ball} phase={phase} />

      {/* stands: a continuous banked ring, so the ground reads as enclosed */}
      <mesh position={[0, 5, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[BOUNDARY_RADIUS + 22, BOUNDARY_RADIUS + 9, 12, 64, 1, true]} />
        <meshStandardMaterial color="#16233d" roughness={0.95} side={THREE.BackSide} />
      </mesh>
      {/* a band of spectators around the front row */}
      {Array.from({ length: 120 }, (_, i) => {
        const a = (i / 120) * Math.PI * 2;
        const r = BOUNDARY_RADIUS + 10 + (i % 3) * 2.4;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 3.4 + (i % 3) * 1.1, Math.cos(a) * r]}>
            <capsuleGeometry args={[0.5, 0.9, 3, 6]} />
            <meshStandardMaterial color={["#334155", "#3f4a63", "#2b3a55"][i % 3]} roughness={1} />
          </mesh>
        );
      })}
      {/* floodlight glow so the ground doesn't sit in a void */}
      {[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => (
        <pointLight
          key={i}
          position={[sx * (BOUNDARY_RADIUS + 6), 34, sz * (BOUNDARY_RADIUS + 6)]}
          intensity={900}
          distance={220}
          color="#fff8e7"
        />
      ))}
    </>
  );
}

function CameraRig({ phase, ball }: { phase: number; ball: BallEvent | null }) {
  useFrame((state, delta) => {
    const cam = state.camera;
    const big = ball ? ball.shot.distance > 45 : false;
    // High behind the bowler's arm: the whole field has to be legible, which
    // a ground-level camera at 68m simply cannot deliver. Drops and tightens
    // for the delivery, lifts and widens to follow a big shot.
    const targetZ = phase < 0.45 ? -PITCH_HALF - 40 : big ? -PITCH_HALF - 62 : -PITCH_HALF - 48;
    const targetY = phase < 0.45 ? 22 : big ? 46 : 30;
    cam.position.z = damp(cam.position.z, targetZ, 2.2, delta);
    cam.position.y = damp(cam.position.y, targetY, 2.2, delta);
    cam.position.x = damp(cam.position.x, 0, 2, delta);
    cam.lookAt(0, 0, big ? 4 : PITCH_HALF - 2);
  });
  return null;
}

export default function Ground({
  ball, phase, battingColor, bowlingColor,
}: {
  ball: BallEvent | null;
  phase: number;
  battingColor: string;
  bowlingColor: string;
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 22, -PITCH_HALF - 40], fov: 46 }}
    >
      <color attach="background" args={["#0a1628"]} />
      <Scene ball={ball} phase={phase} battingColor={battingColor} bowlingColor={bowlingColor} />
      <CameraRig phase={phase} ball={ball} />
    </Canvas>
  );
}
