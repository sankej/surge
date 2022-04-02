const scriptName = $script.name
const airtcpCookieKey = 'airtcp_cookie'
const headers = {
  airtcp: {
    Accept: 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-cn',
    Connection: 'keep-alive',
    'Content-Type': 'application/json;charset=utf-8',
    Host: 'airtcp.vip',
    Referer: 'https://airtcp.vip/',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36',
  },
}
const sleep = (e) => new Promise((t) => setTimeout(t, e))
const isRequest = () => typeof $request !== 'undefined' && typeof $response === 'undefined'
const notify = (msg) => $notification.post(scriptName, '', msg)
const log = (msg, type = 'INFO') => console.log(`[${type}] [${scriptName}]\n${msg}\n`)

const getCookie = (cookieKey) => {
  try {
    const cookie = $request.headers.Cookie
    const preCookie = $persistentStore.read(cookieKey)
    const compareKey = !!cookie ? /key=([a-zA-Z0-9]*)/.exec(cookie)[1] : null
    const comparePreKey = !!preCookie ? /key=([a-zA-Z0-9]*)/.exec(preCookie)[1] : null

    if (!preCookie || comparePreKey !== compareKey) {
      $persistentStore.write(cookie, cookieKey)
      log(`旧的Cookie: ${preCookie}\n新的Cookie: ${cookie}\nCookie不同，写入新的Cookie成功！`)
      notify('Cookie写入成功!')
    } else {
      log('Cookie没有变化，无需更新')
    }
  } catch (error) {
    log(error, 'ERROR')
    notify('获取Cookie出现异常，请查阅日志!')
  }
}

;(async () => {
  if (isRequest() && $script.type === 'http-request') {
    getCookie(airtcpCookieKey)
  }
  $done()
})()
