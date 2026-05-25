const BASE_DATE = '2025-04-04'
const TIMEZONE = 'Asia/Vladivostok' 

function makeTime(date, hour, minute = 0, second = 0) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}.000000+10:00`
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const ZONES = ['1 этаж', '2 этаж', 'Банкетный зал']
const ORDER_STATUSES = ['New', 'Bill', 'Closed', 'Banquet']
const RESERVATION_STATUSES = ['Живая очередь', 'Новая', 'Заявка', 'Открыт', 'Закрыт']
const NAMES = ['Алина', 'Максим', 'Ольга', 'Дмитрий', 'Анна', 'Сергей', 'Мария', 'Иван', 'Елена', 'Андрей', 'Наташа', 'Владимир']

let idCounter = 1000
let reservationIdCounter = 1

function generateOrders(date, zone) {
  const orders = []
  const count = randomInt(0, zone === 'Банкетный зал' ? 1 : 3)

  const slots = []
  const startHour = randomInt(11, 14)
  for (let i = 0; i < count; i++) {
    const start = startHour + i * randomInt(1, 3)
    if (start >= 22) break
    const duration = randomInt(1, 2)
    slots.push({ start, duration })
  }

  for (const slot of slots) {
    const startMin = randomInt(0, 45)
    const endHour = slot.start + slot.duration
    const endMin = randomInt(0, 59)
    const status = zone === 'Банкетный зал' ? 'Banquet' : randomChoice(ORDER_STATUSES.filter(s => s !== 'Banquet'))
    orders.push({
      id: `order-${idCounter++}`,
      status,
      start_time: makeTime(date, slot.start, startMin),
      end_time: makeTime(date, Math.min(endHour, 23), endMin)
    })
  }

  return orders
}

function generateReservations(date, zone) {
  const reservations = []
  const count = randomInt(0, 3)

  for (let i = 0; i < count; i++) {
    const startHour = randomInt(12, 20)
    const startMin = randomChoice([0, 15, 30, 45])
    const duration = randomInt(1, 3)
    const endHour = Math.min(startHour + duration, 23)
    const endMin = randomChoice([0, 15, 30, 45])

    reservations.push({
      id: reservationIdCounter++,
      name_for_reservation: randomChoice(NAMES),
      num_people: randomInt(1, 8),
      phone_number: `+7${randomInt(9000000000, 9999999999)}`,
      status: randomChoice(RESERVATION_STATUSES),
      seating_time: makeTime(date, startHour, startMin),
      end_time: makeTime(date, endHour, endMin)
    })
  }

  return reservations
}

function generateTables(date) {
  const tables = []
  const tableConfigs = [

    ...Array.from({ length: 12 }, (_, i) => ({ number: String(51 + i), zone: '1 этаж', capacity: randomChoice([2, 4, 4, 6]) })),
    ...Array.from({ length: 8 }, (_, i) => ({ number: String(21 + i), zone: '2 этаж', capacity: randomChoice([2, 4, 6]) })),
    ...Array.from({ length: 3 }, (_, i) => ({ number: String(i + 1), zone: 'Банкетный зал', capacity: randomChoice([10, 15, 20]) })),
  ]

  for (const config of tableConfigs) {
    tables.push({
      id: `table-${idCounter++}`,
      capacity: config.capacity,
      number: config.number,
      zone: config.zone,
      orders: generateOrders(date, config.zone),
      reservations: generateReservations(date, config.zone)
    })
  }

  return tables
}

export function generateMockData(date = BASE_DATE) {
  return {
    available_days: ['2025-04-04', '2025-04-05', '2025-04-06', '2025-04-07', '2025-04-08'],
    current_day: BASE_DATE,
    restaurant: {
      id: 11100,
      timezone: TIMEZONE,
      restaurant_name: 'Супра',
      opening_time: '11:00',
      closing_time: '23:40'
    },
    tables: generateTables(date)
  }
}

export async function fetchReservations(date) {
  try {
    const response = await fetch(`https://hh.frontend.ark.software/api/v1/reservations?date=${date}`, {
      signal: AbortSignal.timeout(3000)
    })
    if (response.ok) {
      return await response.json()
    }
  } catch {
  }

  return new Promise(resolve => {
    setTimeout(() => resolve(generateMockData(date)), 400)
  })
}
