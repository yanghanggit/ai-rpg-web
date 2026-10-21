/**
 * mock 的场景插图（内联 SVG）：`pnpm dev:mock` 没有后端 `.assets/image/`，但版式（大背景 + 对话框 +
 * 选项）必须看得见，所以直接把一张洞穴背景当作 `GET /assets/image/<file>` 的响应返回。
 *
 * 真实后端是同一路径上的 PNG，客户端不需要区分两者。
 */
export const mockIllustrationSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="glow" cx="50%" cy="46%" r="52%">
      <stop offset="0%" stop-color="#2f6f7a" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#14313a" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#070d12"/>
    </radialGradient>
    <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1a20"/>
      <stop offset="100%" stop-color="#05090c"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8fe3d5" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#2b7d84" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0b1418" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1600" height="900" fill="url(#glow)"/>

  <!-- 远处岩壁 -->
  <path d="M0 0 L0 900 L340 900 L300 620 L360 380 L250 120 Z" fill="url(#rock)"/>
  <path d="M1600 0 L1600 900 L1260 900 L1300 600 L1230 360 L1350 100 Z" fill="url(#rock)"/>

  <!-- 洞顶垂下的石笋 -->
  <g fill="#0a1319">
    <path d="M420 0 L470 130 L510 0 Z"/>
    <path d="M700 0 L742 180 L790 0 Z"/>
    <path d="M980 0 L1020 120 L1060 0 Z"/>
  </g>

  <!-- 中间的巨石（对话框就压在它下半身） -->
  <ellipse cx="800" cy="470" rx="330" ry="300" fill="url(#core)"/>
  <path d="M560 700 L600 420 L700 300 L900 295 L1010 400 L1050 700 Z" fill="#101d24"/>
  <path d="M620 560 L980 545 L990 580 L615 600 Z" fill="#04090c"/>
  <g fill="#f2c94c">
    <circle cx="742" cy="520" r="12"/>
    <circle cx="800" cy="512" r="12"/>
    <circle cx="858" cy="520" r="12"/>
  </g>

  <!-- 地面与前景 -->
  <path d="M0 900 L0 760 L260 720 L520 780 L800 740 L1120 790 L1380 730 L1600 770 L1600 900 Z" fill="#070d11"/>
  <g fill="#0e1c22" opacity="0.9">
    <path d="M180 900 L240 690 L300 900 Z"/>
    <path d="M1260 900 L1330 660 L1400 900 Z"/>
  </g>
</svg>`;
