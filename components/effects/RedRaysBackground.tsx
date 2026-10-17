"use client";

import { useEffect, useRef } from "react";

export function RedRaysBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      console.warn("WebGL not supported for red rays background");
      return;
    }

    const config = {
      raysColor: [1.0, 0.0, 0.0] as [number, number, number],
      raysSpeed: 1.0,
      lightSpread: 3.8,
      rayLength: 9.0,
      fadeDistance: 3.6,
      saturation: 1.0,
      mouseInfluence: 0.0,
      noiseAmount: 0.0,
      distortion: 0.0,
      pulsating: 0.0,
    };

    const vsSource = `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float iTime;
      uniform vec2  iResolution;
      uniform vec2  rayPos;
      uniform vec2  rayDir;
      uniform vec3  raysColor;
      uniform float raysSpeed;
      uniform float lightSpread;
      uniform float rayLength;
      uniform float pulsating;
      uniform float fadeDistance;
      uniform float saturation;
      uniform vec2  mousePos;
      uniform float mouseInfluence;
      uniform float noiseAmount;
      uniform float distortion;
      varying vec2 vUv;

      float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
        vec2 sourceToCoord = coord - raySource;
        vec2 dirNorm = normalize(sourceToCoord);
        float cosAngle = dot(dirNorm, rayRefDirection);
        float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
        float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

        float distance = length(sourceToCoord);
        float maxDistance = iResolution.y * max(rayLength, 1.0);
        float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.15, 1.0);

        float fadeFalloff = clamp(
          (iResolution.y * max(fadeDistance, 0.001) - distance) / (iResolution.y * max(fadeDistance, 0.001)),
          0.2,
          1.0
        );
        float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

        float baseStrength = clamp(
          (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
          (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
          0.0, 1.0
        );

        return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
      }

      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

        vec2 finalRayDir = rayDir;
        if (mouseInfluence > 0.0) {
          vec2 mouseScreenPos = mousePos * iResolution.xy;
          vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
          finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
        }

        vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
        vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);

        fragColor = rays1 * 0.5 + rays2 * 0.4;

        if (noiseAmount > 0.0) {
          float n = noise(coord * 0.01 + iTime * 0.1);
          fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
        }

        float brightness = mix(1.0, 0.32, clamp(coord.y / iResolution.y, 0.0, 1.0));
        fragColor.x *= 0.12 + brightness * 0.78;
        fragColor.y *= 0.28 + brightness * 0.62;
        fragColor.z *= 0.42 + brightness * 0.5;

        if (saturation != 1.0) {
          float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
          fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
        }

        fragColor.rgb *= raysColor;
      }

      void main() {
        vec4 color;
        mainImage(color, gl_FragCoord.xy);
        gl_FragColor = color;
      }
    `;

    function compileShader(source: string, type: number) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl!.getShaderInfoLog(shader));
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "iTime");
    const uRes = gl.getUniformLocation(program, "iResolution");
    const uRayPos = gl.getUniformLocation(program, "rayPos");
    const uRayDir = gl.getUniformLocation(program, "rayDir");
    const uRaysColor = gl.getUniformLocation(program, "raysColor");
    const uRaysSpeed = gl.getUniformLocation(program, "raysSpeed");
    const uLightSpread = gl.getUniformLocation(program, "lightSpread");
    const uRayLength = gl.getUniformLocation(program, "rayLength");
    const uPulsating = gl.getUniformLocation(program, "pulsating");
    const uFadeDistance = gl.getUniformLocation(program, "fadeDistance");
    const uSaturation = gl.getUniformLocation(program, "saturation");
    const uMousePos = gl.getUniformLocation(program, "mousePos");
    const uMouseInfluence = gl.getUniformLocation(program, "mouseInfluence");
    const uNoiseAmount = gl.getUniformLocation(program, "noiseAmount");
    const uDistortion = gl.getUniformLocation(program, "distortion");

    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);

      // Top-center origin matching the reference configuration
      const anchor = [0.5 * canvas.width, -0.2 * canvas.height];
      const dir = [0, 1];
      gl.uniform2f(uRayPos, anchor[0], anchor[1]);
      gl.uniform2f(uRayDir, dir[0], dir[1]);
    }

    window.addEventListener("resize", resize);
    resize();

    gl.uniform3f(uRaysColor, config.raysColor[0], config.raysColor[1], config.raysColor[2]);
    gl.uniform1f(uRaysSpeed, config.raysSpeed);
    gl.uniform1f(uLightSpread, config.lightSpread);
    gl.uniform1f(uRayLength, config.rayLength);
    gl.uniform1f(uPulsating, config.pulsating);
    gl.uniform1f(uFadeDistance, config.fadeDistance);
    gl.uniform1f(uSaturation, config.saturation);
    gl.uniform2f(uMousePos, 0.5, 0.5);
    gl.uniform1f(uMouseInfluence, config.mouseInfluence);
    gl.uniform1f(uNoiseAmount, config.noiseAmount);
    gl.uniform1f(uDistortion, config.distortion);

    let animationFrameId: number;

    function render(time: number) {
      if (!document.hidden && gl) {
        gl.uniform1f(uTime, time * 0.001);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      if (gl) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#1a0000] lt:hidden"
    >
      <canvas ref={canvasRef} className="block size-full" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, transparent 42%, rgba(26, 0, 0, 0.22) 68%, rgba(8, 0, 0, 0.55) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 55% at 50% 100%, rgba(127, 0, 0, 0.14), transparent 58%)",
        }}
      />
    </div>
  );
}
