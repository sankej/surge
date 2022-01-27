/*
青龙 docker 每日自动同步 boxjs cookie
40 * * * https://raw.githubusercontent.com/dompling/Script/master/jd/ql_cookie_sync.js
 */

const $ = new API('ql', true)
const $ql = new QL_API()

const title = '🐉 通知提示'
let notify_log = ''
const envKeys = JSON.parse($.read('env_keys') || '[]')
const envData = envKeys
  .map((key) => {
    const value = $.read(`#${key}`)
    if (isJsonArrString(value)) {
      return JSON.parse(value).map(({ userName, cookie }) => ({
        name: key === 'CookiesJD' ? 'JD_COOKIE' : key,
        value: cookie,
        remarks: userName,
      }))
    }
    return {
      name: key,
      value: value || '',
      remarks: '',
    }
  })
  .flat()

;(async () => {
  try {
    await $ql.login()
    $.info(`青龙cookie登入同步`)

    for (const env of envData) {
      const { data: qlEnvs } = await $ql.getEnvs(env.name)
      const qlEnv =
        (qlEnvs && qlEnvs.length > 1
          ? qlEnvs.find((item) => item.remarks === env.remarks)
          : qlEnvs[0]) || false

      let response

      if (qlEnv) {
        if (qlEnv.value === env.value) {
          notify_log += $.info(`${env.name}-${env.remarks}: 无需更新\n`)
          continue
        }

        response = await $ql.editEnvs({ ...env, _id: qlEnv._id })
      } else {
        response = await $ql.addEnvs([env])
      }

      if (response.code === 200) {
        notify_log += $.info(`${env.name}-${env.remarks}: 同步青龙成功\n`)
      } else {
        notify_log += $.info(`${env.name}-${env.remarks}: 同步青龙失败\n`)
      }
    }

    if ($.read('mute') !== 'true') {
      $.notify(title, '同步青龙', notify_log)
    }
    $.done()
  } catch (e) {
    $.info(JSON.stringify(e))
    $.done()
  }
})()

function ENV() {
  const isQX = typeof $task !== 'undefined'
  const isLoon = typeof $loon !== 'undefined'
  const isSurge = typeof $httpClient !== 'undefined' && !isLoon
  const isJSBox = typeof require == 'function' && typeof $jsbox != 'undefined'
  const isNode = typeof require == 'function' && !isJSBox
  const isRequest = typeof $request !== 'undefined'
  const isScriptable = typeof importModule !== 'undefined'
  return { isQX, isLoon, isSurge, isNode, isJSBox, isRequest, isScriptable }
}

function HTTP(defaultOptions = { baseURL: '' }) {
  const { isQX, isLoon, isSurge, isScriptable, isNode } = ENV()
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
  const URL_REGEX =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/

  function send(method, options) {
    options = typeof options === 'string' ? { url: options } : options
    const baseURL = defaultOptions.baseURL
    if (baseURL && !URL_REGEX.test(options.url || '')) {
      options.url = baseURL ? baseURL + options.url : options.url
    }
    options = { ...defaultOptions, ...options }
    const timeout = options.timeout
    const events = {
      ...{
        onRequest: () => {},
        onResponse: (resp) => resp,
        onTimeout: () => {},
      },
      ...options.events,
    }

    events.onRequest(method, options)

    let worker
    if (isQX) {
      worker = $task.fetch({ method, ...options })
    } else if (isLoon || isSurge || isNode) {
      worker = new Promise((resolve, reject) => {
        const request = isNode ? require('request') : $httpClient
        request[method.toLowerCase()](options, (err, response, body) => {
          if (err) reject(err)
          else
            resolve({
              statusCode: response.status || response.statusCode,
              headers: response.headers,
              body,
            })
        })
      })
    } else if (isScriptable) {
      const request = new Request(options.url)
      request.method = method
      request.headers = options.headers
      request.body = options.body
      worker = new Promise((resolve, reject) => {
        request
          .loadString()
          .then((body) => {
            resolve({
              statusCode: request.response.statusCode,
              headers: request.response.headers,
              body,
            })
          })
          .catch((err) => reject(err))
      })
    }

    let timeoutid
    const timer = timeout
      ? new Promise((_, reject) => {
          timeoutid = setTimeout(() => {
            events.onTimeout()
            return reject(`${method} URL: ${options.url} exceeds the timeout ${timeout} ms`)
          }, timeout)
        })
      : null

    return (
      timer
        ? Promise.race([timer, worker]).then((res) => {
            clearTimeout(timeoutid)
            return res
          })
        : worker
    ).then((resp) => events.onResponse(resp))
  }

  const http = {}
  methods.forEach((method) => (http[method.toLowerCase()] = (options) => send(method, options)))
  return http
}

