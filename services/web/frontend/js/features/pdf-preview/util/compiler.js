import { isMainFile } from './editor-files'
import getMeta from '../../../utils/meta'
import { deleteJSON, postJSON } from '../../../infrastructure/fetch-json'
import { debounce } from 'lodash'
import { trackPdfDownload } from '../../../ide/pdf/controllers/PdfJsMetrics'

const AUTO_COMPILE_MAX_WAIT = 5000
// We add a 2 second debounce to sending user changes to server if they aren't
// collaborating with anyone. This needs to be higher than SINGLE_USER_FLUSH_DELAY, and allow for
// client to server latency, otherwise we compile before the op reaches the server
// and then again on ack.
const AUTO_COMPILE_DEBOUNCE = 2500

const searchParams = new URLSearchParams(window.location.search)

export default class DocumentCompiler {
  constructor({
    project,
    setChangedAt,
    setCompiling,
    setData,
    setFirstRenderDone,
    setError,
    cleanupCompileResult,
    signal,
  }) {
    this.project = project
    this.setChangedAt = setChangedAt
    this.setCompiling = setCompiling
    this.setData = setData
    this.setFirstRenderDone = setFirstRenderDone
    this.setError = setError
    this.cleanupCompileResult = cleanupCompileResult
    this.signal = signal

    this.clsiServerId = null
    this.currentDoc = null
    this.error = undefined
    this.timer = 0

    this.debouncedAutoCompile = debounce(
      () => {
        this.compile({ isAutoCompileOnChange: true })
      },
      AUTO_COMPILE_DEBOUNCE,
      {
        maxWait: AUTO_COMPILE_MAX_WAIT,
      }
    )
  }

  // The main "compile" function.
  // Call this directly to run a compile now, otherwise call debouncedAutoCompile.
  async compile(options = {}) {
    // only compile if the feature flag is enabled
    if (!window.showNewPdfPreview) {
      return
    }

    // set "compiling" to true (in the React component's state), and return if it was already true
    let wasCompiling

    this.setCompiling(oldValue => {
      wasCompiling = oldValue
      return true
    })

    if (wasCompiling) {
      if (options.isAutoCompileOnChange) {
        this.debouncedAutoCompile()
      }
      return
    }

    try {
      // reset values
      this.setChangedAt(0)
      this.validationIssues = undefined

      window.dispatchEvent(new CustomEvent('flush-changes')) // TODO: wait for this?

      const params = this.buildCompileParams(options)

      const t0 = performance.now()

      const data = await postJSON(
        `/project/${this.project._id}/compile?${params}`,
        {
          body: {
            rootDoc_id: this.getRootDocOverrideId(),
            draft: this.draft,
            check: 'silent', // NOTE: 'error' and 'validate' are possible, but unused
            // use incremental compile for all users but revert to a full compile
            // if there was previously a server error
            incrementalCompilesEnabled: !this.error,
          },
          signal: this.signal,
        }
      )
      const compileTimeClientE2E = performance.now() - t0
      const { firstRenderDone } = trackPdfDownload(data, compileTimeClientE2E)
      this.setFirstRenderDone(() => firstRenderDone)
      data.options = options
      if (data.clsiServerId) {
        this.clsiServerId = data.clsiServerId
      }
      this.setData(data)
    } catch (error) {
      console.error(error)
      this.cleanupCompileResult()
      this.setError(error.info?.statusCode === 429 ? 'rate-limited' : 'error')
    } finally {
      this.setCompiling(false)
    }
  }

  // parse the text of the current doc in the editor
  // if it contains "\documentclass" then use this as the root doc
  getRootDocOverrideId() {
    // only override when not in the root doc itself
    if (this.currentDoc.doc_id !== this.project.rootDoc_id) {
      const snapshot = this.currentDoc.getSnapshot()

      if (snapshot && isMainFile(snapshot)) {
        return this.currentDoc.doc_id
      }
    }

    return null
  }

  // build the query parameters added to post-compile requests
  buildPostCompileParams() {
    const params = new URLSearchParams()

    // the id of the CLSI server that processed the previous compile request
    if (this.clsiServerId) {
      params.set('clsiserverid', this.clsiServerId)
    }

    return params
  }

  // build the query parameters for the compile request
  buildCompileParams(options) {
    const params = new URLSearchParams()

    // note: no clsiserverid query param is set on "compile" requests,
    // as this is added in the backend by the web api

    // tell the server whether this is an automatic or manual compile request
    if (options.isAutoCompileOnLoad || options.isAutoCompileOnChange) {
      params.set('auto_compile', 'true')
    }

    // use the feature flag to enable PDF caching in a ServiceWorker
    if (getMeta('ol-enablePdfCaching')) {
      params.set('enable_pdf_caching', 'true')
    }

    // use the feature flag to enable "file line errors"
    if (searchParams.get('file_line_errors') === 'true') {
      params.file_line_errors = 'true'
    }

    return params
  }

  // send a request to stop the current compile
  stopCompile() {
    // NOTE: no stoppingCompile state, as this should happen fairly quickly
    // and doesn't matter if it runs twice.

    const params = this.buildPostCompileParams()

    return postJSON(`/project/${this.project._id}/compile/stop?${params}`, {
      signal: this.signal,
    })
      .catch(error => {
        console.error(error)
        this.setError('error')
      })
      .finally(() => {
        this.setCompiling(false)
      })
  }

  // send a request to clear the cache
  clearCache() {
    const params = this.buildPostCompileParams()

    return deleteJSON(`/project/${this.project._id}/output?${params}`, {
      signal: this.signal,
    }).catch(error => {
      console.error(error)
      this.setError('clear-cache')
    })
  }
}
