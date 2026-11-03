/**
 * Social glyphs of the footer. lucide-react 1.x dropped brand icons, so these are minimal
 * 24x24 outline drawings in the same stroke style (decorative: the link carries the name).
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export const FacebookGlyph = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
  </svg>
)

export const InstagramGlyph = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="0.6" fill="currentColor" />
  </svg>
)

export const TwitterGlyph = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M21 6.5c-.7.3-1.4.5-2.1.6.8-.5 1.3-1.2 1.6-2-.7.4-1.5.7-2.3.9A3.6 3.6 0 0 0 12 9.3 10.2 10.2 0 0 1 4.6 5.6s-3.3 7.4 4.1 10.7A11 11 0 0 1 3 18c7.4 4.1 16.5 0 16.5-9.4v-.4c.6-.5 1.1-1.1 1.5-1.7z" />
  </svg>
)

export const LinkedinGlyph = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 10v8M7 6.5v.01M11 18v-8M11 13.5a3 3 0 0 1 6 0V18" />
  </svg>
)

export const YoutubeGlyph = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" />
  </svg>
)
