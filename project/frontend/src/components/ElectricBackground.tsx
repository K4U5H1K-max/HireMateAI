import { useEffect, useRef } from 'react';

type Dot = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
};

interface ElectricBackgroundProps {
  className?: string;
  dotCount?: number;
}

const ElectricBackground = ({ className = '', dotCount = 60 }: ElectricBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const dots: Dot[] = [];
    for (let i = 0; i < dotCount; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
      });
    }

    let frameId = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = '#05fcd3';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#05fcd3';
        ctx.fill();

        dot.x += dot.vx * 4;
        dot.y += dot.vy * 4;

        if (dot.x < 0 || dot.x > canvas.width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > canvas.height) dot.vy *= -1;
      }

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 80) {
            const alpha = Math.min(0.85 - dist / 100, 0.75);
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(5, 252, 211, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 18;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.globalCompositeOperation = 'lighter';
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, [dotCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      aria-hidden
    />
  );
};

export default ElectricBackground;
