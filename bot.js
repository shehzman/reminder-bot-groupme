
const WebSocket = require('ws')
var ws;
const goog = require('./remind')
var g = new goog()
const axios = require('axios');
var errCount = 0
var ids = []
var checkID
const can = axios.CancelToken
var source
var count
var isCancel = true
var errCount = 0
require('dotenv').config({ path: '.env' });
var options = {
  url: "https://push.groupme.com/faye",
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8'
  },
  data: {}

}


var con = {

  "channel": "/meta/handshake",
  "version": "1.0",
  "supportedConnectionTypes": ["long-polling", "websocket"],
  "id": "1",

}



var usr = {
  "channel": "/meta/subscribe",
  "clientId": "",
  "subscription": "/user/" + process.env.usrID,
  "id": "2",
  "ext":
  {
    "access_token": process.env.token
  }
}
var resp = {
  "channel": "/meta/connect",
  "clientId": "",
  "connectionType": "websocket",
  "id": "3"
}

var resp_2 = {
  "channel": "/meta/connect",
  "clientId": "",
  "connectionType": "long-polling",
  "id": "4"
}

function messageExists(ex, ind) {

  return ex !== 'undefined' && typeof ex[ind] !== 'undefined' && typeof ex[ind].data !== 'undefined' && typeof ex[ind].data.type !== 'undefined'
}

function sendMessage(res, ind = 0) {
  //var mes=JSON.parse(res)

  var mes = res
  //console.log(mes)
  if (messageExists(mes, ind) && mes[ind].data.type === 'direct_message.create') {
    mes = mes[ind].data.subject

    if ((mes.sender_id !== process.env.usrID) && ((!checkID) || (checkID && !ids.includes(mes.id)))) {
      console.log('Name: ' + mes.name)
      g.callCal(mes.sender_id, false)
      if (checkID)
        ids.push(mes.id)

    }
  }
}
const onopen = () => {
  errCount = 0
  ws.send(JSON.stringify(resp))
  console.log('sent')
  if (source !== undefined && !isCancel) {
    source.cancel('got websocket connection')
    isCancel = true
  }
  prevClient = usr.clientId
  setTimeout(() => {
    checkID = false
    ids = []
  }, 3000);


}


const onclose = function (e) {

}

const onerror = function (err) {
  if (isCancel) {
    count = 4
    checkID = true
    isCancel = false
    poll()
  }
  console.log('err')
  errCount++
  setTimeout(() => {
    if (errCount < 5)
      c()

  }, 1000)


}

const onmessage = (res) => {

  sendMessage(JSON.parse(res.data))
}

async function connect() {
  try {
    checkID = true
    options.data = con
    var res
    res = await axios(options)
    console.log(res.data)
    if (!res.data[0].successful) {

      return false
    }

    usr.clientId = resp.clientId = res.data[0].clientId
    console.log(usr.clientId)
    options.data = usr
    res = await axios(options)
    console.log(res.data)
    if (!res.data[0].successful) {
      return false
    }
    console.log('Error Count:', errCount)
    conSock()
    return true
  }

  catch (error) {
    console.log(error.response)
    return false
  }
}

function conSock() {
  if (ws !== undefined)
    ws.close()
  ws = new WebSocket('https://push.groupme.com/faye')
  ws.addEventListener('open', onopen)
  ws.addEventListener('message', onmessage)
  ws.addEventListener('close', onclose)
  ws.addEventListener('error', onerror)
}
function timeout() {
  return new Promise(resolve => setTimeout(resolve, 1000))
}
async function c() {

  var x
  var count = 0
  do {
    x = await connect()
    if (!x)
      await timeout()
    count++
  } while (!x && count < 5)

}

c()

setInterval(() => {
  console.log('connect')
  c()
  console.log('connection made')
}, 600000);


function poll() {
  console.log('polling')
  source = can.source();
  resp_2.clientId = prevClient
  resp_2.id = count++
  axios({
    url: "https://push.groupme.com/faye",
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=UTF-8'
    },
    cancelToken: source.token,
    data: resp_2
  }
  ).then(res => {
    console.log(res.data.length)
    for (var i = 1; i < res.data.length; i++) {
      console.log('went in')
      sendMessage(res.data, i)

    }
    if (!isCancel)
      poll()


  }).catch(err => {
    if (axios.isCancel(err)) {
      console.log(err.message);
    }
    else
      console.log(err)
  })

}