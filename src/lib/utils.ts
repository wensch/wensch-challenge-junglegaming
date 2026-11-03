import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge must know the Figma tokens declared in index.css `@theme`; otherwise a custom
 * size such as `text-body-md` is mistaken for a color and silently drops `text-primary-foreground`
 * (found by axe: 2.49:1 contrast on primary buttons).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'heading', 'body-lg', 'body-md', 'body', 'body-sm', 'caption', 'caption-sm', 'tiny', 'micro'],
      tracking: ['figma'],
      spacing: ['gutter', 'header', 'tabbar'],
      container: ['page'],
      radius: ['control', 'card', 'panel'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
