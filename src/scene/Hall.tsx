// The 3D auction hall — v1 (CLAUDE.md Phase 5). Everything is built from
// primitives: no GLB assets, no font fetches, nothing external (D-013).
// The scene is a stage, not a UI: it reads store state each frame and
// never dispatches. All interactive UI stays DOM, overlaid on top.

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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

// ------------------------------------------------------------- jumbotron

/** The big screen behind the podium. Drawn with the 2D canvas API and used
 * as a texture — live player details, the standing bid, and the leader, with
 * no font files or external assets involved. */
function Jumbotron() {
  const player = useGameStore((s) => s.auction.currentPlayer);
  const bid = useGameStore((s) => s.auction.currentBid);
  const bidderId = useGameStore((s) => s.auction.currentBidderId);
  const franchises = useGameStore((s) => s.auction.franchises);
  const phase = useGameStore((s) => s.auction.phase);
  const sets = useGameStore((s) => s.auction.sets);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 560;
    return c;
  }, []);
  const texture = useMemo(() => {
    const tx = new THREE.CanvasTexture(canvas);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }, [canvas]);

  useEffect(() => {
    const g = canvas.getContext("2d");
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    const leader = franchises.find((f) => f.id === bidderId);
    const money = (l: number) =>
      l >= 100 ? `₹${Number.isInteger(l / 100) ? l / 100 : (l / 100).toFixed(2)} Cr` : `₹${l}L`;

    // backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b1a3a");
    bg.addColorStop(1, "#050b1c");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // scanline texture, so it reads as a screen
    g.fillStyle = "rgba(255,255,255,0.022)";
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);

    if (!player) {
      texture.needsUpdate = true;
      return;
    }

    if (phase === "sold" && leader) {
      g.fillStyle = "#fbbf24";
      g.font = "900 150px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("SOLD", W / 2, 210);
      g.fillStyle = "#f8fafc";
      g.font = "700 54px system-ui, sans-serif";
      g.fillText(player.name, W / 2, 296);
      g.fillStyle = leader.color;
      g.font = "900 62px system-ui, sans-serif";
      g.fillText(leader.name.toUpperCase(), W / 2, 380);
      g.fillStyle = "#e2e8f0";
      g.font = "800 76px ui-monospace, monospace";
      g.fillText(money(bid ?? 0), W / 2, 468);
      texture.needsUpdate = true;
      return;
    }

    if (phase === "unsold") {
      g.fillStyle = "#64748b";
      g.font = "900 120px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("UNSOLD", W / 2, 260);
      g.fillStyle = "#94a3b8";
      g.font = "700 52px system-ui, sans-serif";
      g.fillText(player.name, W / 2, 350);
      texture.needsUpdate = true;
      return;
    }

    const setName = sets.find((s) => s.id === player.setId)?.name ?? "";
    g.textAlign = "left";

    // header strip
    g.fillStyle = "#1d4ed8";
    g.fillRect(0, 0, W, 62);
    g.fillStyle = "#dbeafe";
    g.font = "800 30px system-ui, sans-serif";
    g.fillText(`NOW ON THE BLOCK  ·  ${setName.toUpperCase()}`, 44, 42);

    // name (upper band — always above the auctioneer's head)
    g.fillStyle = "#f8fafc";
    const nameSize = player.name.length > 16 ? 66 : 82;
    g.font = `900 ${nameSize}px system-ui, sans-serif`;
    g.fillText(player.name.toUpperCase(), 44, 162);

    // role / overseas / stars
    const roleLabel = { BAT: "BATTER", BOWL: "BOWLER", AR: "ALL-ROUNDER", WK: "WICKETKEEPER" }[player.role];
    const roleColor = { BAT: "#f59e0b", BOWL: "#38bdf8", AR: "#34d399", WK: "#e879f9" }[player.role];
    g.fillStyle = roleColor;
    g.font = "800 36px system-ui, sans-serif";
    g.fillText(roleLabel, 44, 224);
    let x = 44 + g.measureText(roleLabel).width + 28;
    if (player.overseas) {
      g.fillStyle = "#a5b4fc";
      g.fillText("✈ OVERSEAS", x, 224);
      x += g.measureText("✈ OVERSEAS").width + 28;
    }
    const stars = Math.round(((player.rating - 60) / 40) * 5);
    g.fillStyle = "#fbbf24";
    g.fillText("★".repeat(stars) + "☆".repeat(5 - stars), x, 224);
    g.fillStyle = "#94a3b8";
    g.font = "700 30px ui-monospace, monospace";
    g.fillText(`${player.rating}`, x + g.measureText("★★★★★").width + 16, 222);

    // tags
    g.font = "600 28px system-ui, sans-serif";
    let tx = 44;
    for (const tag of player.tags.slice(0, 4)) {
      const w = g.measureText(tag).width + 26;
      g.fillStyle = "rgba(255,255,255,0.09)";
      g.fillRect(tx, 248, w, 44);
      g.fillStyle = "#cbd5e1";
      g.fillText(tag, tx + 13, 279);
      tx += w + 12;
    }

    // Money lives in the RIGHT column — the auctioneer stands in front of the
    // lower-centre of this board, so nothing readable goes there.
    const R = W - 44;
    g.textAlign = "right";
    g.fillStyle = "#64748b";
    g.font = "800 26px system-ui, sans-serif";
    g.fillText(leader ? "LEADING BID" : "BASE PRICE", R, 366);
    g.fillStyle = "#f8fafc";
    g.font = "900 96px ui-monospace, monospace";
    g.fillText(money(bid ?? player.basePrice), R, 456);

    if (leader) {
      g.fillStyle = leader.color;
      g.font = "900 40px system-ui, sans-serif";
      g.fillText(leader.name.toUpperCase(), R, 510);
      const w = g.measureText(leader.name.toUpperCase()).width;
      g.fillRect(R - w, 524, w, 6);
    } else {
      g.fillStyle = "#475569";
      g.font = "700 34px system-ui, sans-serif";
      g.fillText("awaiting opening bid…", R, 510);
    }
    g.textAlign = "left";

    texture.needsUpdate = true;
  }, [player, bid, bidderId, franchises, phase, sets, canvas, texture]);

  return (
    <mesh position={[0, 4.55, -7.44]}>
      <planeGeometry args={[13, 5.6]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------- tables

/** Two bidders seated at a bench: idle sway, and they lean in and turn to
 * each other when their franchise is the one leading. */
function Bidders({ index, color }: { index: number; color: string }) {
  const pair = useRef<THREE.Group>(null!);
  const seats = useMemo(
    () => [
      { x: -0.42, phase: index * 1.7, scale: 1 },
      { x: 0.44, phase: index * 1.7 + 2.3, scale: 0.94 },
    ],
    [index],
  );

  useFrame((state, delta) => {
    const { bidderId, franchises } = gameFacts();
    const leading = franchises[index] && bidderId === franchises[index].id;
    const t = state.clock.elapsedTime;
    pair.current.children.forEach((seat, i) => {
      const s = seats[i];
      seat.position.y = 0.02 + Math.sin(t * 1.3 + s.phase) * 0.014;
      // lean toward the stage when in the hunt
      seat.rotation.x = damp(seat.rotation.x, leading ? -0.22 : 0, 6, delta);
      seat.rotation.y = damp(seat.rotation.y, leading ? (i === 0 ? 0.35 : -0.35) : 0, 6, delta);
    });
  });

  return (
    <group ref={pair} position={[0, 0, -0.62]}>
      {seats.map((s, i) => (
        <group key={i} position={[s.x, 0.02, 0]} scale={s.scale}>
          {/* seated torso */}
          <mesh position={[0, 0.66, 0]}>
            <capsuleGeometry args={[0.19, 0.34, 4, 10]} />
            <meshStandardMaterial color={i === 0 ? color : "#334155"} roughness={0.75} />
          </mesh>
          {/* legs under the table */}
          <mesh position={[0, 0.24, 0.16]} rotation={[1.15, 0, 0]}>
            <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.85} />
          </mesh>
          {/* head */}
          <mesh position={[0, 1.03, 0]}>
            <sphereGeometry args={[0.155, 16, 16]} />
            <meshStandardMaterial color={i === 0 ? "#e0b088" : "#c79068"} roughness={0.85} />
          </mesh>
          {/* arms resting on the bench */}
          <mesh position={[-0.19, 0.7, 0.2]} rotation={[1.2, 0, -0.25]}>
            <capsuleGeometry args={[0.055, 0.28, 4, 8]} />
            <meshStandardMaterial color={i === 0 ? color : "#334155"} roughness={0.75} />
          </mesh>
          <mesh position={[0.19, 0.7, 0.2]} rotation={[1.2, 0, 0.25]}>
            <capsuleGeometry args={[0.055, 0.28, 4, 8]} />
            <meshStandardMaterial color={i === 0 ? color : "#334155"} roughness={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** One franchise table with a paddle that raises while that team leads. */
function Table({ index, count }: { index: number; count: number }) {
  const paddle = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.MeshStandardMaterial>(null!);
  const color = useGameStore((s) => s.auction.franchises[index]?.color ?? "#64748b");
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
      <Bidders index={index} color={color} />

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
      {/* backdrop: live jumbotron in a lit frame */}
      <mesh position={[0, 4.55, -7.5]}>
        <planeGeometry args={[13.2, 5.8]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>
      <Jumbotron />
      {[-2.85, 2.85].map((y) => (
        <mesh key={y} position={[0, 4.55 + y, -7.45]}>
          <boxGeometry args={[13.4, 0.12, 0.12]} />
          <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {[-6.6, 6.6].map((x) => (
        <mesh key={x} position={[x, 4.55, -7.45]}>
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
