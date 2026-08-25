export type GatewayMode = 'demo' | 'staging' | 'live'

const requestedMode = import.meta.env.VITE_GATEWAY_MODE

export const GATEWAY_MODE: GatewayMode =
  requestedMode === 'staging' || requestedMode === 'live' ? requestedMode : 'demo'

export const IS_DEMO_MODE = GATEWAY_MODE === 'demo'

export const featureFlags = Object.freeze({
  volunteerHelp: true,
  paidHelp: false,
  providerOnboarding: false,
  publicStories: false,
  publicDreamPublishing: false,
  groupJoining: false,
  eventRsvp: false,
  realtimeChat: false,
  liveRewardsGifting: false,
  liveRewardsGiving: false,
  liveRewardsRedemption: false,
  liveVendorQuotes: false,
  liveVendorOrdering: false,
})
