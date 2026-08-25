export type AppTab = 'home' | 'discover' | 'create' | 'activity' | 'you'
export type DiscoverView = 'nearby' | 'groups' | 'events' | 'topics'
export type CreateFlow = 'menu' | 'request' | 'offer' | 'dream'
export type AccountView = 'home' | 'requests' | 'rewards' | 'community' | 'privacy'
export type RequestCategory = 'food' | 'work'
export type ActivityTone = 'verified' | 'pending' | 'action' | 'demo'

export type LocalRequestDraft = {
  id: string
  type: 'request'
  category: RequestCategory
  title: string
  note: string
  items: Array<{ code: string; name: string; quantity: number; estimateMinor: number }>
  estimatedMinor: number
  substitutionPolicy: 'ask' | 'similar' | 'none'
  status: 'LOCAL_DRAFT'
  createdAt: string
}

export type LocalDreamDraft = {
  id: string
  type: 'dream'
  title: string
  story: string
  imageUrl: string
  imageSource: 'upload-preview' | 'suggested' | 'ai-preview'
  status: 'LOCAL_DRAFT'
  createdAt: string
}

export type LocalOfferDraft = {
  id: string
  type: 'offer'
  categories: string[]
  region: string
  availability: string
  status: 'LOCAL_DRAFT'
  createdAt: string
}

export type LocalDraft = LocalRequestDraft | LocalDreamDraft | LocalOfferDraft
