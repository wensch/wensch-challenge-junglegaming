/** Figma "Rectangle 67" (78x40): the ".eth" domain selector next to the ENS label. Single fixed option. */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const ENS_DOMAIN = '.eth'

export function EnsDomainSelect() {
  return (
    <Select value={ENS_DOMAIN} onValueChange={() => undefined}>
      <SelectTrigger aria-label="Domínio ENS" className="h-10 w-[78px] shrink-0 gap-1 rounded-control border-line-soft px-2.5 text-body-sm text-text-primary">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={ENS_DOMAIN}>{ENS_DOMAIN}</SelectItem>
      </SelectContent>
    </Select>
  )
}
