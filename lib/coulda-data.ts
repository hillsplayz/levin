export type Scenario = {
  id: string
  coin: string
  ticker: string
  pitch: string
  startCap: number
  investment: number
  multiplier: number
  buyMultiplier: number
  chart: { tick: number; value: number }[]
}

export const scenarios: Scenario[] = [
  {
    id: 'pigeon-protocol',
    coin: 'Pigeon Protocol',
    ticker: '$COO',
    pitch: 'A decentralized message layer powered entirely by misplaced confidence.',
    startCap: 10_000,
    investment: 100,
    multiplier: 84,
    buyMultiplier: 0.72,
    chart: [10, 11, 9, 13, 12, 18, 16, 31, 29, 48, 74, 116, 203, 392, 840].map((value, tick) => ({ tick, value })),
  },
  {
    id: 'keyboard-cat-capital',
    coin: 'Keyboard Cat Capital',
    ticker: '$TYPE',
    pitch: 'The first fund managed by one cat walking across a mechanical keyboard.',
    startCap: 24_000,
    investment: 100,
    multiplier: 37,
    buyMultiplier: 1.18,
    chart: [24, 22, 25, 21, 28, 27, 35, 33, 51, 72, 68, 124, 230, 418, 888].map((value, tick) => ({ tick, value })),
  },
  {
    id: 'dusty-router',
    coin: 'Dusty Router',
    ticker: '$WIFI',
    pitch: 'Tokenizing the blinking light nobody has understood since 2009.',
    startCap: 8_500,
    investment: 100,
    multiplier: 112,
    buyMultiplier: 0.41,
    chart: [9, 8, 8, 10, 7, 12, 11, 19, 17, 41, 83, 151, 304, 612, 952].map((value, tick) => ({ tick, value })),
  },
  {
    id: 'left-sock',
    coin: 'Left Sock',
    ticker: '$SOCK',
    pitch: 'A deflationary answer to every sock the dryer has ever taken from you.',
    startCap: 16_000,
    investment: 100,
    multiplier: 61,
    buyMultiplier: 2.4,
    chart: [16, 18, 15, 22, 19, 31, 28, 46, 43, 79, 131, 217, 410, 688, 976].map((value, tick) => ({ tick, value })),
  },
]

export const archiveStories = [
  {
    title: 'The Group Chat Muted Me',
    story: 'Saw $NAP at $14K. Wrote “looks too obvious.” It did 73x before breakfast.',
    opportunity: '$100 → hypothetical $7,300',
    rating: 92,
  },
  {
    title: 'Due Diligence Victim',
    story: 'Opened the docs, disliked the font, and waited. The chart did not wait.',
    opportunity: '$250 → hypothetical $12,500',
    rating: 88,
  },
  {
    title: 'Gas Fee Philosopher',
    story: 'Refused a $4 network fee on principle. Spent the next week calculating the missed bag.',
    opportunity: '$80 → hypothetical $4,880',
    rating: 97,
  },
  {
    title: 'One More Dip',
    story: 'Set the perfect entry 2% lower. It never returned. Neither did inner peace.',
    opportunity: '$500 → hypothetical $18,500',
    rating: 84,
  },
  {
    title: 'The Sensible Friend',
    story: 'Talked everyone out of $DUST. They still send the chart on my birthday.',
    opportunity: '$100 → hypothetical $11,200',
    rating: 100,
  },
  {
    title: 'Watchlist Champion',
    story: 'Added it early. Color-coded it. Made notes. Bought absolutely nothing.',
    opportunity: '$150 → hypothetical $9,150',
    rating: 95,
  },
]
