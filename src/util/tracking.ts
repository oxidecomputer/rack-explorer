/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

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
