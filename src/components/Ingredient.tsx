import type { IngredientShape } from '../data/kitchen';

export function Ingredient({ shape, color, size }: { shape: IngredientShape; color: string; size: number }) {
  switch (shape) {
    case 'leaf':
      return (
        <g>
          <ellipse rx={size * 1.5} ry={size * 0.72} fill={color} />
          <line x1={-size * 1.1} x2={size * 1.1} y1={0} y2={0} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        </g>
      );
    case 'drop':
      return (
        <path
          d={`M0 ${-size * 1.3} C ${size} ${-size * 0.2} ${size} ${size} 0 ${size} C ${-size} ${size} ${-size} ${-size * 0.2} 0 ${-size * 1.3} Z`}
          fill={color}
        />
      );
    case 'grain':
      return <rect x={-size * 0.7} y={-size * 0.4} width={size * 1.4} height={size * 0.8} rx={size * 0.4} fill={color} />;
    case 'slice':
      return (
        <g>
          <circle r={size * 1.15} fill={color} />
          <circle r={size * 0.75} fill="rgba(255,255,255,0.55)" />
        </g>
      );
    case 'berry':
      return (
        <g>
          <circle r={size * 0.95} fill={color} />
          <circle cx={-size * 0.3} cy={-size * 0.32} r={size * 0.28} fill="rgba(255,255,255,0.4)" />
        </g>
      );
    default:
      return (
        <g>
          <circle r={size} fill={color} />
          <circle cx={-size * 0.35} cy={-size * 0.35} r={size * 0.3} fill="rgba(255,255,255,0.45)" />
        </g>
      );
  }
}
