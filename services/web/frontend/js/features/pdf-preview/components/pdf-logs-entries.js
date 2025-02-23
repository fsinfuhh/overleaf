import { memo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneMaxEntries from '../../preview/components/preview-logs-pane-max-entries'
import PdfLogEntry from './pdf-log-entry'
import { useIdeContext } from '../../../shared/context/ide-context'

const LOG_PREVIEW_LIMIT = 100

function PdfLogsEntries({ entries, hasErrors }) {
  const { t } = useTranslation()

  const ide = useIdeContext()

  const syncToEntry = useCallback(
    entry => {
      const entity = ide.fileTreeManager.findEntityByPath(entry.file)

      if (entity && entity.type === 'doc') {
        ide.editorManager.openDoc(entity, {
          gotoLine: entry.line ?? undefined,
          gotoColumn: entry.column ?? undefined,
        })
      }
    },
    [ide]
  )

  const logEntries = entries.slice(0, LOG_PREVIEW_LIMIT)

  return (
    <>
      {entries.length > LOG_PREVIEW_LIMIT && (
        <PreviewLogsPaneMaxEntries
          totalEntries={entries.length}
          entriesShown={LOG_PREVIEW_LIMIT}
          hasErrors={hasErrors}
        />
      )}
      {logEntries.map(logEntry => (
        <PdfLogEntry
          key={logEntry.key}
          headerTitle={logEntry.message}
          rawContent={logEntry.content}
          logType={logEntry.type}
          formattedContent={logEntry.humanReadableHintComponent}
          extraInfoURL={logEntry.extraInfoURL}
          level={logEntry.level}
          entryAriaLabel={t('log_entry_description', {
            level: logEntry.level,
          })}
          sourceLocation={{
            file: logEntry.file,
            line: logEntry.line,
            column: logEntry.column,
          }}
          onSourceLocationClick={syncToEntry}
        />
      ))}
    </>
  )
}
PdfLogsEntries.propTypes = {
  entries: PropTypes.arrayOf(PropTypes.object),
  hasErrors: PropTypes.bool,
}

export default memo(PdfLogsEntries)
