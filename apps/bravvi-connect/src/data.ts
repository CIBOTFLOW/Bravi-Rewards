import type { ActivityTone } from './types'

export const dreamStories = [
  {
    id: 'dream-laptop',
    title: 'A laptop for coding school',
    region: 'San Mateo County',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    state: 'Following',
  },
  {
    id: 'dream-studio',
    title: 'A small pottery studio',
    region: 'Oakland area',
    image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=600&q=80',
    state: 'New',
  },
  {
    id: 'dream-trip',
    title: 'A family nature trip',
    region: 'Bay Area',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
    state: 'Update',
  },
]

export const feedItems = [
  {
    id: 'feed-work-boots',
    kind: 'Work & equipment',
    title: 'Work boots for a new warehouse position',
    caption: 'A verified request is waiting for human review. No funding decision has been made.',
    region: 'Peninsula area',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80',
    status: 'Reviewing',
    verified: true,
  },
  {
    id: 'feed-community',
    kind: 'Community',
    title: 'Saturday pantry sorting',
    caption: 'A neighborhood group is organizing a two-hour volunteer session.',
    region: 'San Mateo area',
    image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1000&q=80',
    status: 'Volunteer event',
    verified: false,
  },
]

export const nearbyHelp = [
  {
    id: 'help-desk',
    title: 'Help carry a donated desk upstairs',
    region: 'Burlingame area',
    time: 'Saturday afternoon',
    safety: 'Public location shared after both people confirm',
  },
  {
    id: 'help-grocery',
    title: 'Grocery pickup for a parent recovering at home',
    region: 'San Mateo area',
    time: 'Flexible this week',
    safety: 'Contact remains inside Bravvi',
  },
]

export const groups = [
  { id: 'group-parents', name: 'Peninsula parents helping parents', members: 384, topic: 'Family support' },
  { id: 'group-career', name: 'Career restart circle', members: 219, topic: 'Work and learning' },
  { id: 'group-makers', name: 'Bay Area makers', members: 147, topic: 'Skills and projects' },
]

export const events = [
  { id: 'event-pantry', title: 'Community pantry morning', when: 'Sat, 10:00 AM', region: 'San Mateo area' },
  { id: 'event-cv', title: 'Resume and interview circle', when: 'Tue, 6:30 PM', region: 'Online' },
]

export const topics = [
  { id: 'topic-1', title: 'Where can I donate a lightly used monitor?', replies: 18, group: 'Career restart circle' },
  { id: 'topic-2', title: 'Low-cost meals for a family of four', replies: 31, group: 'Peninsula parents' },
  { id: 'topic-3', title: 'First-week warehouse essentials', replies: 12, group: 'Work enablement' },
]

export const catalog = {
  food: [
    { code: 'FOOD-PRODUCE', name: 'Fresh produce bundle', estimateMinor: 3200 },
    { code: 'FOOD-PANTRY', name: 'Pantry staples', estimateMinor: 4100 },
    { code: 'FOOD-PROTEIN', name: 'Protein essentials', estimateMinor: 4700 },
    { code: 'HOME-HYGIENE', name: 'Hygiene essentials', estimateMinor: 2600 },
  ],
  work: [
    { code: 'WORK-BOOTS', name: 'Work boots', estimateMinor: 7800 },
    { code: 'WORK-PPE', name: 'Basic PPE kit', estimateMinor: 4200 },
    { code: 'WORK-HEADSET', name: 'Work headset', estimateMinor: 3900 },
    { code: 'WORK-LAPTOP', name: 'Entry laptop', estimateMinor: 39900 },
  ],
}

export const activityItems: Array<{
  id: string
  group: 'Today' | 'Earlier'
  title: string
  detail: string
  tone: ActivityTone
}> = [
  {
    id: 'act-evidence',
    group: 'Today',
    title: 'Action needed on your work request',
    detail: 'A proof-of-employment document is still needed. No approval has been issued.',
    tone: 'action',
  },
  {
    id: 'act-reward',
    group: 'Today',
    title: 'Reward accrual pending',
    detail: 'The purchase has not settled, so the reward is not available yet.',
    tone: 'pending',
  },
  {
    id: 'act-delivery',
    group: 'Earlier',
    title: 'Delivery status verified',
    detail: 'Carrier tracking recorded a delivery scan. Recipient confirmation remains open.',
    tone: 'verified',
  },
  {
    id: 'act-demo',
    group: 'Earlier',
    title: 'Bravvi V1 preview',
    detail: 'This activity item is demo data and did not create an external action.',
    tone: 'demo',
  },
]

export const suggestedDreamImages = [
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1000&q=80',
]
