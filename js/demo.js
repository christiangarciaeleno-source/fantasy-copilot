const j = (dorsal, nombre, posicion, equipo, titularidad_pct, xp) =>
  ({ dorsal, nombre, posicion, equipo, titularidad_pct, xp });

export const DEMO = {
  saldo: -1850000,
  once: [
    j(1, 'Mamardashvili', 'POR', 'VAL', 95, 6.9),
    j(23, 'Koundé', 'DEF', 'FCB', 90, 6.8), j(2, 'Rüdiger', 'DEF', 'RMA', 85, 6.5),
    j(3, 'Raíllo', 'DEF', 'MLL', 88, 6.2), j(2, 'Giménez', 'DEF', 'ATM', 80, 5.9),
    j(8, 'Pedri', 'MED', 'FCB', 98, 7.8), j(5, 'Bellingham', 'MED', 'RMA', 96, 7.9),
    j(4, 'Zubimendi', 'MED', 'RSO', 92, 6.7),
    j(19, 'Lamine Yamal', 'DEL', 'FCB', 99, 9.4), j(7, 'Vinícius Jr', 'DEL', 'RMA', 94, 8.8),
    j(7, 'Griezmann', 'DEL', 'ATM', 60, 7.2)
  ],
  ventas_recomendadas: [
    { nombre: 'Brahim Díaz', vm: 2400000, motivo: 'Suplente habitual con alto valor para saldar la deuda de 1,85 M€' }
  ],
  compras_mercado: [
    { nombre: 'Bryan Zaragoza', vm: 5800000, puja_sugerida: 6150000, tipo: 'especulacion' },
    { nombre: 'Ante Budimir', vm: 7200000, puja_sugerida: 7400000, tipo: 'chollo' },
    { nombre: 'Tchouaméni', vm: 8900000, puja_sugerida: 0, tipo: 'burbuja' }
  ]
};
