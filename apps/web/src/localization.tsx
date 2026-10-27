import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  APP_LANGUAGES,
  DEFAULT_LANGUAGE,
  translateNarrative,
  translateText,
  type AppLanguage,
} from '../../shared/src/localization'
import { LocalizationContext, useLocalization } from './localizationContext'

const LANGUAGE_STORAGE_KEY = 'groupchat-analyst-language'

function isAppLanguage(value: string | null): value is AppLanguage {
  return APP_LANGUAGES.some(({ code }) => code === value)
}

function initialLanguage(): { language: AppLanguage; storageWarning: string } {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return {
      language: isAppLanguage(stored) ? stored : DEFAULT_LANGUAGE,
      storageWarning: '',
    }
  } catch {
    return {
      language: DEFAULT_LANGUAGE,
      storageWarning: 'Language preference could not be read or saved in this browser.',
    }
  }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState(initialLanguage)
  const setLanguage = (language: AppLanguage) => {
    setSaved((current) => ({ ...current, language }))
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
      setSaved((current) => ({ ...current, storageWarning: '' }))
    } catch {
      setSaved((current) => ({
        ...current,
        storageWarning: 'Language preference could not be read or saved in this browser.',
      }))
    }
  }

  useEffect(() => {
    const selected = APP_LANGUAGES.find(({ code }) => code === saved.language)
    document.documentElement.lang = saved.language
    document.documentElement.dir = selected?.direction ?? 'ltr'
  }, [saved.language])

  return (
    <LocalizationContext.Provider
      value={{
        language: saved.language,
        setLanguage,
        storageWarning: saved.storageWarning,
      }}
    >
      {children}
    </LocalizationContext.Provider>
  )
}

function translateNode(
  node: ReactNode,
  language: AppLanguage,
  inheritedIgnore = false,
): ReactNode {
  if (typeof node === 'string') {
    return inheritedIgnore ? node : translateNarrative(node, language)
  }
  if (Array.isArray(node)) {
    return Children.map(node, (child) => translateNode(child, language, inheritedIgnore))
  }
  if (!isValidElement<{
    children?: ReactNode
    className?: string
    'data-original-opinion'?: string
    placeholder?: string
    title?: string
    'aria-label'?: string
    'aria-description'?: string
  }>(node)) {
    return node
  }
  const props = node.props
  const preserveOriginal = inheritedIgnore || props['data-original-opinion'] === 'true'
  const preserveBrand = (props.className ?? '').split(/\s+/).some((name) =>
    name === 'brand' || name === 'brand-light' || name === 'brand-mark')
  const ignoreChildren =
    preserveOriginal || preserveBrand || node.type === 'textarea' || node.type === 'input'
  const automaticDirection =
    language === 'ar' &&
    typeof node.type === 'string' &&
    /^(?:p|span|button|label|li|summary|th|td|dt|dd|h[1-6])$/u.test(node.type)
  const translatedProps = preserveOriginal
    ? props
    : {
        ...props,
        ...(automaticDirection ? { dir: 'auto' } : {}),
        ...(props.placeholder
          ? { placeholder: translateNarrative(props.placeholder, language) }
          : {}),
        ...(props.title ? { title: translateText(props.title, language) } : {}),
        ...(props['aria-label']
          ? { 'aria-label': translateNarrative(props['aria-label'], language) }
          : {}),
        ...(props['aria-description']
          ? { 'aria-description': translateNarrative(props['aria-description'], language) }
          : {}),
      }
  return cloneElement(node, {
    ...translatedProps,
    children: translateNode(props.children, language, ignoreChildren),
  })
}

export function LocalizedMarkup({ children }: { children: ReactNode }) {
  const { language } = useLocalization()
  return <>{Children.map(children, (child) => translateNode(child, language))}</>
}

export function LanguageSelector() {
  const { language, setLanguage, storageWarning } = useLocalization()
  return (
    <LocalizedMarkup>
      <label className="language-control">
        <span className="visually-hidden">Language</span>
        <select
          aria-label="Language"
          value={language}
          onChange={(event) => {
            const selected = event.currentTarget.value
            if (isAppLanguage(selected)) setLanguage(selected)
          }}
        >
          {APP_LANGUAGES.map(({ code, nativeLabel }) => (
            <option key={code} value={code} lang={code}>{nativeLabel}</option>
          ))}
        </select>
        {storageWarning && <span className="language-storage-warning" role="status">{storageWarning}</span>}
      </label>
    </LocalizedMarkup>
  )
}
