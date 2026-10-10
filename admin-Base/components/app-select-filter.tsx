"use client"

import { MonetizationBadge, SelectFilter, type SelectFilterProps } from "@/components/shared"
import type { AppOptionItem } from "@/hooks/use-app-options"

interface AppSelectFilterProps extends Omit<SelectFilterProps, "options"> {
  apps: AppOptionItem[]
}

export function AppSelectFilter({ apps, ...props }: AppSelectFilterProps) {
  return (
    <SelectFilter
      {...props}
      options={apps.map((app) => ({
        label: app.name,
        value: String(app.id),
        extra: <MonetizationBadge type={app.monetizationType} />,
      }))}
    />
  )
}
