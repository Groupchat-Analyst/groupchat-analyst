import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  useContext,
  createContext,
  type ReactNode,
} from 'react'
import {
  APP_LANGUAGES,
  DEFAULT_LANGUAGE,
  translateNarrative,
  type AppLanguage,
} from '../../shared/src/localization'
import { localizeMatchText } from '../../shared/src/displayNames'
import { LocalizationContext, useLocalization } from './localizationContext'

const LANGUAGE_STORAGE_KEY = 'groupchat-analyst-language'
const DatasetIdContext = createContext<string | undefined>(undefined)

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
  datasetId?: string,
  inheritedIgnore = false,
): ReactNode {
  if (typeof node === 'string') {
    return inheritedIgnore
      ? node
      : localizeMatchText(translateNarrative(node, language), datasetId ?? '', language)
  }
  if (Array.isArray(node)) {
    return Children.map(node, (child) => translateNode(child, language, datasetId, inheritedIgnore))
  }
  if (!isValidElement<{
    children?: ReactNode
    className?: string
    'data-original-opinion'?: string
    'data-original-source'?: string
    label?: string
    placeholder?: string
    title?: string
    'aria-label'?: string
    'aria-description'?: string
  }>(node)) {
    return node
  }
  const props = node.props
  const preserveOriginal =
    inheritedIgnore ||
    props['data-original-opinion'] === 'true' ||
    props['data-original-source'] === 'true'
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
          ? {
              placeholder: localizeMatchText(
                translateNarrative(props.placeholder, language),
                datasetId ?? '',
                language,
              ),
            }
          : {}),
        ...(props.title
          ? { title: localizeMatchText(translateNarrative(props.title, language), datasetId ?? '', language) }
          : {}),
        ...(props.label
          ? { label: localizeMatchText(translateNarrative(props.label, language), datasetId ?? '', language) }
          : {}),
        ...(props['aria-label']
          ? {
              'aria-label': localizeMatchText(
                translateNarrative(props['aria-label'], language),
                datasetId ?? '',
                language,
              ),
            }
          : {}),
        ...(props['aria-description']
          ? {
              'aria-description': localizeMatchText(
                translateNarrative(props['aria-description'], language),
                datasetId ?? '',
                language,
              ),
            }
          : {}),
      }
  return cloneElement(node, {
    ...translatedProps,
    children: translateNode(props.children, language, datasetId, ignoreChildren),
  })
}

function LocalizedContent({
  children,
  datasetId,
}: {
  children: ReactNode
  datasetId?: string
}) {
  const { language } = useLocalization()
  return <>{Children.map(children, (child) => translateNode(child, language, datasetId))}</>
}

export function LocalizedMarkup({ children, datasetId }: { children: ReactNode; datasetId?: string }) {
  const inheritedDatasetId = useContext(DatasetIdContext)
  const activeDatasetId = datasetId ?? inheritedDatasetId
  return (
    <DatasetIdContext.Provider value={activeDatasetId}>
      <LocalizedContent datasetId={activeDatasetId}>{children}</LocalizedContent>
    </DatasetIdContext.Provider>
  )
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
