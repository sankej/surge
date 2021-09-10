const scriptName = $script.name
const airtcpCookieKey = 'airtcp_cookie'
const cnixCookieKey = 'cnix_cookie'
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
  cnix: {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-GB,zh-CN;q=0.9,zh;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Content-Length': 0,
    Host: 'sgi.anycast.gay',
    Origin: 'https://sgi.anycast.gay',
    Pragma: 'no-cache',
    Referer: 'https://sgi.anycast.gay/user',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
  },
}
const airportOption = {
  airtcp: {
    cookieKey: airtcpCookieKey,
    url: 'https://airtcp.vip/user/checkin',
    headers: headers.airtcp,
    callback: getAirTcpTraffic,
  },
  cnix: {
    cookieKey: cnixCookieKey,
    url: 'https://sgi.anycast.gay/user/checkin',
    headers: headers.cnix,
    callback: getAirTcpTraffic,
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
      // notify('Cookie没有变化，无需更新')
    }
  } catch (error) {
    log(error, 'ERROR')
    notify('获取Cookie出现异常，请查阅日志!')
  }
}

const checkin = (cookie, url, headers) => {
  return new Promise((resolve, reject) => {
    const options = {
      url,
      headers: {
        Cookie: cookie,
        ...headers,
      },
    }

    $httpClient.post(options, (err, response, data) => {
      if (err || response.status !== 200) {
        log(`签到失败, 请求异常: ${err}`, 'ERROR')
        reject('签到失败，请求异常, 请查阅日志!')
      } else {
        const { msg } = JSON.parse(data)
        log(msg)
        notify(msg)
        resolve(data)
      }
    })
  })
}

function getAirTcpTraffic(cookie, headers) {
  new Promise((resolve, reject) => {
    const options = {
      url: 'https://airtcp.vip/user',
      headers: {
        Cookie: cookie,
        ...headers,
      },
    }

    $httpClient.get(options, (err, response, data) => {
      if (err || response.status !== 200) {
        log(`签到失败, 请求异常: ${err}`, 'ERROR')
        reject('签到失败，请求异常, 请查阅日志!')
      } else {
        let res = data.match(new RegExp('(?=<span.*class="counter".*>).*?(?=</span)', 'gi'))
        const [memberDuration, remainTraffic] = res.map((item) => item.replace(/[^\d|.]*/gi, ''))
        const todayTraffic = unescape(data.match(new RegExp('(?=今日已用).*?(?=<)')))
        data = data.replace(/\r\n/g, '')
        data = data.replace(/\n/g, '')
        data = data.replace(/\s/g, '')
        const expirationDate = unescape(data.match(new RegExp('(?=標準套餐節點).*?(?=<)')))
        const msg = `会员时长: ${memberDuration} 天\n剩余流量: ${remainTraffic}TB  ${todayTraffic}\n${expirationDate}`
        log(msg)
        notify(msg)
        resolve(1)
      }
    })
  })
}

// function getCnixTraffic(cookie, headers, data) {
//   console.log(data)
// }

;(async () => {
  if (isRequest() && $script.type === 'http-request') {
    const cookieKey = $request.url.includes('airtcp') ? airtcpCookieKey : cnixCookieKey
    getCookie(cookieKey)
  } else {
    try {
      const { cookieKey, url, headers, callback } = airportOption[scriptName]
      const cookie = $persistentStore.read(cookieKey)
      const res = await checkin(cookie, url, headers)
      await callback(cookie, headers, res)
    } catch (error) {
      notify(error)
    }
  }
  $done()
})()
