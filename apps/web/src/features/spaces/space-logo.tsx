import {
  BadgeCheck,
  BookOpen,
  Box,
  Briefcase,
  ChartColumn,
  Cloud,
  Code,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  Headset,
  Layers,
  LayoutGrid,
  Lightbulb,
  Megaphone,
  Palette,
  Rocket,
  Server,
  Shapes,
  Shield,
  Smartphone,
  SwatchBook,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { colorValue } from '@/lib/colors'
import type { Space } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The logos a space can have without uploading one. The keys are stored in spaces.logo. */
export const SPACE_LOGOS: Record<string, { icon: LucideIcon; label: string }> = {
  code: { icon: Code, label: 'Code' },
  shapes: { icon: Shapes, label: 'Shapes' },
  box: { icon: Box, label: 'Box' },
  chart: { icon: ChartColumn, label: 'Chart' },
  swatches: { icon: SwatchBook, label: 'Swatches' },
  layers: { icon: Layers, label: 'Layers' },
  target: { icon: Target, label: 'Target' },
  lightbulb: { icon: Lightbulb, label: 'Idea' },
  'check-badge': { icon: BadgeCheck, label: 'Badge' },
  server: { icon: Server, label: 'Server' },
  users: { icon: Users, label: 'People' },
  grid: { icon: LayoutGrid, label: 'Grid' },
  database: { icon: Database, label: 'Database' },
  cloud: { icon: Cloud, label: 'Cloud' },
  cpu: { icon: Cpu, label: 'Chip' },
  smartphone: { icon: Smartphone, label: 'Phone' },
  globe: { icon: Globe, label: 'Globe' },
  shield: { icon: Shield, label: 'Shield' },
  rocket: { icon: Rocket, label: 'Rocket' },
  flask: { icon: FlaskConical, label: 'Flask' },
  palette: { icon: Palette, label: 'Palette' },
  megaphone: { icon: Megaphone, label: 'Megaphone' },
  headset: { icon: Headset, label: 'Support' },
  briefcase: { icon: Briefcase, label: 'Briefcase' },
  book: { icon: BookOpen, label: 'Book' },
}

export const isImageLogo = (logo: string) => logo.startsWith('data:image/')

/** A space's logo: its uploaded image, or one of the app's logos on the space's color. */
export function SpaceLogo({ space, className }: { space: Pick<Space, 'logo' | 'color' | 'name'>; className?: string }) {
  const base = cn('grid size-7 flex-none place-items-center overflow-hidden rounded-sm', className)
  if (isImageLogo(space.logo)) return <img src={space.logo} alt="" className={cn(base, 'bg-surface object-cover')} draggable={false} />

  const Icon = SPACE_LOGOS[space.logo]?.icon ?? LayoutGrid
  return (
    <span aria-hidden="true" className={cn(base, 'bg-(--logo) text-white')} style={{ '--logo': colorValue(space.color) } as CSSProperties}>
      <Icon className="size-[58%]" strokeWidth={2.2} />
    </span>
  )
}

/** Turns an image someone picked into a small square logo (128 px), as a data: address the database keeps. */
export async function logoFromImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image: PNG, JPEG, WebP, GIF or SVG.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image of up to 5 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("This image couldn't be read."))
      element.src = url
    })
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')!
    // Cover the square, cutting the longer side.
    const scale = Math.max(size / (image.naturalWidth || size), size / (image.naturalHeight || size))
    const width = (image.naturalWidth || size) * scale
    const height = (image.naturalHeight || size) * scale
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
