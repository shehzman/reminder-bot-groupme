require('dotenv').config({ path: '.env' });
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const axios = require('axios')
const { google } = require('googleapis');
const moment = require('moment-timezone');

class googleApi {
  constructor() {
    this.mostRecent = []
    moment.tz.setDefault("America/Chicago")
    this.dirUrl = "https://api.groupme.com/v3/direct_messages?token=" + process.env.token
    this.groupUrl = "https://api.groupme.com/v3/groups/" + process.env.group_id + "/messages?token=" + process.env.token
    this.broUrl = "https://api.groupme.com/v3/groups/" + process.env.bro_group + "/messages?token=" + process.env.token
    this.sisUrl = "https://api.groupme.com/v3/groups/" + process.env.sis_group + "/messages?token=" + process.env.token
    this.calid = process.env.cal_id
    this.init()
    this.setReminder()
    this.setWeeklyRem()
  }
  init() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.clientID,
      process.env.clientSecret,
    );
    this.oauth2Client.setCredentials({
      refresh_token: process.env.refreshToken
    })

    this.cal = google.calendar({ version: 'v3', auth: this.oauth2Client })


    this.oauth2Client.getAccessToken().then((resp) => {

      console.log(resp.token)

    }).catch(err => console.log(err))


  }


  callCal(id, isWeekly) {

    this.cal.events.list({
      calendarId: this.calid,
      showDeleted: false,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: moment().toISOString(),
      timeMax: this.getEndOfWeek()
    }).then(res => {

      var ev = res.data.items

      var events = []
      var i = 0

      var st;

      while (i < ev.length) {

        events.push(this.addEventList(ev[i], this.convertDateTime(ev[i].start)))
        i++
      }

      var greet = 'Assalamualaykum Everyone! '
      var indGreet = 'Assalamualaykum! '
      if (events.length == 0)
        this.sendMessage(id, (isWeekly ? greet : indGreet) + 'There are no events this week.', !isWeekly ? this.dirUrl : this.groupUrl)
      else
        this.sendMessage(id, (isWeekly ? greet : indGreet) + 'Here are the events for this week:\n' + this.splitEvents(events), !isWeekly ? this.dirUrl : this.groupUrl)


    }).catch(err => console.log(err))

  }
  convertDateTime(da) {
    if (da.hasOwnProperty('date')) {
      return moment(da.date)
    }
    else
      return moment(da.dateTime)
  }
  getEndOfWeek() {
    var e = moment()
    e.set('date', moment().date() + (6 + 7 - moment().day() - 1) % 7 + 1)
    e.set({ hour: 23, minute: 59, second: 59 })
    return e.toISOString()

  }

  splitEvents(even) {
    var mes = ''
    var jum
    var split = {
      amp: { name: 'AMP', events: [] },
      education: { name: 'Education', events: [] },
      interfaith: { name: 'Interfaith', events: [] },
      brothers: { name: "Brothers Social", events: [] },
      sisters: { name: "Sisters Social", events: [] },
      joint: { name: "Joint MSA", events: [] }

    }

    even.forEach(element => {
      var category = element.name.split(" ")[0].toLowerCase()

      if (category == 'jummah')
        jum = element
      else if (element.name.toLowerCase().startsWith('brothers social')) {
        element.name = element.name.substr(16)
        split['brothers'].events.push(element)
      }
      else if (element.name.toLowerCase().startsWith('sisters social')) {
        element.name = element.name.substr(15)
        split['sisters'].events.push(element)
      }
      else if (split.hasOwnProperty(category)) {

        element.name = element.name.substr(element.name.indexOf(" ") + 1)
        split[category].events.push(element)
      }
      else
        split['joint'].events.push(element)


    })
    for (var s in split) {
      if (split[s].events.length > 0)
        mes += split[s].name + ':\n'
      split[s].events.forEach(elem => {
        mes += (this.formatEventStr(elem) + '\n')
      })
    }
    if (jum !== undefined)
      mes += this.formatEventStr(jum)
    else if (this.isJum() && moment().day() != 6)
      mes += 'There are no Jummah Prayers this week.'
    return mes
  }
  isJum() {
    var j = moment()

    j.set('date', j.date() + (5 + 7 - j.day()) % 7)
    j.set({ hour: 14, minute: 30, second: 0 })
    return moment().isBefore(j)
  }
  formatEventStr(str) {

    var s = moment(str.start)
    return str.name + this.compDates(s) + this.dateString(str.start, str.end) + (str.link !== '' ? '. The link/location is ' + str.link : '')

  }

  compDates(dat) {

    var comp = dat.diff(moment())
    var tom = moment()
    tom.set('date', tom.date() + 1)
    var min = this.convertToMinutes(comp)
    if (comp > 0 && comp < 3600000)
      return ' is starting in ' + min + (min == 1 ? ' minute' : ' minutes')
    else if (comp <= 0)
      return ' is happening now'
    else if (dat.isSame(moment(), 'day'))
      return ' is today'
    else if (dat.isSame(tom, 'day'))
      return ' is tomorrow'
    else
      return ' is on ' + dat.format('dddd MMMM Do')
  }
  dateString(startDate, endDate) {
    var sd = moment(startDate)
    var ed = moment(endDate)

    return ' from ' + sd.format('h:mm A') + ' - ' + (!sd.isSame(ed, 'day') ? ed.format('dddd MMMM Do') + ' at ' : '') + ed.format('h:mm A')


  }
  addEventList(a, st) {

    return { name: a.summary !== undefined ? a.summary : 'No Name', start: st.toISOString(), end: this.convertDateTime(a.end).toISOString(), link: a.hasOwnProperty('location') ? a.location : '' }
  }
  async sendMessage(id, message, ur) {

    var opt = {
      url: ur,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8'
      },
      data: {
        "message": {

          "text": ""
        }
      }

    }
    if (ur === this.dirUrl)
      opt.data.message.recipient_id = id

    var ex = Math.floor(message.length / 1000)
    var mod = message.length % 1000

    for (var i = 0; i < ex; i++) {

      try {
        console.log('sending')
        opt.data.message.text = message.substr(i * 1000, 1000)
        await axios(opt)

      }
      catch (error) {
        console.log(error)

      }



    }
    if (mod > 0) {

      //console.log(options.data.direct_message.text)
      console.log('sending')
      try {
        opt.data.message.text = message.substr(i * 1000, mod)
        await axios(opt)

      }
      catch (error) {
        console.log(error)
      }


    }

  }
  getBegOfWeek() {
    var b = moment()

    b.set('date', b.date() + (1 + 7 - b.day() - 1) % 7 + 1)
    b.set({ hour: 8, minute: 0, second: 0 })
    return b.diff(moment())
  }
  setWeeklyRem() {
    console.log(this.getBegOfWeek())
    setTimeout(() => {
      this.callCal('', true)
      this.setWeeklyRem()

    }, this.getBegOfWeek());
  }
  setReminder() {

    setInterval(() => {

      for (var i = 0; i < this.mostRecent.length; i++) {

        if (moment().isAfter(moment(this.mostRecent[i].start))) {
          this.mostRecent.splice(i, 1)
          i--
        }
      }
      console.log('removal', this.mostRecent)
    }, 3600000);
    setInterval(() => {

      this.cal.events.list({
        calendarId: this.calid,
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: moment().toISOString(),
        timeMax: moment(moment().valueOf() + 3600000).toISOString()
      }).then(res => {

        var re = res.data.items
        var ind

        re.forEach(elem => {
          if ((ind = this.reminderExists(this.addEventList(elem, this.convertDateTime(elem.start)), elem.id)) != -1) {
            console.log('rec')
            var format = 'Assalamualaykum Everyone! Just a reminder that the event ' + this.formatEventStr(this.mostRecent[ind])
            var br = this.mostRecent[ind].name.toLowerCase().startsWith('brothers social')
            var si = this.mostRecent[ind].name.toLowerCase().startsWith('sisters social')
            this.sendGroup(format, br, si)

          }

        })
        console.log(this.mostRecent)


      }).catch(error => console.log(error))
    }, 150000);
  }
  sendGroup(mes, bro, sis) {
    this.sendMessage('', mes, this.groupUrl)
    if (bro) {
      this.sendMessage('', mes, this.broUrl)
    }
    else if (sis)
      this.sendMessage('', mes, this.sisUrl)
  }
  convertToMinutes(mill) {
    return Math.ceil(mill / 60000)
  }
  reminderExists(remind, id) {
    var st = moment(remind.start)
    var en = moment(remind.end)

    var i = 0
    var breakOut = false
    var ind = -1
    if (st.isBefore(moment()))
      return ind
    while (i < this.mostRecent.length && !breakOut) {
      if (id === this.mostRecent[i].id) {
        breakOut = true
        this.mostRecent[i].name = remind.name
        var br = this.mostRecent[i].name.toLowerCase().startsWith('brothers social')
        var si = this.mostRecent[i].name.toLowerCase().startsWith('sisters social')
        if (this.mostRecent[i].link !== remind.link) {
          this.mostRecent[i].link = remind.link
          this.sendGroup('Assalamualaykum Everyone! The Zoom link for the event ' + this.mostRecent[i].name + ' has been changed. It is now ' + this.mostRecent[i].link, br, si)
        }

        if (!st.isSame(moment(this.mostRecent[i].start)) || !en.isSame(moment(this.mostRecent[i].end))) {
          this.mostRecent[i].start = st.toISOString()
          this.mostRecent[i].end = en.toISOString()
          this.sendGroup('Assalamualaykum Everyone! The time for the event ' + this.mostRecent[i].name + ' has been changed. It ' + this.compDates(moment(this.mostRecent[i].start)) + this.dateString(this.mostRecent[i].start, this.mostRecent[i].end), br, si)

        }


      }

      i++
    }
    if (!breakOut) {
      this.mostRecent.push(remind)
      ind = this.mostRecent.length - 1
      this.mostRecent[ind].id = id
    }
    return ind


  }
}
module.exports = googleApi;


