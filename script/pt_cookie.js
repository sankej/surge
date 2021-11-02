const scriptName = $script.name
const cookieKeys = ['hdarea', 'hdatmos']

const sleep = (e) => new Promise((t) => setTimeout(t, e))
const isRequest = () => typeof $request !== 'undefined' && typeof $response === 'undefined'
const notify = (msg) => $notification.post(scriptName, '', msg)
const log = (msg, type = 'INFO') => console.log(`[${type}] [${scriptName}]\n${msg}\n`)

const getCookie = (cookieKey) => {
  try {
    const cookie = $request.headers.cookie
    const preCookie = $persistentStore.read(cookieKey)
    const compareKey = !!cookie
      ? /cf_clearance=([a-z_A-Z0-9-\.!@#\$%\\\^&\*\)\(\+=\{\}\[\]\/",'<>~\·`\?:|]*)/.exec(cookie)[1]
      : null
    const comparePreKey = !!preCookie
      ? /cf_clearance=([a-z_A-Z0-9-\.!@#\$%\\\^&\*\)\(\+=\{\}\[\]\/",'<>~\·`\?:|]*)/.exec(
          preCookie,
        )[1]
      : null

    if (!preCookie || comparePreKey !== compareKey) {
      $persistentStore.write(cookie, cookieKey)
      log(`旧的Cookie: ${preCookie}\n新的Cookie: ${cookie}\nCookie不同，写入新的Cookie成功！`)
      notify('Cookie写入成功!')
    } else {
      log('Cookie没有变化，无需更新')
      // notify('Cookie没有变化，无需更新')
    }
  } catch (error) {
    log(error, 'ERROR')
    notify('获取Cookie出现异常，请查阅日志!')
  }
}

;(async () => {
  if (isRequest() && $script.type === 'http-request') {
    const cookieKey = cookieKeys.find((key) => $request.url.includes(key))
    getCookie(`${cookieKey}_cookie`)
  }
  $done()
})()
