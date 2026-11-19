# 来源与许可记录

2026-11-03 Android 原生外壳采用 Tauri CLI 2.12.4 官方 Android 模板，并接入本工程共用 Rust 库。具体来源、许可与平台适配见 src-tauri/gen/android/NOTICE.md；未引入独立 Android 业务框架。

2026-10-26 网络状态图标使用 Lucide 官方 wifi、wifi-low、wifi-zero、wifi-off SVG，原样保存在 assets/runtime/icons/lucide，通过遮罩着色。来源：https://github.com/lucide-icons/lucide/tree/main/icons ，许可原文保存在 docs/licenses/lucide-LICENSE.txt。没有引入整套图标运行库。

2026-10-25 更多入口使用 React Bits Magnet（TypeScript），取自 https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Animations/Magnet/Magnet.tsx 。保留本地源文件，外围组合文字及向下大箭头，限制磁吸位移并支持减少动态效果；无新增运行依赖。沿用 docs/licenses/react-bits-LICENSE.md 的 MIT + Commons Clause 条件。Home 小图标按用户要求改为本地细线条 SVG，不再使用原填充路径。

本工程基于 LibreSpark/LibreTV 的设计及代码改造。上游：https://github.com/LibreSpark/LibreTV ，基线版本 2.21.0，提交 `b08c8242d2a3cdb4309b40c58001c69c04593ce1`，许可证 AGPL-3.0-or-later。项目根目录保留上游 LICENSE 原文。

第一部分参考 `src/lib/cms-parser.ts` 的 Apple CMS 搜索、分组播放地址与详情字段转换，以及 `src/lib/douban-weekly.ts` 的 60s 热榜路径及字段转换，迁移为 Rust 实现。其余应用基座、存储与媒体授权通道为本工程新增。并非上游官方发布的客户端。

Rust 与 npm 依赖的准确版本分别记录于 Cargo.lock 和 package-lock.json。发布安装包时还应检查实际随包组件，汇总适用的依赖许可；本文件尚非最终安装包的完整依赖许可清单。

第二部分直接迁移并适配上游 `globals.css`、Tailwind 配置、`icon.tsx`、`states.tsx`、`remarks.ts`、`playback-recovery.ts`；从 `video-card.tsx` 提取同名影片聚合逻辑，从 `types.ts` 保留 SearchResultItem。页面交互和播放器外壳针对新 Rust 接口重新接线，继续使用上游的 ArtPlayer + hls.js 技术组合。以上上游内容沿用原许可，不主张为本工程原创。

开发期 `.tools/` 中的工具不属于应用运行时，也不进入安装包。

Windows GNU x64 单文件版本原样内置 Microsoft WebView2Loader.dll，来源为锁定依赖 webview2-com-sys 0.39.1 的 x64 二进制，文件与摘要见 src-tauri/resources/README.md；该 Microsoft 加载库不主张为本工程或 Rust 绑定作者原创。WebView2 Runtime 仍由系统安装。

IOS风阶段参考 `seunghan91/ios27-design-system` 的材料层次、设置分组和分段选择规则，在现有 WebTV 组件中重新适配；不是 Apple 官方实现。MIT 原文保留于 `docs/licenses/ios-style-MIT.txt`。未将技能目录或完整组件库打入运行时。

界面图标取自 `framework7io/framework7-icons`，源提交 `7fb38494ba82cbef74d4f7e725431544c8ea1ee5`，22 个 SVG 的路径与 viewBox 整理于 `assets/icons/navigation.json`，由本地 React SVG 组件绘制，无字体或网络加载。MIT 原文见 `docs/licenses/framework7-icons-MIT.txt`。

顶部导航采用 React Bits 的 Rubber Segment（TypeScript + CSS），来源 https://reactbits.dev/micro/rubber-segment ，通过官方 registry 的 RubberSegment-TS-CSS.json 取得（2026-10-25）。保留原始伸展/回弹、拖动和减少动态效果逻辑；适配纯图标、页面导航语义、无选中项及键盘/辅助技术激活。依赖 motion/react。上游许可为 MIT + Commons Clause，原文见 docs/licenses/react-bits-LICENSE.md。

页眉视觉调整（2026-10-25）参考 shadcn/ui Neutral 配色（https://ui.shadcn.com/docs/theming）、React Bits Gradual Blur 的渐进式边缘模糊思路（https://reactbits.dev/animations/gradual-blur）、Aceternity UI 的 macOS 窗口表现（https://ui.aceternity.com/changelog）。这些部分按 WebTV 的不透明页眉、装饰层点击穿透及既有窗口指令自行适配，未引入整套组件库。Rubber Segment 在现有源码基础上调低 stretch/squash/glide，改为蓝色短拖尾滑块。


