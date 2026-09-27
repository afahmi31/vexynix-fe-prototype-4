export const SIZE = 1024;
export const CENTER = SIZE / 2;

export function polarPoint(radius, angle) {
  const radians = (angle * Math.PI) / 180;

  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

export function formatPoint(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

export function polygonPoints(radius, rotation = 0, sides = 8) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + index * (360 / sides);
    return formatPoint(polarPoint(radius, angle));
  }).join(" ");
}

export function polygonPath(radius, rotation = 0, sides = 8) {
  const points = polygonPoints(radius, rotation, sides).split(" ");
  return `M ${points.join(" L ")} Z`;
}

export function segmentPath(
  startAngle,
  endAngle,
  outerRadius = 394,
  innerRadius = 132,
) {
  const outerStart = formatPoint(polarPoint(outerRadius, startAngle));
  const outerEnd = formatPoint(polarPoint(outerRadius, endAngle));
  const innerEnd = formatPoint(polarPoint(innerRadius, endAngle));
  const innerStart = formatPoint(polarPoint(innerRadius, startAngle));

  return [
    `M ${outerStart}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd}`,
    `L ${innerEnd}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart}`,
    "Z",
  ].join(" ");
}

export function segmentAngles(index, segmentCount = 8, pointerAngle = -90) {
  const angle = 360 / segmentCount;
  const centerAngle = pointerAngle + index * angle;

  return {
    centerAngle,
    startAngle: centerAngle - angle / 2,
    endAngle: centerAngle + angle / 2,
  };
}

export function iconPosition(index, radius = 274, segmentCount = 8) {
  return polarPoint(radius, segmentAngles(index, segmentCount).centerAngle);
}

export function alpha(value) {
  return Number(value).toFixed(2);
}

