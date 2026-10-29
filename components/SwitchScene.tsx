'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export type SceneHandle = {
    press: (down: boolean) => void;
};
const clamp = THREE.MathUtils.clamp;
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const SwitchScene = forwardRef<SceneHandle, {
    blueprint: boolean;
}>(function SwitchScene({ blueprint }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const pressing = useRef(false);
    const wire = useRef(blueprint);
    wire.current = blueprint;
    const [failed, setFailed] = useState(false);
    useImperativeHandle(ref, () => ({ press: down => { pressing.current = down; } }), []);
    useEffect(() => {
        if (!canvas.current)
            return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas: canvas.current, alpha: true, antialias: true, powerPreference: 'high-performance' });
        }
        catch {
            setFailed(true);
            return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
        camera.position.set(0, 1.3, 14);
        camera.lookAt(0, 0, 0);
        const pmrem = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        const env = pmrem.fromScene(room, .04);
        scene.environment = env.texture;
        room.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8b6a4b, 1.5));
        const key = new THREE.DirectionalLight(0xfff7ea, 2.5);
        key.position.set(-4, 8, 6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffffff, 1.5);
        rim.position.set(5, 2, -3);
        scene.add(rim);
        const root = new THREE.Group();
        scene.add(root);
        const orange = new THREE.MeshPhysicalMaterial({ color: 0xf15b22, roughness: .27, metalness: .05, clearcoat: .5 });
        const dark = new THREE.MeshPhysicalMaterial({ color: 0x333735, roughness: .3, metalness: .2 });
        const plastic = new THREE.MeshPhysicalMaterial({ color: 0xc5cec3, roughness: .18, metalness: .05, transparent: true, opacity: .63, depthWrite: false, clearcoat: 1 });
        const gold = new THREE.MeshStandardMaterial({ color: 0xc6a267, metalness: .85, roughness: .23 });
        const steel = new THREE.MeshStandardMaterial({ color: 0xd4d4ce, metalness: 1, roughness: .24 });
        const groups = Array.from({ length: 6 }, () => new THREE.Group());
        groups.forEach(g => root.add(g));
        const mesh = (g: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, r = .06) => { const obj = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); obj.position.set(x, y, z); g.add(obj); return obj; };
        // Hollow keycap with a tapered outer shell and an open underside.
        const shape = new THREE.Shape();
        shape.moveTo(-1, -1);
        shape.lineTo(1, -1);
        shape.lineTo(1, 1);
        shape.lineTo(-1, 1);
        shape.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-.85, -.85);
        hole.lineTo(-.85, .85);
        hole.lineTo(.85, .85);
        hole.lineTo(.85, -.85);
        hole.closePath();
        shape.holes.push(hole);
        const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .5, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .08, bevelThickness: .06 }), orange);
        shell.rotation.x = Math.PI / 2;
        shell.position.y = 1.5;
        groups[0].add(shell);
        mesh(groups[0], 0, 1.57, 0, 1.85, .22, 1.85, orange, .12);
        // A small printed legend is generated locally, with no image asset.
        const label = document.createElement('canvas');
        label.width = 256;
        label.height = 256;
        const ctx = label.getContext('2d');
        let texture: THREE.CanvasTexture | undefined;
        if (ctx) {
            ctx.fillStyle = '#fff0d6';
            ctx.font = 'bold 76px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('P', 128, 151);
            texture = new THREE.CanvasTexture(label);
            const decal = new THREE.Mesh(new THREE.PlaneGeometry(.7, .7), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
            decal.rotation.x = -Math.PI / 2;
            decal.position.set(0, 1.69, 0);
            groups[0].add(decal);
        }
        // Four rails leave the cross stem and spring visible when separated.
        for (const z of [-.73, .73])
            mesh(groups[1], 0, .64, z, 1.65, .55, .18, plastic);
        for (const x of [-.73, .73]) {
            mesh(groups[1], x, .64, 0, .18, .55, 1.4, plastic);
            mesh(groups[1], x, .46, .2, .22, .22, .38, dark);
        }
        mesh(groups[2], 0, .57, 0, .44, .9, .44, orange);
        mesh(groups[2], 0, 1.02, 0, .75, .16, .24, orange);
        mesh(groups[2], 0, 1.02, 0, .24, .16, .75, orange);
        mesh(groups[2], 0, .23, 0, .9, .18, .7, orange);
        const coil: THREE.Vector3[] = [];
        for (let i = 0; i <= 320; i++) {
            const a = i / 320 * Math.PI * 18;
            coil.push(new THREE.Vector3(Math.cos(a) * .26, -.51 + i / 320 * .74, Math.sin(a) * .26));
        }
        groups[3].add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 320, .035, 7, false), steel));
        mesh(groups[4], .49, -.25, 0, .07, .66, .36, gold);
        mesh(groups[4], .35, -.07, 0, .3, .065, .3, gold);
        mesh(groups[4], -.49, -.3, 0, .08, .6, .3, gold);
        mesh(groups[5], 0, -.7, 0, 1.7, .28, 1.7, dark);
        for (const z of [-.72, .72])
            mesh(groups[5], 0, -.48, z, 1.7, .3, .18, dark);
        for (const x of [-.72, .72])
            mesh(groups[5], x, -.48, 0, .18, .3, 1.3, dark);
        for (const x of [-.5, .5])
            mesh(groups[5], x, -1.04, 0, .09, .5, .16, gold);
        mesh(groups[5], 0, -.99, 0, .28, .38, .28, dark);
        const wireMaterial = new THREE.LineBasicMaterial({ color: 0xe56836, transparent: true, opacity: .8 });
        const edges: THREE.LineSegments[] = [];
        root.traverse(obj => { if (obj instanceof THREE.Mesh) {
            const line = new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry, 28), wireMaterial);
            line.visible = false;
            obj.add(line);
            edges.push(line);
        } });
        const pointer = new THREE.Vector2();
        let scroll = window.scrollY;
        let height = innerHeight;
        let width = innerWidth;
        let disposed = false;
        let frame = 0;
        let depression = 0;
        let progress = 0;
        let lastWire = false;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const resize = () => { width = innerWidth; height = innerHeight; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
        resize();
        const onScroll = () => { scroll = window.scrollY; };
        const onPointer = (e: PointerEvent) => { pointer.set(e.clientX / width * 2 - 1, e.clientY / height * 2 - 1); };
        const leave = () => pointer.set(0, 0);
        const lost = (e: Event) => { e.preventDefault(); setFailed(true); };
        canvas.current.addEventListener('webglcontextlost', lost);
        window.addEventListener('resize', resize);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pointermove', onPointer, { passive: true });
        window.addEventListener('blur', leave);
        let previous = performance.now();
        const draw = (now: number) => {
            if (disposed)
                return;
            frame = requestAnimationFrame(draw);
            const dt = Math.min((now - previous) / 1000, .05);
            previous = now;
            const ease = 1 - Math.exp(-dt * 9);
            progress = THREE.MathUtils.lerp(progress, clamp(scroll / (document.getElementById('feel')?.offsetHeight || height), 0, 4), reduced.matches ? 1 : ease);
            depression = THREE.MathUtils.lerp(depression, pressing.current ? 1 : 0, 1 - Math.exp(-dt * 24));
            const explode = smooth((progress - 1.05) / .9) * (1 - smooth((progress - 3.05) / .85));
            const offsets = [2.15, 1.05, .3, -.35, -1, -1.35];
            groups.forEach((g, i) => { const stagger = smooth((explode - (5 - i) * .025) / .875); g.position.y = offsets[i] * stagger - (i === 0 || i === 2 ? depression * .26 : 0); });
            groups[3].scale.y = 1 - depression * .2;
            const mobile = width < 760;
            const specs = smooth((progress - 2.3) / .7) * (1 - smooth((progress - 3.05) / .8));
            const close = Math.sin(clamp(progress, 0, 2) / 2 * Math.PI);
            const scale = (mobile ? .9 : 1.55) * (1 + close * .23) * (1 - explode * (mobile ? .47 : .45)) * (mobile ? 1 - specs * .4 : 1);
            root.scale.setScalar(scale);
            root.position.set(mobile ? 0 : 1.65, mobile ? -2.1 - specs * .8 : -.2, 0);
            root.rotation.x = .39 + (reduced.matches ? 0 : pointer.y * .07);
            root.rotation.y = -.52 + progress * .22 + (reduced.matches ? 0 : pointer.x * .16);
            root.rotation.z = -.12 + explode * .1;
            scene.environmentRotation.y = pointer.x * .2;
            if (lastWire !== wire.current) {
                lastWire = wire.current;
                edges.forEach(e => e.visible = lastWire);
                root.traverse(o => { if (o instanceof THREE.Mesh) {
                    const m = o.material as THREE.Material;
                    m.visible = !lastWire;
                } });
            }
            renderer.render(scene, camera);
        };
        frame = requestAnimationFrame(draw);
        return () => { disposed = true; cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onPointer); window.removeEventListener('blur', leave); canvas.current?.removeEventListener('webglcontextlost', lost); root.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments)
            o.geometry.dispose(); }); [orange, dark, plastic, gold, steel, wireMaterial].forEach(m => m.dispose()); texture?.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose(); };
    }, []);
    return <><canvas ref={canvas} className="scene" aria-label="주황색 기계식 키보드 스위치의 실시간 3D 모델" role="img"/>{failed && <div className="fallback"><div className="fallback-key">P</div><p>3D를 표시할 수 없는 환경입니다.<br />아래에서 스위치의 구조와 사양을 살펴보세요.</p></div>}</>;
});
export default SwitchScene;
