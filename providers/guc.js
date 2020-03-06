const fs = require('fs');
const Provider = require('./provider');
const crypto = require('crypto')
const axios = require('axios');

function signMessage(dateStr, params) {
  let str = ""
  keys = Object.keys(params)
  keys.sort()
  for (const key of keys) {
    str += key + ":" + params[key]
  }
  str += dateStr

  return crypto.createHmac('sha1', process.env.GUC_TOKEN)
    .update(str)
    .digest('hex')
}

function getContent(dateStr, messageParams) {
  return `{"hmac":"${signMessage(dateStr, messageParams)}","date":"${dateStr}","message":${JSON.stringify(messageParams)}}`
}

class GucProvider extends Provider {

  static upload(file, dir) {
    let headers = {
      "X-Blithe-Context" : "{}",
      "Content-Type" : "text/x-json; charset=utf-8",
      "X-Blithe-Version" : "2.0",
      "Accept" : "text/x-json"
    }
    const now = new Date()
    let content = getContent(now.toISOString(),{application: process.env.GUC_APPLICATION})
    
    axios.post('https://test.gsgusercontent.com/api/request_upload', content, { headers: headers}).then((response) => {
      console.log(response.data.return)
      //make actual upload request
      let formData = new FormData();
      formData.append('filename', file, {'filename': 'filename'})
      
      axios.post(response.data.return.upload_uri, formData, {headers: formData.getHeaders()} ).then((r) => {
        console.log(r.data)
        next()
      }).catch((error) => {
        console.log(error.response.data)
        next(error.response.data)
      })
    })
  }

  static download(fileId, req, res) {
    headers = {
      "X-Blithe-Context" : "{}",
      "Content-Type" : "text/x-json; charset=utf-8",
      "X-Blithe-Version" : "2.0",
      "Accept" : "text/x-json"
    }
    const now = new Date()
    content = getContent(now.toISOString(), {application: process.env.GUC_APPLICATION, file_uuid: fileId})
    axios.post('https://test.gsgusercontent.com/api/request_download', content, { headers: headers}).then((response) => {
      axios.post(response.data.return.download_uri).then((r) => {
        res.send(r.data) //not sure about this
        console.log(r.data)
        next()
      }).catch((error) => {
        console.log(error.response.data)
        next(error.response.data)
      })
    })
  }
}

module.exports = GucProvider;