function API(name = 'untitled', debug = false) {
  const { isQX, isLoon, isSurge, isNode, isJSBox, isScriptable } = ENV()
  return new (class {
    constructor(name, debug) {
      this.name = name
      this.debug = debug

      this.http = HTTP()
      this.env = ENV()

      this.node = (() => {
        if (isNode) {
          const fs = require('fs')

          return {
            fs,
          }
        } else {
          return null
        }
      })()
      this.initCache()

      const delay = (t, v) =>
        new Promise(function (resolve) {
          setTimeout(resolve.bind(null, v), t)
        })

      Promise.prototype.delay = function (t) {
        return this.then(function (v) {
          return delay(t, v)
        })
      }
    }

    // persistance

    // initialize cache
    initCache() {
      if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || '{}')
      if (isLoon || isSurge) this.cache = JSON.parse($persistentStore.read(this.name) || '{}')

      if (isNode) {
        // create a json for root cache
        let fpath = 'root.json'
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(fpath, JSON.stringify({}), { flag: 'wx' }, (err) =>
            console.log(err),
          )
        }
        this.root = {}

        // create a json file with the given name if not exists
        fpath = `${this.name}.json`
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(fpath, JSON.stringify({}), { flag: 'wx' }, (err) =>
            console.log(err),
          )
          this.cache = {}
        } else {
          this.cache = JSON.parse(this.node.fs.readFileSync(`${this.name}.json`))
        }
      }
    }

    // store cache
    persistCache() {
      const data = JSON.stringify(this.cache)
      if (isQX) $prefs.setValueForKey(data, this.name)
      if (isLoon || isSurge) $persistentStore.write(data, this.name)
      if (isNode) {
        this.node.fs.writeFileSync(`${this.name}.json`, data, { flag: 'w' }, (err) =>
          console.log(err),
        )
        this.node.fs.writeFileSync('root.json', JSON.stringify(this.root), { flag: 'w' }, (err) =>
          console.log(err),
        )
      }
    }

    write(data, key) {
      this.log(`SET ${key}`)
      if (key.indexOf('#') !== -1) {
        key = key.substr(1)
        if (isSurge || isLoon) {
          return $persistentStore.write(data, key)
        }
        if (isQX) {
          return $prefs.setValueForKey(data, key)
        }
        if (isNode) {
          this.root[key] = data
        }
      } else {
        this.cache[key] = data
      }
      this.persistCache()
    }

    read(key) {
      this.log(`READ ${key}`)
      if (key.indexOf('#') !== -1) {
        key = key.substr(1)
        if (isSurge || isLoon) {
          return $persistentStore.read(key)
        }
        if (isQX) {
          return $prefs.valueForKey(key)
        }
        if (isNode) {
          return this.root[key]
        }
      } else {
        return this.cache[key]
      }
    }

    delete(key) {
      this.log(`DELETE ${key}`)
      if (key.indexOf('#') !== -1) {
        key = key.substr(1)
        if (isSurge || isLoon) {
          return $persistentStore.write(null, key)
        }
        if (isQX) {
          return $prefs.removeValueForKey(key)
        }
        if (isNode) {
          delete this.root[key]
        }
      } else {
        delete this.cache[key]
      }
      this.persistCache()
    }

    // notification
    notify(title, subtitle = '', content = '', options = {}) {
      const openURL = options['open-url']
      const mediaURL = options['media-url']

      if (isQX) $notify(title, subtitle, content, options)
      if (isSurge) {
        $notification.post(title, subtitle, content + `${mediaURL ? '\n多媒体:' + mediaURL : ''}`, {
          url: openURL,
        })
      }
      if (isLoon) {
        let opts = {}
        if (openURL) opts['openUrl'] = openURL
        if (mediaURL) opts['mediaUrl'] = mediaURL
        if (JSON.stringify(opts) == '{}') {
          $notification.post(title, subtitle, content)
        } else {
          $notification.post(title, subtitle, content, opts)
        }
      }
      if (isNode || isScriptable) {
        const content_ =
          content +
          (openURL ? `\n点击跳转: ${openURL}` : '') +
          (mediaURL ? `\n多媒体: ${mediaURL}` : '')
        if (isJSBox) {
          const push = require('push')
          push.schedule({
            title: title,
            body: (subtitle ? subtitle + '\n' : '') + content_,
          })
        } else {
          console.log(`${title}\n${subtitle}\n${content_}\n\n`)
        }
      }
    }

    // other helper functions
    log(msg) {
      if (this.debug) console.log(msg)
    }

    info(msg) {
      console.log(msg)
      return msg
    }

    error(msg) {
      console.log('ERROR: ' + msg)
    }

    wait(millisec) {
      return new Promise((resolve) => setTimeout(resolve, millisec))
    }

    done(value = {}) {
      if (isQX || isLoon || isSurge) {
        $done(value)
      } else if (isNode && !isJSBox) {
        if (typeof $context !== 'undefined') {
          $context.headers = value.headers
          $context.statusCode = value.statusCode
          $context.body = value.body
        }
      }
    }
  })(name, debug)
}

