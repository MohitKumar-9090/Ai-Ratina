export const screeningResult = {
  prediction: 'Moderate DR',
  severity: 'Moderate Diabetic Retinopathy',
  confidence: 84.3,
  date: '22 Aug 2026',
  status: 'Review recommended',
  explanation: 'The model identified image patterns associated with moderate diabetic retinopathy. A qualified eye-care professional should review this screening result.'
}

export const historyRecords = [
  { id: 1, date: '22 Aug 2026', prediction: 'Moderate DR', confidence: '84.3%', status: 'Review recommended', tone: 'amber' },
  { id: 2, date: '20 Aug 2026', prediction: 'No DR', confidence: '97.5%', status: 'Screened', tone: 'emerald' },
  { id: 3, date: '14 Aug 2026', prediction: 'Mild DR', confidence: '78.1%', status: 'Review recommended', tone: 'amber' },
  { id: 4, date: '08 Aug 2026', prediction: 'No DR', confidence: '95.8%', status: 'Screened', tone: 'emerald' }
]

export const drClasses = [
  ['0', 'No DR', 'No visible signs detected by the AI screening model.'],
  ['1', 'Mild DR', 'Early changes that merit routine professional review.'],
  ['2', 'Moderate DR', 'More than mild changes; professional review recommended.'],
  ['3', 'Severe DR', 'High-severity screening result requiring timely review.'],
  ['4', 'Proliferative DR', 'Advanced screening class requiring urgent professional attention.']
]
