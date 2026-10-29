"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import sequence from "../public/sequences/switch-vidu-v1/manifest.json";

export type SceneHandle = { press: (down: boolean) => void };
const FRAME_COUNT = 96;
const FRAME_WIDTH = 900;
const FRAME_HEIGHT = 1771;
const frameUrl = (index: number) =>
  `/works/press/sequences/switch-vidu-v1/frame-${String(index + 1).padStart(3, "0")}.webp`;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// 청록색 키캡을 별도 레이어로 분리해 누를 때 본체가 함께 움직이지 않도록 한다.
function splitRestingKeycap(image: ImageBitmap) {
  const body = document.createElement("canvas");
  body.width = image.width;
  body.height = image.height;
  const cap = document.createElement("canvas");
  cap.width = body.width;
  cap.height = body.height;
  const bodyCtx = body.getContext("2d");
  const capCtx = cap.getContext("2d");
  if (!bodyCtx || !capCtx) throw new Error("Canvas unavailable");
  bodyCtx.drawImage(image, 0, 0);
  const pixels = bodyCtx.getImageData(0, 0, body.width, body.height);
  const capPixels = capCtx.createImageData(body.width, body.height);
  const rows: Array<[number, number] | undefined> = [];
  for (let y = 0; y < body.height * 0.65; y++) {
    let first = body.width,
      last = -1;
    for (let x = 0; x < body.width; x++) {
      const i = (y * body.width + x) * 4;
      const [r, g, b] = pixels.data.subarray(i, i + 3);
      // 이 색상 기준은 현재 청록색 키캡 에셋에 맞춰져 있다.
      if (g - r > 8 && b - r > 10 && r < 155) {
        first = Math.min(first, x);
        last = x;
      }
    }
    if (last >= first) rows[y] = [first, last];
  }
  for (let y = 0; y < body.height; y++) {
    // 인접 행의 윤곽을 함께 사용해 키캡 가장자리에 틈이 생기는 것을 줄인다.
    const neighbors = rows
      .slice(Math.max(0, y - 2), y + 3)
      .filter((row): row is [number, number] => !!row);
    if (!neighbors.length) continue;
    const first = Math.max(0, Math.min(...neighbors.map((row) => row[0])) - 2);
    const last = Math.min(
      body.width - 1,
      Math.max(...neighbors.map((row) => row[1])) + 2,
    );
    const bg = y * body.width * 4;
    for (let x = first; x <= last; x++) {
      const i = (y * body.width + x) * 4;
      capPixels.data.set(pixels.data.subarray(i, i + 4), i);
      pixels.data[i] = pixels.data[bg];
      pixels.data[i + 1] = pixels.data[bg + 1];
      pixels.data[i + 2] = pixels.data[bg + 2];
      pixels.data[i + 3] = pixels.data[bg + 3];
    }
  }
  bodyCtx.putImageData(pixels, 0, 0);
  capCtx.putImageData(capPixels, 0, 0);
  return [body, cap];
}

// 인접 픽셀의 밝기 차이로 윤곽선을 만든다. 실제 3D 와이어프레임은 아니다.
function contour(image: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#f2f1ea";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const gray = new Float32Array(width * height);
  for (let p = 0; p < gray.length; p++) {
    const i = p * 4;
    gray[p] =
      source.data[i] * 0.299 +
      source.data[i + 1] * 0.587 +
      source.data[i + 2] * 0.114;
  }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const edge = Math.hypot(
        gray[p + 1] - gray[p - 1],
        gray[p + width] - gray[p - width],
      );
      if (edge < 20) continue;
      const i = p * 4;
      output.data[i] = 35;
      output.data[i + 1] = 67;
      output.data[i + 2] = 76;
      output.data[i + 3] = Math.min(230, edge * 2);
    }
  ctx.putImageData(output, 0, 0);
  return canvas;
}