function QL_API() {
  return new (class QL {
    constructor() {
      this.$ = new API('ql', true)
      const ipAddress = this.$.read('ip') || ''
      this.baseURL = `http://${ipAddress}`
      this.account = {
        password: this.$.read('password'),
        username: this.$.read('username'),
      }
      if (!this.account.password || !this.account.username) return (this.ql = false)
    }

    ql = true
    headers = {
      'Content-Type': `application/json;charset=UTF-8`,
      Authorization: '',
    }

    getURL(key = '') {
      return `${this.baseURL}/api/envs${key}`
    }

    login() {
      const opt = {
        headers: this.headers,
        body: JSON.stringify(this.account),
        url: `${this.baseURL}/api/user/login`,
      }
      return this.$.http.post(opt).then((response) => {
        const loginRes = JSON.parse(response.body)
        if (loginRes.code !== 200) {
          return this.$.notify(title, '', loginRes.msg)
        }
        this.headers.Authorization = `Bearer ${loginRes.data.token}`
      })
    }

    getEnvs(keyword = '') {
      const opt = {
        url: this.getURL() + `?searchValue=${keyword}`,
        headers: this.headers,
      }
      return this.$.http.get(opt).then((response) => JSON.parse(response.body))
    }

    addEnvs(cookies) {
      const opt = {
        url: this.getURL(),
        headers: this.headers,
        body: JSON.stringify(cookies),
      }
      return this.$.http.post(opt).then((response) => JSON.parse(response.body))
    }

    editEnvs(ids) {
      const opt = {
        url: this.getURL(),
        headers: this.headers,
        body: JSON.stringify(ids),
      }
      return this.$.http.put(opt).then((response) => JSON.parse(response.body))
    }

    delEnvs(ids) {
      const opt = {
        url: this.getURL(),
        headers: this.headers,
        body: JSON.stringify(ids),
      }
      return this.$.http.delete(opt).then((response) => JSON.parse(response.body))
    }

    disabled(ids) {
      const opt = {
        url: this.getURL(`/disable`),
        headers: this.headers,
        body: JSON.stringify(ids),
      }
      return this.$.http.put(opt).then((response) => JSON.parse(response.body))
    }

    enabledEnvs(ids) {
      const opt = {
        url: this.getURL(`/enable`),
        headers: this.headers,
        body: JSON.stringify(ids),
      }
      return this.$.http.put(opt).then((response) => JSON.parse(response.body))
    }

    getUsername(ck) {
      if (!ck) return ''
      console.log(ck)
      return decodeURIComponent(ck.match(/pt_pin=(.+?);/)[1])
    }
  })()
}

function isJsonArrString(str) {
  try {
    return Array.isArray(JSON.parse(str))
  } catch (e) {
    return false
  }
}
