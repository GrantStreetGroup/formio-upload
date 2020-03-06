const fs = require('fs');
const Provider = require('./provider');
const crypto = require('crypto')
const axios = require('axios');

function signMessage(dateStr, params) {
  //TODO: secret token
  const token = "token"
  let str = ""
  keys = Object.keys(params)
  keys.sort()
  for (const key of keys) {
    str += key + ":" + params[key]
  }
  str += dateStr

  return crypto.createHmac('sha1', token)
    .update(str)
    .digest('hex')
}

function getContent(dateStr, messageParams) {
  return `{"hmac":"${signMessage(dateStr, messageParams)}","date":"${dateStr}","message":${JSON.stringify(messageParams)}}`
}

class GucProvider extends Provider {
  static auth(req, res, next) {
    req.debug('Authenticating');
    //I don't think anythin needs to be done here. COuld leave this func out.
    next();
  }

  static upload(file, dir) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let headers = {
      "X-Blithe-Context" : "{}",
      "Content-Type" : "text/x-json; charset=utf-8",
      "X-Blithe-Version" : "2.0",
      "Accept" : "text/x-json"
    }
    let content = getContent("03/05/20 10:27AM",{application: "dev-formio"})
    
    axios.post('https://test.gsgusercontent.com/api/request_upload', content, { headers: headers}).then((response) => {
      //make actual upload request
      console.log(response.data)
      axios.post(response.data.return.upload_uri, {name: "filename", file: file}).then((r) => {
        console.log(r.data)
        next()
      }).catch((error) => {
        console.log(error.response.data)
        //No upload found in request.
        next(error.response.data)
      })
    })
  }

  static download(fileId, req, res) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    headers = {
      "X-Blithe-Context" : "{}",
      "Content-Type" : "text/x-json; charset=utf-8",
      "X-Blithe-Version" : "2.0",
      "Accept" : "text/x-json"
    }
    content = getContent("03/05/20 10:27AM", {application: "dev-formio", file_uuid: fileId})
    axios.post('https://test.gsgusercontent.com/api/request_download', content, { headers: headers}).then((response) => {
      console.log(response.data)
      console.log(response.data.return.download_uri)
      axios.post(response.data.return.download_uri).then((r) => {
        console.log(r.data)
        res.send(r.data)
        next()
      }).catch((error) => {
        console.log(error.response.data)
        next(error.response.data)
      })
    })
  }
}

module.exports = GucProvider;