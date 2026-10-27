import { createContext, useContext } from 'react'
import type { AppLanguage } from '../../shared/src/localization'

export type LocalizationValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  storageWarning: string
}

export const LocalizationContext = createContext<LocalizationValue | null>(null)

export function useLocalization(): LocalizationValue {
  const value = useContext(LocalizationContext)
  if (!value) throw new Error('LocalizationProvider is required.')
  return value
}