const ProductScene = forwardRef<SceneHandle, { blueprint: boolean }>(
  function ProductScene({ blueprint }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const pressed = useRef(false);
    const technical = useRef(blueprint);
    technical.current = blueprint;
    const [status, setStatus] = useState<"loading" | "ready" | "failed">(
      "loading",
    );
    useImperativeHandle(
      ref,
      () => ({
        press: (down) => {
          pressed.current = down;
        },
      }),
      [],
    );
    useEffect(() => {
      const element = canvas.current;
      const ctx = element?.getContext("2d");
      if (!element || !ctx) {
        setStatus("failed");
        return;
      }
      let disposed = false,
        animation = 0,
        width = innerWidth,
        height = innerHeight,
        ratio = 1;
      let scroll = window.scrollY,
        progress =
          scroll / (document.getElementById("feel")?.offsetHeight || height);
      let depression = 0,
        cursorX = 0,
        cursorY = 0,
        previous = performance.now(),
        lastIndex = -1;
      // 압축 데이터와 디코딩 이미지를 분리해 모바일 메모리 사용량을 제한한다.
      const images = new Map<number, ImageBitmap>();
      const blobs: Array<Blob | undefined> = new Array(FRAME_COUNT);
      const fetching = new Map<number, Promise<Blob>>();
      const decoding = new Map<number, Promise<void>>();
      const abort = new AbortController();
      let lastWanted = -1;
      const outlines = new Map<number, HTMLCanvasElement>();
      let restingLayers: HTMLCanvasElement[] = [],
        restingContours: HTMLCanvasElement[] = [];
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      let mobileContentBottoms = [340, 340, 340, 410, 360];
      const resize = () => {
        width = innerWidth;
        height = innerHeight;
        // 실제 글 높이를 측정해 제품이 설명 영역 아래에 들어가도록 한다.
        mobileContentBottoms = [
          "feel",
          "closer",
          "inside",
          "specs",
          "again",
        ].map((id) => {
          const panel = document.getElementById(id);
          const content = panel?.querySelector(
            id === "feel" ? ".hero-meta" : id === "again" ? ".back" : ".copy",
          );
          return panel && content
            ? content.getBoundingClientRect().bottom -
                panel.getBoundingClientRect().top +
                24
            : 340;
        });
        ratio = Math.min(devicePixelRatio, 1.75);
        element.width = Math.round(width * ratio);
        element.height = Math.round(height * ratio);
      };
      const onScroll = () => {
        scroll = window.scrollY;
      };
      const onPointer = (event: PointerEvent) => {
        if (event.pointerType === "mouse") {
          cursorX = event.clientX / width - 0.5;
          cursorY = event.clientY / height - 0.5;
        }
      };
      const reset = () => {
        cursorX = cursorY = 0;
        pressed.current = false;
      };
      resize();
      void document.fonts.ready.then(() => {
        if (!disposed) resize();
      });
      window.addEventListener("resize", resize);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("blur", reset);
      const fetchFrame = (index: number): Promise<Blob> => {
        if (blobs[index]) return Promise.resolve(blobs[index]!);
        if (fetching.has(index)) return fetching.get(index)!;
        const pending = fetch(frameUrl(index), { signal: abort.signal })
          .then((response) => {
            if (!response.ok)
              throw new Error(`Frame ${index + 1}: ${response.status}`);
            return response.blob();
          })
          .then((blob) => {
            blobs[index] = blob;
            return blob;
          })
          .finally(() => fetching.delete(index));
        fetching.set(index, pending);
        return pending;
      };
      const load = (index: number): Promise<void> => {
        if (index < 0 || index >= FRAME_COUNT || images.has(index))
          return Promise.resolve();
        if (decoding.has(index)) return decoding.get(index)!;
        const pending = fetchFrame(index)
          .then((blob) => createImageBitmap(blob))
          .then((bitmap) => {
            if (disposed) {
              bitmap.close();
              return;
            }
            images.set(index, bitmap);
            // 양 끝 프레임은 남기고, 현재 위치에서 가장 먼 이미지를 먼저 해제한다.
            while (images.size > 14) {
              const candidates = [...images.keys()].filter(
                (key) => key !== 0 && key !== FRAME_COUNT - 1 && key !== index,
              );
              const victim = candidates.sort(
                (a, b) => Math.abs(b - lastWanted) - Math.abs(a - lastWanted),
              )[0];
              if (victim === undefined) break;
              images.get(victim)?.close();
              images.delete(victim);
            }
          })
          .finally(() => decoding.delete(index));
        decoding.set(index, pending);
        return pending;
      };
      // 빠른 스크롤로 목표 프레임이 아직 없을 때는 가장 가까운 이미지로 이어간다.
      const nearest = (wanted: number) =>
        [...images.keys()].sort(
          (a, b) => Math.abs(a - wanted) - Math.abs(b - wanted),
        )[0] ?? 0;
      const draw = (now: number) => {
        if (disposed) return;
        animation = requestAnimationFrame(draw);
        const dt = Math.min((now - previous) / 1000, 0.05);
        previous = now;
        progress +=
          (scroll / (document.getElementById("feel")?.offsetHeight || height) -
            progress) *
          (reduced.matches ? 1 : 1 - Math.exp(-dt * 10));
        depression +=
          ((pressed.current ? 1 : 0) - depression) *
          (reduced.matches ? 1 : 1 - Math.exp(-dt * 24));
        // 1~3 섹션에서 분해하고 3~5 섹션에서 같은 프레임을 역순으로 사용한다.
        const opening = smooth(
          progress <= 2 ? progress / 2 : (4 - progress) / 2,
        );
        const wanted = Math.round(opening * (FRAME_COUNT - 1));
        if (wanted !== lastWanted) {
          lastWanted = wanted;
          for (const requested of [wanted, wanted - 1, wanted + 1])
            void load(requested).catch(() => {});
        }
        const index = nearest(wanted);
        const image = images.get(index);
        if (!image) return;
        if (lastIndex !== index) {
          element.dataset.frame = String(index + 1);
          lastIndex = index;
        }
        const mobile = width <= 760;
        const desiredHeight = mobile
          ? height * (1.05 - opening * 0.12)
          : height * (1.0 - opening * 0.22);
        // 키캡 위치 기록과 추가 여백을 반영해 제품 전체가 화면 안에 들어오게 한다.
        const framePosition = opening * (FRAME_COUNT - 1);
        const lowerFrame = Math.floor(framePosition);
        const upperFrame = Math.min(FRAME_COUNT - 1, lowerFrame + 1);
        const frameBlend = framePosition - lowerFrame;
        const trackedTop =
          sequence.frames[lowerFrame].capTop * (1 - frameBlend) +
          sequence.frames[upperFrame].capTop * frameBlend;
        const capTop =
          (trackedTop + sequence.topPadding) /
          (1764 + sequence.topPadding + sequence.bottomPadding);
        const contentBottom =
          (1764 + sequence.topPadding) /
          (1764 + sequence.topPadding + sequence.bottomPadding);
        const chapterPosition = Math.max(0, Math.min(4, progress));
        const chapterStart = Math.floor(chapterPosition);
        const chapterBlend = smooth(chapterPosition - chapterStart);
        const contentEdge =
          mobileContentBottoms[chapterStart] * (1 - chapterBlend) +
          mobileContentBottoms[Math.min(4, chapterStart + 1)] * chapterBlend;
        const safeTop = mobile ? contentEdge : 112;
        const safeBottom = height - (mobile ? 100 : 75);
        const fitHeight = Math.max(
          80,
          (safeBottom - safeTop) / (contentBottom - capTop),
        );
        // 모바일 2~4 섹션에서는 설명을 피해 오른쪽으로 옮기고 마지막에 중앙으로 돌아온다.
        const mobileSide = smooth(progress) * (1 - smooth(progress - 3));
        const mobileWidthLimit =
          (width * (0.94 - mobileSide * 0.16) * FRAME_HEIGHT) / FRAME_WIDTH;
        const drawingHeight = Math.min(
          desiredHeight,
          fitHeight,
          mobile ? mobileWidthLimit : Infinity,
        );
        const drawingWidth = (drawingHeight * FRAME_WIDTH) / FRAME_HEIGHT;
        const centerX = mobile
          ? Math.max(
              width * 0.5,
              Math.min(
                width * (0.5 + mobileSide * 0.12),
                width - 20 - drawingWidth / 2,
              ),
            )
          : width * 0.69;
        const centerY = mobile
          ? height * (0.64 + opening * 0.12)
          : height * (0.38 + opening * 0.12);
        const x =
          centerX -
          drawingWidth / 2 +
          (!mobile && !reduced.matches ? cursorX * 12 : 0);
        const desiredY =
          centerY -
          drawingHeight / 2 +
          (!mobile && !reduced.matches ? cursorY * 7 : 0);
        const y = Math.max(
          safeTop - capTop * drawingHeight,
          Math.min(desiredY, safeBottom - contentBottom * drawingHeight),
        );
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        if (index === 0 && restingLayers.length) {
          const layers = technical.current ? restingContours : restingLayers;
          ctx.drawImage(layers[0], x, y, drawingWidth, drawingHeight);
          ctx.drawImage(
            layers[1],
            x,
            y + depression * drawingHeight * 0.018,
            drawingWidth,
            drawingHeight,
          );
        } else {
          let source: CanvasImageSource = image;
          if (technical.current) {
            if (!outlines.has(index)) {
              if (outlines.size >= 8)
                outlines.delete(outlines.keys().next().value!);
              outlines.set(index, contour(image, 340, 669));
            }
            source = outlines.get(index)!;
          }
          // 두 이미지를 혼합하면 부품이 겹쳐 보이므로 한 번에 한 프레임만 그린다.
          ctx.drawImage(source, x, y, drawingWidth, drawingHeight);
        }
      };
      void (async () => {
        try {
          await Promise.all([load(0), load(FRAME_COUNT - 1)]);
          if (disposed) return;
          restingLayers = splitRestingKeycap(images.get(0)!);
          restingContours = restingLayers.map((layer) =>
            contour(layer, 340, 669),
          );
          setStatus("ready");
          animation = requestAnimationFrame(draw);
          // 네 개의 작업으로 파일을 미리 가져오고 디코딩은 필요한 프레임에만 수행한다.
          let next = 1;
          await Promise.all(
            Array.from({ length: 4 }, async () => {
              while (!disposed && next < FRAME_COUNT - 1) {
                const index = next++;
                try {
                  await fetchFrame(index);
                } catch {
                  // 미리 읽기에 실패해도 이미 준비된 인접 프레임으로 렌더링을 이어간다.
                }
              }
            }),
          );
        } catch {
          if (!disposed) setStatus("failed");
        }
      })();
      return () => {
        disposed = true;
        cancelAnimationFrame(animation);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("blur", reset);
        // 페이지를 나갈 때 요청을 중단하고 GPU 이미지 리소스를 해제한다.
        abort.abort();
        for (const image of images.values()) image.close();
        images.clear();
        outlines.clear();
      };
    }, []);
    return (
      <>
        <canvas
          ref={canvas}
          className="scene product-scene"
          role="img"
          aria-label="페트롤 블루 P 키캡의 기계식 스위치. 스크롤하면 부품이 분해되고 다시 조립됩니다."
        />
        {status !== "ready" && (
          <div className="product-status" role="status">
            {status === "loading"
              ? "제품 이미지를 불러오는 중"
              : "제품 이미지를 불러오지 못했습니다. 새로고침해 주세요."}
          </div>
        )}
      </>
    );
  },
);
export default ProductScene;
