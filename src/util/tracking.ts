import Cookies from 'js-cookie'

const TRACKING_COOKIE_NAME = 'ox-accept-tracking'
const ACCEPTED = 'true'
const REJECTED = 'false'

export function hasAcceptedTracking() {
  return Cookies.get(TRACKING_COOKIE_NAME) === ACCEPTED
}

export function hasTrackingChoice() {
  return Cookies.get(TRACKING_COOKIE_NAME) !== undefined
}

function setTracking(value: 'true' | 'false') {
  Cookies.set(TRACKING_COOKIE_NAME, value, {
    sameSite: 'strict',
    expires: 365, // the lib uses days for expires
  })
}

export function acceptTracking() {
  setTracking(ACCEPTED)
}

export function rejectTracking() {
  setTracking(REJECTED)
}
