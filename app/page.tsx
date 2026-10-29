"use client";
import { useEffect, useRef, useState } from "react";
import ProductScene, { type SceneHandle } from "../components/ProductScene";
const chapters = [
  "감각의 시작",
  "가까이 보기",
  "스위치의 안쪽",
  "설계 살펴보기",
  "한 번 더",
];
export default function Home() {
  const engine = useRef<SceneHandle>(null);
  const [sound, setSound] = useState(false);
  const [blueprint, setBlueprint] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [count, setCount] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const held = useRef(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  // 브라우저의 오디오 제한에 맞춰 첫 사용자 입력에서 AudioContext를 만든다.
  const press = () => {
    if (held.current) return;
    held.current = true;
    setPressed(true);
    setCount((n) => n + 1);
    engine.current?.press(true);
    if (soundRef.current) {
      const ctx = audio.current ?? (audio.current = new AudioContext());
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(95, ctx.currentTime + 0.045);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    }
  };
  const release = () => {
    held.current = false;
    setPressed(false);
    engine.current?.press(false);
  };
  // 전역 키보드 이벤트가 최신 상태의 동작을 호출하도록 ref로 연결한다.
  const actions = useRef({ press, release });
  actions.current = { press, release };
  // 버튼과 링크에 포커스가 있을 때는 해당 요소의 기본 키보드 동작을 우선한다.
  useEffect(() => {
    const scroll = () =>
      setChapter(
        Math.min(
          4,
          Math.max(
            0,
            Math.round(
              window.scrollY /
                (document.getElementById("feel")?.offsetHeight ||
                  window.innerHeight),
            ),
          ),
        ),
      );
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(
          e.target instanceof HTMLElement &&
          /BUTTON|A|INPUT|TEXTAREA/.test(e.target.tagName)
        )
      ) {
        e.preventDefault();
        if (!e.repeat) actions.current.press();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") actions.current.release();
    };
    const blur = () => actions.current.release();
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      void audio.current?.close();
    };
  }, []);
  return (
    <main className={blueprint ? "blueprint" : ""}>
      <ProductScene ref={engine} blueprint={blueprint} />
      <header>
        <a href="#feel" className="wordmark" aria-label="PRESS 처음으로">
          press<span>®</span>
        </a>
        <span className="header-note">작은 스위치, 선명한 감각.</span>
        <button
          className="sound"
          onClick={() => setSound(!sound)}
          aria-pressed={sound}
        >
          <span>{sound ? "▥" : "▥"}</span> {sound ? "소리 끄기" : "소리 켜기"}
        </button>
      </header>
      <nav className="chapter-nav" aria-label="섹션 이동">
        {chapters.map((name, i) => (
          <a
            key={name}
            href={`#${["feel", "closer", "inside", "specs", "again"][i]}`}
            aria-label={name}
            aria-current={chapter === i ? "step" : undefined}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <i />
          </a>
        ))}
      </nav>
      <section id="feel" className="panel hero">
        <div className="eyebrow">
          <i /> 스위치 탐구 / 001
        </div>
        <h1>
          짧은 움직임.
          <br />
          <em>오래 남는 감각.</em>
        </h1>
        <p className="intro">
          고작 4mm의 움직임.
          <br />
          계속 누르고 싶어지는 이유.
        </p>
        <div className="hero-meta">
          <span>01 / 리니어 스위치</span>
          <span>누르고 싶은 감각을 위해 ↗</span>
        </div>
        <div className="object-note">
          P—01
          <span>
            기계식 스위치
            <br />
            오렌지 에디션
          </span>
        </div>
      </section>
      <section id="closer" className="panel">
        <div className="copy">
          <div className="eyebrow">02 / 가까이 들여다보기</div>
          <h2>
            작은 차이가
            <br />
            손끝에 남는다.
          </h2>
          <p>
            부드럽게 내려가는 스템.
            <br />
            단단하게 받쳐주는 하우징.
            <br />한 번의 입력을 위해 정교하게 맞물린 구조.
          </p>
          <div className="detail">
            <b>
              4.0<span>mm</span>
            </b>
            <span>
              전체 이동 거리
              <br />
              처음부터 끝까지, 매끄럽게.
            </span>
          </div>
        </div>
        <span className="side-caption">마찰은 줄이고, 흐름은 부드럽게.</span>
      </section>
      <section id="inside" className="panel">
        <div className="copy">
          <div className="eyebrow">03 / 스위치의 안쪽</div>
          <h2>
            좋은 감각은
            <br />
            안에서부터.
          </h2>
          <p>
            스크롤하면 드러나는 작은 세계.
            <br />
            투명한 하우징 안에 담긴 정교한 움직임.
          </p>
          <ol className="parts">
            {[
              "키캡",
              "상부 하우징",
              "스템",
              "스프링",
              "접점",
              "하부 하우징",
            ].map((s, i) => (
              <li key={s}>
                <span>0{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section id="specs" className="panel">
        <div className="copy">
          <div className="eyebrow">04 / 감각을 설계하다</div>
          <h2>
            감각에도
            <br />
            설계가 있다.
          </h2>
          <p>겉을 걷어내고, 선으로 들여다보기.</p>
          <button
            className="toggle"
            aria-pressed={blueprint}
            onClick={() => setBlueprint(!blueprint)}
          >
            <span className={blueprint ? "on" : ""} />
            {blueprint ? "설계도 닫기" : "설계도 보기"} ↗
          </button>
          <dl>
            <div>
              <dt>스위치 방식</dt>
              <dd>리니어</dd>
            </div>
            <div>
              <dt>작동 압력</dt>
              <dd>45 gf</dd>
            </div>
            <div>
              <dt>입력 인식 거리</dt>
              <dd>2.0 mm</dd>
            </div>
            <div>
              <dt>전체 이동 거리</dt>
              <dd>4.0 mm</dd>
            </div>
          </dl>
          <small>컨셉 모델의 설정값입니다. 실제 판매 제품이 아닙니다.</small>
        </div>
      </section>
      <section id="again" className="panel outro">
        <div className="eyebrow">05 / 한 번 더</div>
        <h2>
          누르고.
          <br />
          느끼고.
          <br />
          <em>한 번 더.</em>
        </h2>
        <p>
          별것 아닌 한 번의 클릭이,
          <br />
          좋아하는 감각이 될 때까지.
        </p>
        <a href="#feel" className="back">
          다시 느껴보기 ↑
        </a>
        <footer>
          <span>PRESS® — 손끝으로 탐구하는 작은 세계</span>
          <span>컨셉 프로젝트 / 2026</span>
        </footer>
      </section>
      <div className="interaction">
        <span className="live">
          <i /> 스위치 탐구
        </span>
        <button
          className={`press-button ${pressed ? "pressed" : ""}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            press();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.code === "Space") {
              e.preventDefault();
              if (!e.repeat) press();
            }
          }}
          onKeyUp={release}
          onBlur={release}
          aria-label="스위치 누르기"
        >
          {pressed ? "이 감각, 느껴보세요 ↓" : "꾹 눌러보세요 ↓"}
          <kbd>스페이스바</kbd>
        </button>
        <span className="counter">{String(count).padStart(3, "0")}회 누름</span>
      </div>
      <div className="scroll-hint">
        아래로 내려 살펴보기 <span>↓</span>
      </div>
    </main>
  );
}
