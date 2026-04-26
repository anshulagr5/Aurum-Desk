function capitalizeSegment(segment: string) {
  if (!segment) {
    return ''
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

export function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.split('-').map((part) => part.split("'").map(capitalizeSegment).join("'")).join('-'))
    .join(' ')
}
