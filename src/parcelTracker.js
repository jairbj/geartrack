'use strict';

const request = require('requestretry')
const parser = require('cheerio')
const utils = require('./utils')
const moment = require('moment-timezone')
const zone = "Europe/Madrid" // +1h

const URL = 'https://parceltracking.pb.com/tracking/services/v1/track-packages/{{id}}'

const correos = {}

/**
 * Get parcel tracker info
 * Async
 *
 * Design changes may break this code!!
 * @param id
 * @param callback(Error, ParcelTrackerInfo)
 */
correos.getInfo = function (id, callback) {
    obtainInfo(URL.replace("{{id}}", id), callback)
}

/**
 * Get info from parcel tracker request
 *
 * @param action
 * @param id
 * @param cb
 */
function obtainInfo(action, cb) {
    request.get({
        url: action,
        timeout: 30000,
        strictSSL: false
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            cb(utils.getError('DOWN'))
            return
        }

        // Not found
        if (body.indexOf('errorMessage') != -1) {
            cb(utils.getError('NO_DATA'))
            return
        }

        let entity = null
        try {
            entity = createParcelTrackerEntity(body)
        } catch (error) {
            console.log(error);
            return cb(utils.getError('PARSER'))
        }

        if(entity != null) cb(null, entity)
    })
}

/**
 * Create parcel tracker entity from html
 * @param html
 */
function createParcelTrackerEntity(body) {

    const data = JSON.parse(body)

    const states = []
    data.scanHistory.scanDetails.forEach((elem) => {
        const state = {
            state : elem.eventDescription,
            date : elem.eventDate + "T" + elem.eventTime
        }
        if(elem.eventLocation && elem.eventLocation.country
            && elem.eventLocation.countyOrRegion
            && elem.eventLocation.city){
            state.area = elem.eventLocation.country
                + " - " + elem.eventLocation.countyOrRegion
                + " - " + elem.eventLocation.city
        }
        states.push(state)
    })

    return new ParcelTrackerInfo({
        attempts: 1,
        id: data.packageIdentifier,
        state: data.currentStatus.eventDescription,
        carrier: data.carrier,
        origin: data.senderLocation.country
            + " - " + data.senderLocation.countyOrRegion
            + " - " + data.senderLocation.city,
        destiny: data.destinationLocation.country
            + " - " + data.destinationLocation.countyOrRegion
            + " - " + data.destinationLocation.city,
        states: states
    })
}

/*
 |--------------------------------------------------------------------------
 | Entity
 |--------------------------------------------------------------------------
 */
function ParcelTrackerInfo(obj) {
    this.id = obj.id
    this.state = obj.state
    this.state2 = obj.state2
    this.deliveryDate = obj.deliveryDate
    this.states = obj.states.reverse()
    this.origin = obj.origin,
    this.destiny = obj.destiny
    this.trackerWebsite = "https://parceltracking.pb.com/app/#/dashboard/" + this.id
}

module.exports = correos