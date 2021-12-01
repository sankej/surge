const scriptName = 'Gist_Sync'

const notify = (msg) => $notification.post(scriptName, '', msg)
const v4IP = $network.v4.primaryAddress
const script_text =
  "const scriptName :  'Gist_Sync'\nconst notify = (msg) => $notification.post(scriptName, '', msg)\nconst log = (msg, type = 'INFO') => console.log(`[${type}] [${scriptName}]\\n${msg}\\n`)\n\nconst getScript = () => {\n  return new Promise((resolve, reject) => {\n    $httpClient.get(\n      {\n        url: 'https://raw.githubusercontent.com/sankej/surge/main/script/gist_restore.js',\n      },\n      (err, response, data) => {\n        if (err || response.status !== 200) {\n          log(`获取脚本失败, 请求异常: ${err}`, 'ERROR')\n          reject('获取脚本失败，请求异常, 请查阅日志!')\n        } else {\n          resolve(data)\n        }\n      },\n    )\n  })\n}\n\n;(async () => {\n  try {\n    const script = await getScript()\n    eval(script)\n  } catch (error) {\n    notify(error)\n  }\n  $done()\n})()"

const sync = (url) => {
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/v1/scripting/evaluate`,
      headers: {
        'X-Key': $persistentStore.read('gist_examplekey'),
        Accept: '*/*',
      },
      body: {
        script_text,
        mock_type: 'cron',
        timeout: 30,
      },
    }

    $httpClient.post(options, (err, response, data) => {
      if (err || response.status !== 200) {
        reject()
      } else {
        resolve()
      }
    })
  })
}

;(async () => {
  try {
    let urls = JSON.parse($persistentStore.read('gist_sync_url') || '[]')
    urls = urls.filter((item) => !item.includes(v4IP))
    for (const url of urls) {
      await sync(url)
    }
    notify('同步成功')
  } catch (error) {
    notify('同步失败')
  }
  $done()
})()
