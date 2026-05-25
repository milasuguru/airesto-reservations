export const ORDER_STATUS_CONFIG = {
  New: {
    label: 'Новый заказ',
    color: '#4CAF50',
    colorDark: '#388E3C',
    textColor: '#fff',
    borderColor: '#2E7D32'
  },
  Bill: {
    label: 'Счёт',
    color: '#FF9800',
    colorDark: '#F57C00',
    textColor: '#fff',
    borderColor: '#E65100'
  },
  Closed: {
    label: 'Закрыт',
    color: '#9E9E9E',
    colorDark: '#616161',
    textColor: '#fff',
    borderColor: '#424242'
  },
  Banquet: {
    label: 'Банкет',
    color: '#9C27B0',
    colorDark: '#7B1FA2',
    textColor: '#fff',
    borderColor: '#4A148C'
  }
}

export const RESERVATION_STATUS_CONFIG = {
  'Живая очередь': {
    label: 'Живая очередь',
    color: '#03A9F4',
    colorDark: '#0288D1',
    textColor: '#fff',
    borderColor: '#01579B'
  },
  'Новая': {
    label: 'Новая',
    color: '#2196F3',
    colorDark: '#1565C0',
    textColor: '#fff',
    borderColor: '#0D47A1'
  },
  'Заявка': {
    label: 'Заявка',
    color: '#FF5722',
    colorDark: '#E64A19',
    textColor: '#fff',
    borderColor: '#BF360C'
  },
  'Открыт': {
    label: 'Открыт',
    color: '#8BC34A',
    colorDark: '#558B2F',
    textColor: '#fff',
    borderColor: '#33691E'
  },
  'Закрыт': {
    label: 'Закрыт',
    color: '#78909C',
    colorDark: '#455A64',
    textColor: '#fff',
    borderColor: '#263238'
  }
}

export function getEventConfig(event) {
  if (event.type === 'order') {
    return ORDER_STATUS_CONFIG[event.status] || ORDER_STATUS_CONFIG['New']
  }
  return RESERVATION_STATUS_CONFIG[event.status] || RESERVATION_STATUS_CONFIG['Новая']
}


export function processEvents(table, openingMinutes) {
  const events = []

  for (const order of table.orders || []) {
    events.push({
      id: order.id,
      type: 'order',
      status: order.status,
      startIso: order.start_time,
      endIso: order.end_time,
      label: ORDER_STATUS_CONFIG[order.status]?.label || order.status,
      table
    })
  }

  for (const res of table.reservations || []) {
    events.push({
      id: String(res.id),
      type: 'reservation',
      status: res.status,
      startIso: res.seating_time,
      endIso: res.end_time,
      name: res.name_for_reservation,
      numPeople: res.num_people,
      phone: res.phone_number,
      label: res.name_for_reservation,
      table
    })
  }

  return events
}
