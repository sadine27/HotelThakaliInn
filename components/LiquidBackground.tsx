"use client";

import { useEffect, useRef } from "react";

/* The liquid ground under .room-view.

   The four drifting radial gradients this replaces are still in globals.css and
   still the fallback — a gradient can only be a soft flat blob, because it has
   no surface normal to catch a light with. Here the warped noise field IS a
   height map, so the same field gives both the colour and the gloss on top of
   it, and the result reads as something with a wet surface rather than four
   coloured clouds sliding past each other.

   Mounted only while the detail is open (RoomsCarousel unmounts it on Back —
   that is what stops the frame loop) and never at all under reduced motion. */

const VERT = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

/* Palette is the site's own tokens, not a warmer sand: --bg for the ground,
   the cream for the crest, --olive for the contour and --green for the deepest
   fold. Olive tops out at 0.30 and green at 0.12 — the same weights the
   gradients underneath already carry, and past those the mono labels (--olive
   on cream) start losing contrast against their own ground. */
const FRAG = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;

  const vec3 colorA    = vec3(0.047, 0.055, 0.055); // #0c0e0e  neutral charcoal, blends with every daypart
  const vec3 colorB    = vec3(0.078, 0.090, 0.086); // #141715
  const vec3 colorC    = vec3(0.149, 0.165, 0.157); // #262a28  neutral mid
  const vec3 tint      = vec3(0.431, 0.506, 0.478); // #6e817a  desaturated sage, a whisper not a wash
  const vec3 highlight = vec3(0.788, 0.596, 0.353); // #c9985a  --brass crest, never white

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    /* Domain warping: each pass pushes the sample point along the previous
       pass's own field, which is what bends straight waves into the folds and
       cusps a fluid makes. Three passes — a fourth is not visible at this
       amplitude and the loop bound has to be constant in GLSL ES 1.0 anyway. */
    vec2 p = st * 2.5;
    for (int i = 1; i < 4; i++) {
      float fi = float(i);
      p.x += 0.3 / fi * sin(fi * 2.0 * p.y + u_time + 0.3 * fi);
      p.y += 0.3 / fi * cos(fi * 2.0 * p.x + u_time + 0.3 * fi);
    }

    float pattern = (sin(p.x * 2.5 + p.y * 2.0) + cos(p.x * 3.0 - p.y * 1.5 + u_time)) * 0.5 + 0.5;

    /* pattern read as a height: the shoulder gives the colour break, the steep
       pow gives a narrow specular band that only lights the crests. */
    float edge  = smoothstep(0.40, 0.80, pattern);
    float gloss = pow(smoothstep(0.78, 0.99, pattern), 4.0) * 0.11;

    vec3 c = mix(colorA, colorB, edge);
    c = mix(c, colorC, smoothstep(0.10, 0.40, pattern) * 0.30);
    c = mix(c, tint, smoothstep(0.00, 0.22, 1.0 - pattern) * 0.12);
    /* mix, not +=: adding would clip the crests to white, which is the one
       thing this design does not allow. Mixing tops out at the highlight
       colour itself, so the brightest pixel a crest can reach is brass. */
    c = mix(c, highlight, gloss);

    /* One knob for how loud the whole field is. The ground is meant to sit
       under the glass, not compete with it, so the finished mix is pulled
       back toward the page's own --bg. Raise toward 1.0 for more of it. */
    c = mix(colorA, c, 0.62);

    gl_FragColor = vec4(c, 1.0);
  }
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/* speed is the only knob worth exposing — flow rate is the thing that gets
   tuned against the real page, and it should not mean editing GLSL. */
export default function LiquidBackground({ speed = 0.15 }: { speed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /* The frame loop below reads this every frame rather than closing over
     `speed`, so a new speed does not mean tearing down the GL context.
     Assigned in an effect and not during render: a render can be started and
     thrown away under concurrent React, and a ref written on the discarded one
     keeps its value — the loop would then animate at a speed that no committed
     render ever asked for. The useRef initialiser already covers the first
     frame, so this only ever carries a later change. */
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* Read here rather than gating the mount in RoomsCarousel: the server has no
       media query to answer with, so a render-time check hydrates into a
       mismatch. In an effect it is client-only and cannot. The canvas element
       still renders under reduce — transparent, no context, hidden by CSS — and
       the static gradients underneath are the whole picture. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return; // no context: the gradients underneath stay as they are

    /* colorA / --bg. Every canvas.width assignment implicitly clears the buffer,
       and the ResizeObserver fires all through the 640ms column expansion — with
       alpha:false the default clear is opaque black, so it clears to the page's
       own ground instead. */
    gl.clearColor(0.043, 0.063, 0.055, 1);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, "position");
    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const host = canvas.parentElement;

    /* The room's column animates its own width over 640ms as the detail opens —
       a window resize never fires for that, so observe the canvas itself. */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let stamped = false;
    let start = performance.now();
    const render = (now: number) => {
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, (now - start) * 0.001 * speedRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      /* Stamped here, not during setup: the attribute both fades this canvas in
         and stops the gradient drift underneath, so it has to fire at the one
         moment there is a real frame to swap to. Setting it during setup laid an
         opaque black canvas over the gradients for however long the GPU process
         and the shader link took — that was the black flash on open. */
      if (!stamped) {
        stamped = true;
        host?.setAttribute("data-liquid", "");
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    /* Hidden tab: stop drawing, and carry the elapsed offset forward so coming
       back resumes the flow instead of jumping to wherever the clock got to. */
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        hiddenAt = performance.now();
      } else if (!frame) {
        start += performance.now() - hiddenAt;
        frame = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      host?.removeAttribute("data-liquid");
      /* Deliberately NOT loseContext(). Forcing the loss poisons the element:
         getContext() on a canvas whose context was force-lost returns that same
         dead context forever, so the next mount on the same DOM node gets a
         non-null gl that fails every call — no animation, and Chrome paints its
         sad-face placeholder over the canvas. React's StrictMode double-invokes
         this effect on the same node in dev, so that next mount is immediate.
         The context is collected with the canvas; there is nothing to free here. */
    };
  }, []);

  return <canvas ref={canvasRef} className="liquid-bg" aria-hidden="true" />;
}
