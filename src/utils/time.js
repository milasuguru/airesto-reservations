export function parseISO(str) {
  return new Date(str)
}

export function getRestaurantTime(timezone) {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
}

export function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

export function formatDateShort(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function generateTimeSlots(openingTime, closingTime, intervalMinutes = 30) {
  const slots = []
  const [openH, openM] = openingTime.split(':').map(Number)
  const [closeH, closeM] = closingTime.split(':').map(Number)

  const openTotal = openH * 60 + openM
  const closeTotal = closeH * 60 + closeM

  for (let m = openTotal; m <= closeTotal; m += intervalMinutes) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push({
      label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      minutes: m
    })
  }

  return slots
}

export function isoToMinutes(isoStr) {
  const date = new Date(isoStr)

  const match = isoStr.match(/([+-])(\d{2}):(\d{2})$/)
  if (match) {
    const sign = match[1] === '+' ? 1 : -1
    const offsetMinutes = (parseInt(match[2]) * 60 + parseInt(match[3])) * sign
    const utcMinutes = date.getTime() / 60000
    const localMinutes = utcMinutes + offsetMinutes
    return localMinutes % (24 * 60)
  }
  return date.getHours() * 60 + date.getMinutes()
}

export function getCurrentMinutes(timezone) {
  const now = getRestaurantTime(timezone)
  return now.getHours() * 60 + now.getMinutes()
}