2026-10-26 v0.2 界面微调：音量使用 React Bits Scrub Field 的官方 TypeScript/CSS 源码，下载自 https://reactbits.dev/r/ScrubField-TS-CSS.json ，组件页 https://reactbits.dev/c/micro/scrub-field 。源文件保存在 docs/archive/unused-source/src/shared/animation/ScrubField.tsx 与 ScrubField.css；WebTV 只适配音量范围、主题变量、外部弹出容器。沿用 docs/licenses/react-bits-LICENSE.md 的 MIT + Commons Clause 条件，无新增依赖。

设置面板与选集页面的方向切换参考 Motion 官方 AnimatePresence、popLayout 与 spring 方案：https://motion.dev/docs/react-animate-presence 、https://motion.dev/docs/react-transitions 。卡片的透视、悬浮与分层关系参考 CodeFronts 官方 3D Tilt Card 示例 https://codefronts.com/motion/css-hover-effects/css-3d-tilt-card-hover-effect/ ，按 WebTV 海报/标题/年份与分类数据自行实现，未复制其示例文本或整页布局。用户给定的旧卡片地址当前无法直接访问，使用该站同类示例。素材与代码中的原有许可记录继续保留。

无线信号与播放器图标参考用户提供的设计图，由本项目拆分重绘成独立 SVG，保存在 assets/runtime/icons/network 与 assets/runtime/icons/player。参考图原样保存在 assets/references，不进入运行产物；重绘版本不含参考板的背景、标题或角标。第三方标识和许可不因重绘而转移。


2026-10-26 图标替换：当前导航、设置、播放与网络状态使用用户提供并已放入 assets/icons/ 的 SVG 集，不使用同名 PNG。单色图标通过 currentColor 继承主题，Wi-Fi 多色路径保留原色；路径未重画。来源记录和当前映射见 assets/icons/README.md 与 docs/archive/development/v0.2用户SVG图标替换.md。原 Framework7、Lucide 及此前参考素材的许可记录为历史来源继续保留，新库没有提供的基础符号仍用 Framework7 兜底。


2026-10-26 配色补充：用户 SVG 的路径与原文件保留，Wi-Fi 的显示色在接入层按用户基础色盘派生，统一入口为 src/styles/palette.css；不改变素材来源与原许可记录。


2026-10-26 CodeFronts card-01 直接移植：使用用户指定 https://codefronts.com/motion/css-card-hover-effects/3d-tilt-parallax-card-effects/ 的第 01 项 HTML/CSS/JS。上游标注 MIT licensed。源副本与接入说明见 docs/reference/codefronts-card-01/；运行代码为 src/components/codefronts-card.ts、MediaCard.css，保留原景深、倾斜和高光算法。与此前仅参考其他示例的实现不同，本次已替换原卡片结构。示例字体 Fraunces 和 Inter Tight 从 Google Fonts 下载并本地使用，其 OFL 原文随 assets/runtime/fonts/codefronts 保留。

2026-10-27 结构整理：CodeFronts 完整卡片样式已按用户此前要求撤回；其旧实现移至 docs/reference/codefronts-card-01/retired-* 供来源留档，不在当前运行链路。当前卡片为 shared/media/MediaReveal.tsx 和 MediaCard.css。assets/icons 的 40 个用户 SVG 曾在整理前缺失，利用原矢量中间记录重组并核对最初导入清单，40 个 SHA256 全部一致；navigation.json 的基础兜底符号从工程此前使用的本地图标库 Framework7-Icons 恢复。


2026-10-27 海景示例卡片：按用户截图直接采用 https://ui.aceternity.com/registry/notch-demo.json 中 NotchDemo 的卡片展示结构与默认 Blue（#3b82f6）：320px卡片、4px内嵌图片、16px外圆角/12px图像圆角、居中白色标题说明、shadow-xl/shadow-2xl。影视数据代入图片和文字，维持原有点击播放及独立图片加载。此前误加的 Notch 黑色浮动栏与 Notch.tsx/MediaNotch.tsx 已删除，不在当前运行链路。许可来源 https://ui.aceternity.com/licence 。
# 运行时字体来源补充

应用可按需从 https://rsms.me/inter/ 下载 Inter（SIL Open Font License），从 https://github.com/dsrkafuu/misans 下载 MiSans 的可变字体原件；后者项目包含其来源及许可证说明。下载源配置位于 src-tauri/font-sources.json，字体仅供应用内使用，未修改字形或系统安装字体。

