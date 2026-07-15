import React from 'react';

const GUIDE_STEPS = [
  '컴퓨터 화면 정면에 서기',
  '휴대폰을 세로로 곧게 들기',
  '화면을 앞으로 향한 채 버튼 누르기',
];

const AlignmentGuide = ({ mode = 'host', color = '#00f3ff', pendingCount = 1, onConfirm }) => {
  const isController = mode === 'controller';

  return (
    <div
      className={`alignment-guide alignment-guide--${mode}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`alignment-title-${mode}`}
      style={{ '--alignment-color': color }}
    >
      <div className="alignment-guide__scrim" />
      <section className="alignment-guide__panel">
        <div className="alignment-guide__eyebrow">
          <span className="alignment-guide__live-dot" />
          {isController ? '휴대폰 위치 맞추기' : `${pendingCount}명이 위치를 맞추고 있어요`}
        </div>

        <h1 id={`alignment-title-${mode}`} className="alignment-guide__title">
          {isController
            ? '휴대폰을 화면 정면에 맞춰주세요'
            : '휴대폰 위치를 맞추는 중이에요'}
        </h1>
        <p className="alignment-guide__description">
          {isController
            ? '아래 움직임처럼 휴대폰을 세로로 세우고 컴퓨터 화면을 향하게 해주세요.'
            : '휴대폰에서 위치 맞추기가 끝나면 이 안내 화면이 자동으로 사라집니다.'}
        </p>

        <div className="alignment-animation" aria-hidden="true">
          <div className="alignment-animation__halo alignment-animation__halo--outer" />
          <div className="alignment-animation__halo alignment-animation__halo--inner" />
          <div className="alignment-animation__axis alignment-animation__axis--horizontal" />
          <div className="alignment-animation__axis alignment-animation__axis--vertical" />
          <div className="alignment-animation__target">
            <span className="alignment-animation__target-corner alignment-animation__target-corner--tl" />
            <span className="alignment-animation__target-corner alignment-animation__target-corner--tr" />
            <span className="alignment-animation__target-corner alignment-animation__target-corner--bl" />
            <span className="alignment-animation__target-corner alignment-animation__target-corner--br" />
          </div>

          <svg className="alignment-animation__motion-path" viewBox="0 0 360 250">
            <path d="M72 182 C118 224, 164 184, 183 128 C198 84, 226 62, 279 62" />
            <path className="alignment-animation__arrow" d="M262 48 L282 62 L264 78" />
          </svg>

          <div className="alignment-animation__phone-motion">
            <div className="alignment-animation__phone">
              <span className="alignment-animation__camera" />
              <span className="alignment-animation__speaker" />
              <div className="alignment-animation__screen">
                <span className="alignment-animation__screen-line" />
                <span className="alignment-animation__screen-dot" />
              </div>
              <span className="alignment-animation__side-button" />
            </div>
            <svg className="alignment-animation__hand" viewBox="0 0 180 170">
              <path d="M56 158 C46 138 43 115 48 96 L57 58 C59 49 67 44 74 48 C80 51 81 57 79 67 L75 87 L88 34 C90 25 98 20 106 23 C113 26 115 32 113 42 L104 83 L115 41 C118 32 126 28 134 32 C140 36 141 43 139 52 L130 89 L139 61 C142 52 150 49 157 53 C163 57 163 65 160 74 L147 119 C142 139 132 153 116 166 Z" />
              <path className="alignment-animation__hand-line" d="M73 91 C92 103 113 104 132 94" />
            </svg>
          </div>

          <div className="alignment-animation__lock">
            <span>✓</span>
          </div>
        </div>

        <ol className="alignment-guide__steps">
          {GUIDE_STEPS.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        {isController ? (
          <button className="alignment-guide__confirm" type="button" onClick={onConfirm}>
            이 위치로 맞추기
          </button>
        ) : (
          <div className="alignment-guide__waiting">
            <span /><span /><span />
            휴대폰에서 버튼을 눌러주세요
          </div>
        )}
      </section>
    </div>
  );
};

export default AlignmentGuide;
